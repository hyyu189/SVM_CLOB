/// WebSocket Server for SVM CLOB Infrastructure
/// 
/// This module provides real-time market data feeds and order book updates
/// via WebSocket connections for the SVM CLOB infrastructure.

use svm_clob_types::*;
use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::Response,
    routing::get,
    Router,
};
use futures_util::{sink::SinkExt, stream::StreamExt};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, sync::Arc};
use tokio::sync::{broadcast, RwLock};
use tracing::{info, warn, error, debug};
use uuid::Uuid;

/// WebSocket server state
pub struct WebSocketServerState {
    /// Broadcast sender for market data updates
    pub market_data_tx: broadcast::Sender<MarketDataUpdate>,
    /// Connected clients
    pub clients: Arc<RwLock<HashMap<Uuid, ClientConnection>>>,
}

/// Client connection information
#[derive(Debug, Clone)]
pub struct ClientConnection {
    pub id: Uuid,
    pub subscriptions: Vec<Subscription>,
    pub connected_at: chrono::DateTime<chrono::Utc>,
}

/// Subscription types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum Subscription {
    OrderBook { market: String },
    Trades { market: String },
    UserOrders { user: String },
    AllMarkets,
}

/// WebSocket message types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum WebSocketMessage {
    Subscribe {
        subscription: Subscription,
    },
    Unsubscribe {
        subscription: Subscription,
    },
    MarketData {
        data: MarketDataUpdate,
    },
    Error {
        message: String,
        code: u32,
    },
    Ping,
    Pong,
}

impl WebSocketServerState {
    /// Create new WebSocket server state
    pub fn new() -> Self {
        let (market_data_tx, _) = broadcast::channel(1000);
        
        Self {
            market_data_tx,
            clients: Arc::new(RwLock::new(HashMap::new())),
        }
    }
    
    /// Broadcast market data update to subscribed clients
    pub async fn broadcast_market_data(&self, update: MarketDataUpdate) {
        if let Err(e) = self.market_data_tx.send(update) {
            error!("Failed to broadcast market data: {}", e);
        }
    }
    
    /// Add new client connection
    pub async fn add_client(&self, client: ClientConnection) {
        let mut clients = self.clients.write().await;
        clients.insert(client.id, client);
        info!("New WebSocket client connected, total clients: {}", clients.len());
    }
    
    /// Remove client connection
    pub async fn remove_client(&self, client_id: Uuid) {
        let mut clients = self.clients.write().await;
        clients.remove(&client_id);
        info!("WebSocket client disconnected, total clients: {}", clients.len());
    }
    
    /// Get client by ID
    pub async fn get_client(&self, client_id: Uuid) -> Option<ClientConnection> {
        let clients = self.clients.read().await;
        clients.get(&client_id).cloned()
    }
    
    /// Update client subscriptions
    pub async fn update_client_subscriptions(&self, client_id: Uuid, subscriptions: Vec<Subscription>) {
        let mut clients = self.clients.write().await;
        if let Some(client) = clients.get_mut(&client_id) {
            client.subscriptions = subscriptions;
            debug!("Updated subscriptions for client: {}", client_id);
        }
    }
}

/// Create the WebSocket server router
pub fn create_router() -> Router<Arc<WebSocketServerState>> {
    Router::new()
        .route("/ws", get(websocket_handler))
        .route("/health", get(health_check_handler))
}

/// WebSocket connection handler
async fn websocket_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<WebSocketServerState>>,
) -> Response {
    ws.on_upgrade(|socket| handle_websocket(socket, state))
}

