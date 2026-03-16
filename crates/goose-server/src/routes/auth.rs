use axum::{
    extract::State,
    http::StatusCode,
    routing::post,
    Json, Router,
};
use serde::{Deserialize, Serialize};

use crate::auth::{extract_client_ip, AuthState};

#[derive(Deserialize)]
pub struct LoginRequest {
    key: String,
}

#[derive(Serialize)]
pub struct LoginResponse {
    token: String,
}

async fn login(
    State(auth): State<AuthState>,
    headers: axum::http::HeaderMap,
    Json(body): Json<LoginRequest>,
) -> Result<Json<LoginResponse>, StatusCode> {
    let ip = extract_client_ip(&headers);

    if auth.is_rate_limited(&ip) {
        return Err(StatusCode::TOO_MANY_REQUESTS);
    }

    if auth.is_valid_web_key(&body.key) {
        auth.clear_failures(&ip);
        let token = auth
            .issue_token()
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        Ok(Json(LoginResponse { token }))
    } else {
        auth.record_failure(&ip);
        Err(StatusCode::UNAUTHORIZED)
    }
}

pub fn routes(auth: AuthState) -> Router {
    Router::new()
        .route("/auth/login", post(login))
        .with_state(auth)
}
