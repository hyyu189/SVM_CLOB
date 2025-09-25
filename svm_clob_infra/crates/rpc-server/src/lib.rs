/// JSON-RPC Server for SVM CLOB Infrastructure
/// 
/// This module provides a REST API that matches the SVM CLOB contract interface
/// for order placement, cancellation, and market data retrieval.

use svm_clob_types::*;
use svm_clob_matching_engine::MatchingEngine;
use svm_clob_storage::Storage;
use axum::{
    extract::{State, Query, Path},
    http::StatusCode,
    response::Json,
    routing::{get, post, delete, put},
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn, error};

/// RPC server state
pub struct RpcServerState<S: Storage> {
    pub matching_engine: Arc<RwLock<MatchingEngine<S>>>,
    pub storage: Arc<S>,
}

/// JSON-RPC response wrapper
#[derive(Serialize)]
pub struct JsonRpcResponse<T> {
    pub jsonrpc: String,
    pub id: Option<u64>,
    pub result: Option<T>,
    pub error: Option<JsonRpcError>,
}

/// JSON-RPC error response
#[derive(Serialize)]
pub struct JsonRpcError {
    pub code: i32,
    pub message: String,
    pub data: Option<serde_json::Value>,
}

/// Create the RPC server router
pub fn create_router<S: Storage + 'static>() -> Router<Arc<RpcServerState<S>>> {
    Router::new()
        // Order management endpoints
        .route("/api/v1/orders", post(place_order_handler))
        .route("/api/v1/orders/:order_id", delete(cancel_order_handler))
        .route("/api/v1/orders/:order_id", put(modify_order_handler))
        .route("/api/v1/orders/:order_id", get(get_order_handler))
        
        // Market data endpoints
        .route("/api/v1/orderbook", get(get_orderbook_handler))
        .route("/api/v1/trades", get(get_trades_handler))
        .route("/api/v1/market/stats", get(get_market_stats_handler))
        
        // User endpoints
        .route("/api/v1/users/:user_id/orders", get(get_user_orders_handler))
        
        // Health check
        .route("/health", get(health_check_handler))
}

/// Place order handler
async fn place_order_handler<S: Storage>(
    State(state): State<Arc<RpcServerState<S>>>,
    Json(request): Json<PlaceOrderRequest>,
) -> Result<Json<JsonRpcResponse<Order>>, StatusCode> {
    info!("Received place order request");
    
    let current_time = chrono::Utc::now().timestamp();
    let order_id = generate_order_id().await;
    
    // Create order from request
    let order = Order {
        order_id,
        owner: solana_sdk::pubkey::Pubkey::default(), // TODO: Extract from auth
        price: request.price,
        quantity: request.quantity,
        remaining_quantity: request.quantity,
        timestamp: current_time,
        client_order_id: request.client_order_id,
        expiry_timestamp: request.expiry_timestamp.unwrap_or(0),
        side: request.side,
        order_type: request.order_type,
        status: OrderStatus::Open,
        self_trade_behavior: request.self_trade_behavior,
        time_in_force: request.time_in_force,
    };
    
    // Process order through matching engine
    let matching_engine = state.matching_engine.read().await;
    match matching_engine.place_order(order.clone()).await {
        Ok(_trades) => {
            let response = JsonRpcResponse {
                jsonrpc: "2.0".to_string(),
                id: Some(1),
                result: Some(order),
                error: None,
            };
            Ok(Json(response))
        }
        Err(e) => {
            error!("Failed to place order: {}", e);
            Err(StatusCode::BAD_REQUEST)
        }
    }
}

/// Cancel order handler
async fn cancel_order_handler<S: Storage>(
    State(state): State<Arc<RpcServerState<S>>>,
    Path(order_id): Path<u64>,
) -> Result<Json<JsonRpcResponse<Order>>, StatusCode> {
    info!("Received cancel order request for ID: {}", order_id);
    
    let matching_engine = state.matching_engine.read().await;
    match matching_engine.cancel_order(order_id).await {
        Ok(cancelled_order) => {
            let response = JsonRpcResponse {
                jsonrpc: "2.0".to_string(),
                id: Some(1),
                result: Some(cancelled_order),
                error: None,
            };
            Ok(Json(response))
        }
        Err(e) => {
            error!("Failed to cancel order: {}", e);
            Err(StatusCode::NOT_FOUND)
        }
    }
}

