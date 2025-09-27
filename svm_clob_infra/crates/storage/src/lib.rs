/// Storage Layer for SVM CLOB Infrastructure
/// 
/// This module provides persistent storage for orders, trades, and market state
/// with support for both PostgreSQL and Redis backends.

use svm_clob_types::*;
use async_trait::async_trait;
use sqlx::{PgPool, Row};
use redis::AsyncCommands;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn, error};

/// Storage trait for abstracting persistence operations
#[async_trait]
pub trait Storage: Send + Sync {
    /// Store a new order
    async fn store_order(&self, order: &Order) -> ClobResult<()>;
    
    /// Update an existing order
    async fn update_order(&self, order: &Order) -> ClobResult<()>;
    
    /// Get order by ID
    async fn get_order(&self, order_id: u64) -> ClobResult<Option<Order>>;

    /// Get all orders for a user
    async fn get_user_orders(&self, user_id: &str) -> ClobResult<Vec<Order>>;
    
    /// Store a trade execution
    async fn store_trade(&self, trade: &TradeExecution) -> ClobResult<()>;
    
    /// Get recent trades
    async fn get_recent_trades(&self, limit: u32) -> ClobResult<Vec<TradeExecution>>;
    
    /// Store orderbook snapshot
    async fn store_orderbook_snapshot(&self, snapshot: &OrderBookSnapshot) -> ClobResult<()>;
    
    /// Get latest orderbook snapshot
    async fn get_latest_orderbook_snapshot(&self) -> ClobResult<Option<OrderBookSnapshot>>;
}

/// PostgreSQL storage implementation
pub struct PostgresStorage {
    pool: PgPool,
}

impl PostgresStorage {
    /// Create new PostgreSQL storage
    pub async fn new(database_url: &str) -> ClobResult<Self> {
        let pool = PgPool::connect(database_url)
            .await
            .map_err(|e| ClobError::StorageError(e.to_string()))?;
        
        // Run migrations
        sqlx::migrate!("./migrations")
            .run(&pool)
            .await
            .map_err(|e| ClobError::StorageError(e.to_string()))?;
        
        Ok(Self { pool })
    }
}

#[async_trait]
impl Storage for PostgresStorage {
    async fn store_order(&self, order: &Order) -> ClobResult<()> {
        sqlx::query!(
            r#"
            INSERT INTO orders (
                order_id, owner, price, quantity, remaining_quantity, 
                timestamp, client_order_id, expiry_timestamp, side, 
                order_type, status, self_trade_behavior, time_in_force
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            "#,
            order.order_id as i64,
            order.owner.to_string(),
            order.price as i64,
            order.quantity as i64,
            order.remaining_quantity as i64,
            order.timestamp,
            order.client_order_id as i64,
            order.expiry_timestamp,
            order.side as i16,
            order.order_type as i16,
            order.status as i16,
            order.self_trade_behavior as i16,
            order.time_in_force as i16
        )
        .execute(&self.pool)
        .await
        .map_err(|e| ClobError::StorageError(e.to_string()))?;
        
        info!("Stored order {}", order.order_id);
        Ok(())
    }
    
    async fn update_order(&self, order: &Order) -> ClobResult<()> {
        sqlx::query!(
            r#"
            UPDATE orders SET 
                remaining_quantity = $1, 
                status = $2
            WHERE order_id = $3
            "#,
            order.remaining_quantity as i64,
            order.status as i16,
            order.order_id as i64
        )
        .execute(&self.pool)
        .await
        .map_err(|e| ClobError::StorageError(e.to_string()))?;
        
        Ok(())
    }
    
    async fn get_order(&self, order_id: u64) -> ClobResult<Option<Order>> {
        let row = sqlx::query!(
            "SELECT * FROM orders WHERE order_id = $1",
            order_id as i64
        )
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| ClobError::StorageError(e.to_string()))?;
        
        if let Some(row) = row {
            Ok(Some(Order {
                order_id: row.order_id as u64,
                owner: row.owner.parse().map_err(|e| ClobError::StorageError(format!("Invalid pubkey: {}", e)))?,
                price: row.price as u64,
                quantity: row.quantity as u64,
                remaining_quantity: row.remaining_quantity as u64,
                timestamp: row.timestamp,
                client_order_id: row.client_order_id as u64,
                expiry_timestamp: row.expiry_timestamp,
                side: OrderSide::try_from(row.side as u8).map_err(|_| ClobError::InvalidOrderSide)?,
                order_type: OrderType::try_from(row.order_type as u8).map_err(|_| ClobError::InvalidOrderType)?,
                status: OrderStatus::try_from(row.status as u8).map_err(|_| ClobError::StorageError("Invalid status".to_string()))?,
                self_trade_behavior: SelfTradeBehavior::try_from(row.self_trade_behavior as u8).map_err(|_| ClobError::StorageError("Invalid self trade behavior".to_string()))?,
                time_in_force: TimeInForce::try_from(row.time_in_force as u8).map_err(|_| ClobError::StorageError("Invalid time in force".to_string()))?,
            }))
        } else {
            Ok(None)
        }
    }

