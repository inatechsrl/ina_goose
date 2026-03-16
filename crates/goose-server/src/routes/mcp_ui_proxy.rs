use axum::{
    extract::Query,
    http::{header, StatusCode},
    response::{Html, IntoResponse, Response},
    routing::get,
    Router,
};
use crate::auth::AuthState;
use serde::Deserialize;

#[derive(Deserialize)]
struct ProxyQuery {
    secret: String,
}

const MCP_UI_PROXY_HTML: &str = include_str!("templates/mcp_ui_proxy.html");

#[utoipa::path(
    get,
    path = "/mcp-ui-proxy",
    params(
        ("secret" = String, Query, description = "Secret key for authentication")
    ),
    responses(
        (status = 200, description = "MCP UI proxy HTML page", content_type = "text/html"),
        (status = 401, description = "Unauthorized - invalid or missing secret"),
    )
)]
async fn mcp_ui_proxy(
    axum::extract::State(auth): axum::extract::State<AuthState>,
    Query(params): Query<ProxyQuery>,
) -> Response {
    if !auth.is_valid_key(&params.secret) {
        return (StatusCode::UNAUTHORIZED, "Unauthorized").into_response();
    }

    (
        [
            (header::CONTENT_TYPE, "text/html; charset=utf-8"),
            (
                header::HeaderName::from_static("referrer-policy"),
                "no-referrer",
            ),
        ],
        Html(MCP_UI_PROXY_HTML),
    )
        .into_response()
}

pub fn routes(auth: AuthState) -> Router {
    Router::new()
        .route("/mcp-ui-proxy", get(mcp_ui_proxy))
        .with_state(auth)
}