/// Modify order handler
async fn modify_order_handler<S: Storage>(
    State(_state): State<Arc<RpcServerState<S>>>,
    Path(_order_id): Path<u64>,
    Json(_request): Json<ModifyOrderRequest>,
) -> Result<Json<JsonRpcResponse<Order>>, StatusCode> {
    // TODO: Implement modify order logic
    warn!("Modify order not yet implemented");
    Err(StatusCode::NOT_IMPLEMENTED)
}

/// Get order handler
async fn get_order_handler<S: Storage>(
    State(state): State<Arc<RpcServerState<S>>>,
    Path(order_id): Path<u64>,
) -> Result<Json<JsonRpcResponse<Order>>, StatusCode> {
    match state.storage.get_order(order_id).await {
        Ok(Some(order)) => {
            let response = JsonRpcResponse {
                jsonrpc: "2.0".to_string(),
                id: Some(1),
                result: Some(order),
                error: None,
            };
            Ok(Json(response))
        }
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(e) => {
            error!("Failed to get order: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Get orderbook handler
async fn get_orderbook_handler<S: Storage>(
    State(state): State<Arc<RpcServerState<S>>>,
) -> Result<Json<JsonRpcResponse<OrderBookSnapshot>>, StatusCode> {
    let matching_engine = state.matching_engine.read().await;
    match matching_engine.get_order_book_snapshot().await {
        Ok(snapshot) => {
            let response = JsonRpcResponse {
                jsonrpc: "2.0".to_string(),
                id: Some(1),
                result: Some(snapshot),
                error: None,
            };
            Ok(Json(response))
        }
        Err(e) => {
            error!("Failed to get orderbook snapshot: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Get recent trades handler
async fn get_trades_handler<S: Storage>(
    State(state): State<Arc<RpcServerState<S>>>,
    Query(params): Query<TradeQuery>,
) -> Result<Json<JsonRpcResponse<Vec<TradeExecution>>>, StatusCode> {
    let limit = params.limit.unwrap_or(100).min(1000);
    
    match state.storage.get_recent_trades(limit).await {
        Ok(trades) => {
            let response = JsonRpcResponse {
                jsonrpc: "2.0".to_string(),
                id: Some(1),
                result: Some(trades),
                error: None,
            };
            Ok(Json(response))
        }
        Err(e) => {
            error!("Failed to get trades: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Get market stats handler
async fn get_market_stats_handler<S: Storage>(
    State(_state): State<Arc<RpcServerState<S>>>,
) -> Result<Json<JsonRpcResponse<serde_json::Value>>, StatusCode> {
    // TODO: Implement market stats
    warn!("Market stats not yet implemented");
    Err(StatusCode::NOT_IMPLEMENTED)
}

/// Get user orders handler
async fn get_user_orders_handler<S: Storage>(
    State(_state): State<Arc<RpcServerState<S>>>,
    Path(_user_id): Path<String>,
) -> Result<Json<JsonRpcResponse<Vec<Order>>>, StatusCode> {
    // TODO: Implement user orders lookup
    warn!("User orders lookup not yet implemented");
    Err(StatusCode::NOT_IMPLEMENTED)
}

/// Health check handler
async fn health_check_handler<S: Storage>() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "healthy",
        "timestamp": chrono::Utc::now().timestamp(),
        "service": "svm-clob-rpc-server"
    }))
}

/// Query parameters for trades endpoint
#[derive(Deserialize)]
struct TradeQuery {
    limit: Option<u32>,
}

/// Generate unique order ID
async fn generate_order_id() -> u64 {
    // TODO: Implement proper order ID generation
    chrono::Utc::now().timestamp_millis() as u64
}

/// Start the RPC server
pub async fn start_server<S: Storage + 'static>(
    state: Arc<RpcServerState<S>>,
    port: u16,
) -> Result<(), Box<dyn std::error::Error>> {
    let app = create_router().with_state(state);
    
    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port))
        .await?;
    
    info!("RPC server starting on port {}", port);
    axum::serve(listener, app).await?;
    
    Ok(())
}