    async fn get_user_orders(&self, user_id: &str) -> ClobResult<Vec<Order>> {
        let rows = sqlx::query!(
            "SELECT * FROM orders WHERE owner = $1 ORDER BY timestamp DESC",
            user_id
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| ClobError::StorageError(e.to_string()))?;

        let mut orders = Vec::new();
        for row in rows {
            orders.push(Order {
                order_id: row.order_id as u64,
                owner: row.owner.parse().map_err(|e| ClobError::StorageError(format!("Invalid pubkey: {}", e)))?,
                price: row.price as u64,
                quantity: row.quantity as u64,
                remaining_quantity: row.remaining_quantity as u64,
                timestamp: row.timestamp,
                client_order_id: row.client_order_id as u64,
                expiry_timestamp: row.expiry_timestamp,
                side: OrderSide::try_from(row.side as u8).map_err(|_| ClobError::InvalidOrderSide)?,
                order_type: OrderType::try_from(row.order_type as u8).map_err(|_| ClobError::InvalidOrderType)?,
                status: OrderStatus::try_from(row.status as u8).map_err(|_| ClobError::StorageError("Invalid status".to_string()))?,
                self_trade_behavior: SelfTradeBehavior::try_from(row.self_trade_behavior as u8).map_err(|_| ClobError::StorageError("Invalid self trade behavior".to_string()))?,
                time_in_force: TimeInForce::try_from(row.time_in_force as u8).map_err(|_| ClobError::StorageError("Invalid time in force".to_string()))?,
            });
        }
        Ok(orders)
    }
    
    async fn store_trade(&self, trade: &TradeExecution) -> ClobResult<()> {
        sqlx::query!(
            r#"
            INSERT INTO trades (
                maker_order_id, taker_order_id, price, quantity, 
                timestamp, maker_side
            ) VALUES ($1, $2, $3, $4, $5, $6)
            "#,
            trade.maker_order_id as i64,
            trade.taker_order_id as i64,
            trade.price as i64,
            trade.quantity as i64,
            trade.timestamp,
            trade.maker_side as i16
        )
        .execute(&self.pool)
        .await
        .map_err(|e| ClobError::StorageError(e.to_string()))?;
        
        info!("Stored trade: maker {} taker {}", trade.maker_order_id, trade.taker_order_id);
        Ok(())
    }
    
    async fn get_recent_trades(&self, limit: u32) -> ClobResult<Vec<TradeExecution>> {
        let rows = sqlx::query!(
            "SELECT * FROM trades ORDER BY timestamp DESC LIMIT $1",
            limit as i64
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| ClobError::StorageError(e.to_string()))?;
        
        let mut trades = Vec::new();
        for row in rows {
            trades.push(TradeExecution {
                maker_order_id: row.maker_order_id as u64,
                taker_order_id: row.taker_order_id as u64,
                price: row.price as u64,
                quantity: row.quantity as u64,
                timestamp: row.timestamp,
                maker_side: OrderSide::try_from(row.maker_side as u8).map_err(|_| ClobError::InvalidOrderSide)?,
            });
        }
        
        Ok(trades)
    }
    
    async fn store_orderbook_snapshot(&self, snapshot: &OrderBookSnapshot) -> ClobResult<()> {
        let bids_json = serde_json::to_string(&snapshot.bids)
            .map_err(|e| ClobError::SerializationError(e.to_string()))?;
        let asks_json = serde_json::to_string(&snapshot.asks)
            .map_err(|e| ClobError::SerializationError(e.to_string()))?;
        
        sqlx::query!(
            r#"
            INSERT INTO orderbook_snapshots (
                sequence_number, timestamp, bids, asks
            ) VALUES ($1, $2, $3, $4)
            "#,
            snapshot.sequence_number as i64,
            snapshot.timestamp,
            bids_json,
            asks_json
        )
        .execute(&self.pool)
        .await
        .map_err(|e| ClobError::StorageError(e.to_string()))?;
        
        Ok(())
    }
    
    async fn get_latest_orderbook_snapshot(&self) -> ClobResult<Option<OrderBookSnapshot>> {
        let row = sqlx::query!(
            "SELECT * FROM orderbook_snapshots ORDER BY sequence_number DESC LIMIT 1"
        )
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| ClobError::StorageError(e.to_string()))?;
        
