use std::collections::HashSet;
use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use axum::{
    extract::{ConnectInfo, Request, State},
    http::{HeaderMap, StatusCode},
    middleware::Next,
    response::Response,
};
use dashmap::DashMap;
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

#[derive(Clone)]
pub struct AuthState {
    pub server_key: String,
    pub valid_key_hashes: HashSet<String>,
    pub jwt_secret: String,
    pub failed_attempts: Arc<DashMap<String, (u32, Instant)>>,
}

#[derive(Serialize, Deserialize)]
struct Claims {
    exp: usize,
}

impl AuthState {
    pub fn is_valid_server_key(&self, key: &str) -> bool {
        key == self.server_key
    }

    pub fn is_valid_web_key(&self, key: &str) -> bool {
        let mut hasher = Sha256::new();
        hasher.update(key.as_bytes());
        let hash = format!("{:x}", hasher.finalize());
        self.valid_key_hashes.contains(&hash)
    }

    pub fn is_valid_key(&self, key: &str) -> bool {
        self.is_valid_server_key(key) || self.is_valid_web_key(key)
    }

    pub fn issue_token(&self) -> Result<String, jsonwebtoken::errors::Error> {
        let exp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as usize
            + 86400;
        let claims = Claims { exp };
        encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(self.jwt_secret.as_bytes()),
        )
    }

    pub fn validate_token(&self, token: &str) -> bool {
        decode::<Claims>(
            token,
            &DecodingKey::from_secret(self.jwt_secret.as_bytes()),
            &Validation::default(),
        )
        .is_ok()
    }

    pub fn is_rate_limited(&self, ip: &str) -> bool {
        if let Some(entry) = self.failed_attempts.get(ip) {
            let (count, last_attempt) = entry.value();
            if last_attempt.elapsed() < Duration::from_secs(60) {
                return *count >= 5;
            }
        }
        false
    }

    pub fn record_failure(&self, ip: &str) {
        let now = Instant::now();
        self.failed_attempts
            .entry(ip.to_string())
            .and_modify(|(count, last_attempt)| {
                if last_attempt.elapsed() > Duration::from_secs(60) {
                    *count = 1;
                } else {
                    *count += 1;
                }
                *last_attempt = now;
            })
            .or_insert((1, now));
    }

    pub fn clear_failures(&self, ip: &str) {
        self.failed_attempts.remove(ip);
    }
}

/// Extract client IP from request headers, falling back to ConnectInfo or "unknown".
pub fn extract_client_ip(headers: &HeaderMap) -> String {
    if let Some(forwarded_for) = headers.get("X-Forwarded-For") {
        if let Ok(value) = forwarded_for.to_str() {
            if let Some(ip) = value.split(',').next() {
                let trimmed = ip.trim();
                if !trimmed.is_empty() {
                    return trimmed.to_string();
                }
            }
        }
    }
    "unknown".to_string()
}

pub async fn check_token(
    State(auth): State<AuthState>,
    request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let path = request.uri().path();
    if path == "/status"
        || path == "/mcp-ui-proxy"
        || path == "/mcp-app-proxy"
        || path == "/mcp-app-guest"
        || path == "/auth/login"
    {
        return Ok(next.run(request).await);
    }

    // Extract client IP
    let ip = {
        let header_ip = extract_client_ip(request.headers());
        if header_ip != "unknown" {
            header_ip
        } else if let Some(connect_info) = request.extensions().get::<ConnectInfo<std::net::SocketAddr>>() {
            connect_info.0.ip().to_string()
        } else {
            "unknown".to_string()
        }
    };

    // Check rate limiting
    if auth.is_rate_limited(&ip) {
        return Err(StatusCode::TOO_MANY_REQUESTS);
    }

    // Check X-Secret-Key header
    let secret_key = request
        .headers()
        .get("X-Secret-Key")
        .and_then(|value| value.to_str().ok());

    if let Some(key) = secret_key {
        if auth.is_valid_key(key) {
            auth.clear_failures(&ip);
            return Ok(next.run(request).await);
        }
    }

    // Check X-Session-Token header
    let session_token = request
        .headers()
        .get("X-Session-Token")
        .and_then(|value| value.to_str().ok());

    if let Some(token) = session_token {
        if auth.validate_token(token) {
            auth.clear_failures(&ip);
            return Ok(next.run(request).await);
        }
    }

    // Neither valid
    auth.record_failure(&ip);
    Err(StatusCode::UNAUTHORIZED)
}
