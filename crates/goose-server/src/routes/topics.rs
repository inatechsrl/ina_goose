use axum::{http::StatusCode, routing::get, Json, Router};
use goose::config::paths::Paths;

async fn get_topics() -> Result<Json<serde_json::Value>, StatusCode> {
    let topics_path = Paths::config_dir().join("topics.json");
    let contents =
        std::fs::read_to_string(&topics_path).map_err(|_| StatusCode::NOT_FOUND)?;
    let value: serde_json::Value =
        serde_json::from_str(&contents).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(value))
}

pub fn routes() -> Router {
    Router::new().route("/api/topics", get(get_topics))
}
