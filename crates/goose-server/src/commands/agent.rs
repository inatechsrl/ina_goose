use crate::configuration;
use crate::state;
use anyhow::Result;
use axum::middleware;
use axum_server::Handle;
use dashmap::DashMap;
use crate::auth::{check_token, AuthState};
use crate::tls::self_signed_config;
use rand::Rng;
use std::collections::HashSet;
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::{ServeDir, ServeFile};
use tracing::{info, warn};

#[derive(serde::Deserialize)]
struct WebKeysFile {
    keys: Vec<WebKeyEntry>,
}

#[derive(serde::Deserialize)]
struct WebKeyEntry {
    #[allow(dead_code)]
    name: String,
    hash: String,
}

#[cfg(unix)]
async fn shutdown_signal() {
    use tokio::signal::unix::{signal, SignalKind};

    let mut sigint = signal(SignalKind::interrupt()).expect("failed to install SIGINT handler");
    let mut sigterm = signal(SignalKind::terminate()).expect("failed to install SIGTERM handler");

    tokio::select! {
        _ = sigint.recv() => {},
        _ = sigterm.recv() => {},
    }
}

#[cfg(not(unix))]
async fn shutdown_signal() {
    let _ = tokio::signal::ctrl_c().await;
}

pub async fn run() -> Result<()> {
    // Install the rustls crypto provider early, before any spawned tasks (tunnel,
    // gateways, etc.) try to open TLS connections. Both `ring` and `aws-lc-rs`
    // features are enabled on rustls (via different transitive deps), so rustls
    // cannot auto-detect a provider — we must pick one explicitly.
    let _ = rustls::crypto::ring::default_provider().install_default();

    crate::logging::setup_logging(Some("goosed"))?;

    let settings = configuration::Settings::new()?;

    let secret_key =
        std::env::var("GOOSE_SERVER__SECRET_KEY").unwrap_or_else(|_| "test".to_string());

    // Load web-keys.yaml from the goose config directory
    let mut valid_key_hashes: HashSet<String> = HashSet::new();

    let keys_path = goose::config::paths::Paths::config_dir().join("web-keys.yaml");
    match std::fs::read_to_string(&keys_path) {
        Ok(contents) => match serde_yaml::from_str::<WebKeysFile>(&contents) {
            Ok(web_keys) => {
                for entry in &web_keys.keys {
                    valid_key_hashes.insert(entry.hash.clone());
                }
                info!(
                    "Loaded {} web key(s) from {}",
                    web_keys.keys.len(),
                    keys_path.display()
                );
            }
            Err(e) => warn!("Failed to parse {}: {}", keys_path.display(), e),
        },
        Err(_) => info!(
            "No web-keys.yaml found at {} — only server secret key active",
            keys_path.display()
        ),
    }

    // Generate a random JWT secret (per-startup)
    let jwt_secret: String = {
        let mut rng = rand::rng();
        let bytes: Vec<u8> = (0..32).map(|_| rng.random::<u8>()).collect();
        hex::encode(bytes)
    };

    // Build AuthState
    let auth_state = AuthState {
        server_key: secret_key.clone(),
        valid_key_hashes,
        jwt_secret,
        failed_attempts: Arc::new(DashMap::new()),
    };

    let app_state = state::AppState::new().await?;

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let api = crate::routes::configure(app_state.clone(), auth_state.clone())
        .layer(middleware::from_fn_with_state(
            auth_state.clone(),
            check_token,
        ))
        .layer(cors);

    let app = if let Ok(web_ui_dir) = std::env::var("GOOSE_WEB_UI_DIR") {
        let index_html = std::path::PathBuf::from(&web_ui_dir).join("index.html");
        info!("Serving web UI from: {}", web_ui_dir);
        axum::Router::new()
            .merge(api)
            .fallback_service(
                ServeDir::new(&web_ui_dir).not_found_service(ServeFile::new(index_html)),
            )
    } else {
        api
    };

    let addr = settings.socket_addr();
    let tls_setup = self_signed_config().await?;

    let handle = Handle::new();
    let shutdown_handle = handle.clone();
    tokio::spawn(async move {
        shutdown_signal().await;
        shutdown_handle.graceful_shutdown(None);
    });

    info!("listening on https://{}", addr);

    let tunnel_manager = app_state.tunnel_manager.clone();
    tokio::spawn(async move {
        tunnel_manager.check_auto_start().await;
    });

    let gateway_manager = app_state.gateway_manager.clone();
    tokio::spawn(async move {
        gateway_manager.check_auto_start().await;
    });

    axum_server::bind_rustls(addr, tls_setup.config)
        .handle(handle)
        .serve(app.into_make_service_with_connect_info::<std::net::SocketAddr>())
        .await?;

    if goose::otel::otlp::is_otlp_initialized() {
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        goose::otel::otlp::shutdown_otlp();
    }

    info!("server shutdown complete");
    Ok(())
}
