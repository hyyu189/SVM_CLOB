/// Types module for SVM CLOB Infrastructure
/// 
/// This module contains all the core types and structures used throughout the CLOB infrastructure,
/// ensuring compatibility with the SVM CLOB smart contract interface.

use anchor_lang::prelude::*;
use serde::{Deserialize, Serialize};
use solana_sdk::pubkey::Pubkey;
use std::fmt;
use thiserror::Error;

// Re-export contract types for compatibility
pub use anchor_lang::{AnchorDeserialize, AnchorSerialize};

/// Order side enumeration - matches contract exactly
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum OrderSide {
    Bid = 0,  // Buy order
    Ask = 1,  // Sell order
}

/// Order type enumeration - matches contract exactly
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum OrderType {
    Limit = 0,    // Limit order
    Market = 1,   // Market order
    PostOnly = 2, // Post-only limit order
}

/// Order status enumeration - matches contract exactly
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum OrderStatus {
    Open = 0,        // Order is active
    PartiallyFilled = 1, // Order is partially executed
    Filled = 2,      // Order is completely executed
    Cancelled = 3,   // Order is cancelled
    Expired = 4,     // Order has expired
}

/// Self-trade prevention behavior - matches contract exactly
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum SelfTradeBehavior {
    DecrementAndCancel = 0, // Cancel the smaller order
    CancelProvide = 1,      // Cancel the resting order
    CancelTake = 2,         // Cancel the incoming order
    CancelBoth = 3,         // Cancel both orders
}

/// Time in force enumeration - matches contract exactly
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum TimeInForce {
    GoodTillCancelled = 0, // GTC - remains until cancelled
    ImmediateOrCancel = 1, // IOC - execute immediately or cancel
    FillOrKill = 2,        // FOK - execute completely or cancel
    GoodTillTime = 3,      // GTT - remains until expiry time
}

/// Core order structure that mirrors the contract Order struct
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Order {
    /// Unique order ID
    pub order_id: u64,
    /// Owner of the order
    pub owner: Pubkey,
    /// Price in ticks
    pub price: u64,
    /// Original quantity
    pub quantity: u64,
    /// Remaining quantity
    pub remaining_quantity: u64,
    /// Timestamp when order was created
    pub timestamp: i64,
    /// Client order ID for tracking
    pub client_order_id: u64,
    /// Expiry timestamp (0 for GTC)
    pub expiry_timestamp: i64,
    /// Order side (bid/ask)
    pub side: OrderSide,
    /// Order type (limit/market)
    pub order_type: OrderType,
    /// Order status
    pub status: OrderStatus,
    /// Self-trade prevention mode
    pub self_trade_behavior: SelfTradeBehavior,
    /// Time in force
    pub time_in_force: TimeInForce,
}

/// OrderBook structure that mirrors the contract
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct OrderBook {
    /// Authority that can manage the orderbook
    pub authority: Pubkey,
    /// Base token mint
    pub base_mint: Pubkey,
    /// Quote token mint  
    pub quote_mint: Pubkey,
    /// Minimum price increment
    pub tick_size: u64,
    /// Minimum order size
    pub min_order_size: u64,
    /// Global sequence number for orders
    pub sequence_number: u64,
    /// Total number of orders
    pub total_orders: u64,
    /// Best bid price
    pub best_bid: u64,
    /// Best ask price
    pub best_ask: u64,
    /// Total volume traded
    pub total_volume: u64,
    /// Whether orderbook is initialized
    pub is_initialized: bool,
    /// Whether trading is paused
    pub is_paused: bool,
}

/// User account structure that mirrors the contract
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct UserAccount {
    /// Owner of the account
    pub owner: Pubkey,
    /// Number of open orders
    pub open_orders_count: u64,
    /// Total orders placed by user
    pub total_orders_placed: u64,
    /// Total volume traded by user
    pub total_volume_traded: u64,
    /// Whether account is initialized
    pub is_initialized: bool,
}

/// Price level in the orderbook
#[derive(Serialize, Deserialize, Debug, Clone, Copy)]
pub struct PriceLevel {
    /// Price at this level
    pub price: u64,
    /// Total quantity at this level
    pub quantity: u64,
    /// Number of orders at this level
    pub order_count: u32,
}