        if let Some(row) = row {
            let bids: Vec<(u64, u64)> = serde_json::from_str(&row.bids)
                .map_err(|e| ClobError::SerializationError(e.to_string()))?;
            let asks: Vec<(u64, u64)> = serde_json::from_str(&row.asks)
                .map_err(|e| ClobError::SerializationError(e.to_string()))?;
            
            Ok(Some(OrderBookSnapshot {
                bids,
                asks,
                sequence_number: row.sequence_number as u64,
                timestamp: row.timestamp,
            }))
        } else {
            Ok(None)
        }
    }
}

/// Redis storage for fast caching and real-time data
pub struct RedisStorage {
    client: redis::Client,
}

impl RedisStorage {
    /// Create new Redis storage
    pub fn new(redis_url: &str) -> ClobResult<Self> {
        let client = redis::Client::open(redis_url)
            .map_err(|e| ClobError::StorageError(e.to_string()))?;
        
        Ok(Self { client })
    }
    
    /// Cache order book snapshot in Redis
    pub async fn cache_orderbook_snapshot(&self, snapshot: &OrderBookSnapshot) -> ClobResult<()> {
        let mut conn = self.client.get_async_connection()
            .await
            .map_err(|e| ClobError::StorageError(e.to_string()))?;
        
        let snapshot_json = serde_json::to_string(snapshot)
            .map_err(|e| ClobError::SerializationError(e.to_string()))?;
        
        conn.set("orderbook:latest", &snapshot_json)
            .await
            .map_err(|e| ClobError::StorageError(e.to_string()))?;
        
        // Set expiry for cache
        conn.expire("orderbook:latest", 300)
            .await
            .map_err(|e| ClobError::StorageError(e.to_string()))?;
        
        Ok(())
    }
    
    /// Get cached order book snapshot
    pub async fn get_cached_orderbook_snapshot(&self) -> ClobResult<Option<OrderBookSnapshot>> {
        let mut conn = self.client.get_async_connection()
            .await
            .map_err(|e| ClobError::StorageError(e.to_string()))?;
        
        let snapshot_json: Option<String> = conn.get("orderbook:latest")
            .await
            .map_err(|e| ClobError::StorageError(e.to_string()))?;
        
        if let Some(json) = snapshot_json {
            let snapshot = serde_json::from_str(&json)
                .map_err(|e| ClobError::SerializationError(e.to_string()))?;
            Ok(Some(snapshot))
        } else {
            Ok(None)
        }
    }
}

// Add trait implementations for common conversions
impl TryFrom<u8> for OrderSide {
    type Error = ();
    
    fn try_from(value: u8) -> Result<Self, Self::Error> {
        match value {
            0 => Ok(OrderSide::Bid),
            1 => Ok(OrderSide::Ask),
            _ => Err(()),
        }
    }
}

impl TryFrom<u8> for OrderType {
    type Error = ();
    
    fn try_from(value: u8) -> Result<Self, Self::Error> {
        match value {
            0 => Ok(OrderType::Limit),
            1 => Ok(OrderType::Market),
            2 => Ok(OrderType::PostOnly),
            _ => Err(()),
        }
    }
}

impl TryFrom<u8> for OrderStatus {
    type Error = ();
    
    fn try_from(value: u8) -> Result<Self, Self::Error> {
        match value {
            0 => Ok(OrderStatus::Open),
            1 => Ok(OrderStatus::PartiallyFilled),
            2 => Ok(OrderStatus::Filled),
            3 => Ok(OrderStatus::Cancelled),
            4 => Ok(OrderStatus::Expired),
            _ => Err(()),
        }
    }
}

impl TryFrom<u8> for SelfTradeBehavior {
    type Error = ();
    
    fn try_from(value: u8) -> Result<Self, Self::Error> {
        match value {
            0 => Ok(SelfTradeBehavior::DecrementAndCancel),
            1 => Ok(SelfTradeBehavior::CancelProvide),
            2 => Ok(SelfTradeBehavior::CancelTake),
            3 => Ok(SelfTradeBehavior::CancelBoth),
            _ => Err(()),
        }
    }
}

impl TryFrom<u8> for TimeInForce {
    type Error = ();
    
    fn try_from(value: u8) -> Result<Self, Self::Error> {
        match value {
            0 => Ok(TimeInForce::GoodTillCancelled),
            1 => Ok(TimeInForce::ImmediateOrCancel),
            2 => Ok(TimeInForce::FillOrKill),
            3 => Ok(TimeInForce::GoodTillTime),
            _ => Err(()),
        }
    }
}