/// Handle individual WebSocket connection
async fn handle_websocket(socket: WebSocket, state: Arc<WebSocketServerState>) {
    let client_id = Uuid::new_v4();
    let client = ClientConnection {
        id: client_id,
        subscriptions: Vec::new(),
        connected_at: chrono::Utc::now(),
    };
    
    // Add client to state
    state.add_client(client).await;
    
    // Create market data receiver
    let mut market_data_rx = state.market_data_tx.subscribe();
    
    // Split socket into sender and receiver
    let (mut sender, mut receiver) = socket.split();
    
    // Spawn task to handle incoming messages
    let state_clone = state.clone();
    let incoming_task = tokio::spawn(async move {
        while let Some(msg) = receiver.next().await {
            match msg {
                Ok(Message::Text(text)) => {
                    if let Err(e) = handle_incoming_message(&state_clone, client_id, &text).await {
                        error!("Error handling incoming message: {}", e);
                    }
                }
                Ok(Message::Binary(_)) => {
                    warn!("Received unexpected binary message");
                }
                Ok(Message::Ping(data)) => {
                    if sender.send(Message::Pong(data)).await.is_err() {
                        break;
                    }
                }
                Ok(Message::Pong(_)) => {
                    debug!("Received pong from client: {}", client_id);
                }
                Ok(Message::Close(_)) => {
                    info!("WebSocket connection closed by client: {}", client_id);
                    break;
                }
                Err(e) => {
                    error!("WebSocket error for client {}: {}", client_id, e);
                    break;
                }
            }
        }
    });
    
    // Spawn task to handle outgoing messages
    let outgoing_task = tokio::spawn(async move {
        loop {
            tokio::select! {
                // Handle market data broadcasts
                market_data = market_data_rx.recv() => {
                    match market_data {
                        Ok(update) => {
                            // Check if client is subscribed to this update
                            if let Some(client) = state.get_client(client_id).await {
                                if should_send_update(&client, &update) {
                                    let message = WebSocketMessage::MarketData { data: update };
                                    if let Ok(json) = serde_json::to_string(&message) {
                                        if sender.send(Message::Text(json)).await.is_err() {
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                        Err(broadcast::error::RecvError::Lagged(skipped)) => {
                            warn!("Client {} lagged, skipped {} messages", client_id, skipped);
                        }
                        Err(broadcast::error::RecvError::Closed) => {
                            info!("Market data broadcast channel closed");
                            break;
                        }
                    }
                }
                
                // Send periodic ping
                _ = tokio::time::sleep(tokio::time::Duration::from_secs(30)) => {
                    if sender.send(Message::Ping(vec![])).await.is_err() {
                        break;
                    }
                }
            }
        }
    });
    
    // Wait for either task to complete
    tokio::select! {
        _ = incoming_task => {},
        _ = outgoing_task => {},
    }
    
    // Remove client from state
    state.remove_client(client_id).await;
}

/// Handle incoming WebSocket messages
async fn handle_incoming_message(
    state: &Arc<WebSocketServerState>,
    client_id: Uuid,
    text: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let message: WebSocketMessage = serde_json::from_str(text)?;
    
    match message {
        WebSocketMessage::Subscribe { subscription } => {
            // Add subscription to client
            if let Some(mut client) = state.get_client(client_id).await {
                client.subscriptions.push(subscription.clone());
                state.update_client_subscriptions(client_id, client.subscriptions).await;
                info!("Client {} subscribed to: {:?}", client_id, subscription);
            }
        }
        WebSocketMessage::Unsubscribe { subscription } => {
            // Remove subscription from client
            if let Some(mut client) = state.get_client(client_id).await {
                client.subscriptions.retain(|s| !subscriptions_match(s, &subscription));
                state.update_client_subscriptions(client_id, client.subscriptions).await;
                info!("Client {} unsubscribed from: {:?}", client_id, subscription);
            }
        }
        WebSocketMessage::Ping => {
            // Handle ping - pong will be sent automatically
            debug!("Received ping from client: {}", client_id);
        }
        _ => {
            warn!("Received unexpected message type from client: {}", client_id);
        }
    }
    
    Ok(())
}

/// Check if client should receive a market data update
fn should_send_update(client: &ClientConnection, update: &MarketDataUpdate) -> bool {
    for subscription in &client.subscriptions {
        match (subscription, &update.update_type) {
            (Subscription::OrderBook { .. }, MarketDataUpdateType::OrderBookUpdate) => return true,
            (Subscription::Trades { .. }, MarketDataUpdateType::TradeExecution) => return true,
            (Subscription::UserOrders { .. }, MarketDataUpdateType::OrderUpdate) => return true,
            (Subscription::AllMarkets, _) => return true,
            _ => {}
        }
    }
    false
}

/// Check if two subscriptions match for unsubscription
fn subscriptions_match(a: &Subscription, b: &Subscription) -> bool {
    match (a, b) {
        (Subscription::OrderBook { market: m1 }, Subscription::OrderBook { market: m2 }) => m1 == m2,
        (Subscription::Trades { market: m1 }, Subscription::Trades { market: m2 }) => m1 == m2,
        (Subscription::UserOrders { user: u1 }, Subscription::UserOrders { user: u2 }) => u1 == u2,
        (Subscription::AllMarkets, Subscription::AllMarkets) => true,
        _ => false,
    }
}

/// Health check handler
async fn health_check_handler() -> axum::Json<serde_json::Value> {
    axum::Json(serde_json::json!({
        "status": "healthy",
        "timestamp": chrono::Utc::now().timestamp(),
        "service": "svm-clob-websocket-server"
    }))
}

/// Start the WebSocket server
pub async fn start_server(
    state: Arc<WebSocketServerState>,
    port: u16,
) -> Result<(), Box<dyn std::error::Error>> {
    let app = create_router().with_state(state);
    
    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port))
        .await?;
    
    info!("WebSocket server starting on port {}", port);
    axum::serve(listener, app).await?;
    
    Ok(())
}