/// Trade execution result
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TradeExecution {
    /// Maker order ID
    pub maker_order_id: u64,
    /// Taker order ID  
    pub taker_order_id: u64,
    /// Execution price
    pub price: u64,
    /// Execution quantity
    pub quantity: u64,
    /// Timestamp of execution
    pub timestamp: i64,
    /// Maker side
    pub maker_side: OrderSide,
}

/// Order book snapshot for API responses
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct OrderBookSnapshot {
    /// Bid price levels (price, quantity)
    pub bids: Vec<(u64, u64)>,
    /// Ask price levels (price, quantity)
    pub asks: Vec<(u64, u64)>,
    /// Sequence number for ordering updates
    pub sequence_number: u64,
    /// Timestamp of the snapshot
    pub timestamp: i64,
}

/// Market data update for WebSocket feeds
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct MarketDataUpdate {
    /// Update type
    pub update_type: MarketDataUpdateType,
    /// Updated order book snapshot (optional)
    pub order_book: Option<OrderBookSnapshot>,
    /// Trade execution (optional)
    pub trade: Option<TradeExecution>,
    /// Updated order (optional)
    pub order: Option<Order>,
    /// Timestamp of the update
    pub timestamp: i64,
}

/// Market data update types
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
pub enum MarketDataUpdateType {
    OrderBookUpdate,
    TradeExecution,
    OrderUpdate,
}

/// Request structures for RPC API

/// Place order request
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PlaceOrderRequest {
    pub client_order_id: u64,
    pub side: OrderSide,
    pub order_type: OrderType,
    pub price: u64,
    pub quantity: u64,
    pub time_in_force: TimeInForce,
    pub expiry_timestamp: Option<i64>,
    pub self_trade_behavior: SelfTradeBehavior,
}

/// Cancel order request
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CancelOrderRequest {
    pub order_id: Option<u64>,
    pub client_order_id: Option<u64>,
}

/// Modify order request
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ModifyOrderRequest {
    pub order_id: Option<u64>,
    pub client_order_id: Option<u64>,
    pub new_price: Option<u64>,
    pub new_quantity: Option<u64>,
}

/// Error types for the infrastructure
#[derive(Error, Debug)]
pub enum ClobError {
    #[error("Invalid order side")]
    InvalidOrderSide,
    #[error("Invalid order type")]
    InvalidOrderType,
    #[error("Invalid price: {0}")]
    InvalidPrice(String),
    #[error("Invalid quantity: {0}")]
    InvalidQuantity(String),
    #[error("Order size below minimum")]
    OrderSizeBelowMinimum,
    #[error("Price not aligned to tick size")]
    PriceNotAlignedToTickSize,
    #[error("Orderbook is paused")]
    OrderbookPaused,
    #[error("Insufficient balance")]
    InsufficientBalance,
    #[error("Order not found")]
    OrderNotFound,
    #[error("Unauthorized")]
    Unauthorized,
    #[error("Self trade detected")]
    SelfTradeDetected,
    #[error("Order expired")]
    OrderExpired,
    #[error("Market order would cross spread")]
    MarketOrderWouldCrossSpread,
    #[error("Post-only order would match")]
    PostOnlyOrderWouldMatch,
    #[error("Storage error: {0}")]
    StorageError(String),
    #[error("Network error: {0}")]
    NetworkError(String),
    #[error("Serialization error: {0}")]
    SerializationError(String),
}

/// Result type for CLOB operations
pub type ClobResult<T> = Result<T, ClobError>;

/// Display implementations for better logging
impl fmt::Display for OrderSide {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            OrderSide::Bid => write!(f, "Bid"),
            OrderSide::Ask => write!(f, "Ask"),
        }
    }
}

impl fmt::Display for OrderType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            OrderType::Limit => write!(f, "Limit"),
            OrderType::Market => write!(f, "Market"),
            OrderType::PostOnly => write!(f, "PostOnly"),
        }
    }
}

impl fmt::Display for OrderStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            OrderStatus::Open => write!(f, "Open"),
            OrderStatus::PartiallyFilled => write!(f, "PartiallyFilled"),
            OrderStatus::Filled => write!(f, "Filled"),
            OrderStatus::Cancelled => write!(f, "Cancelled"),
            OrderStatus::Expired => write!(f, "Expired"),
        }
    }
}