//! This module defines the placeholder interfaces for the off-chain matching engine.

use anchor_lang::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};

/// A placeholder for the off-chain matching engine API.
/// In a real implementation, this would be a client for a REST or gRPC API.
pub trait MatchingEngine {
    /// Places a new order in the order book.
    fn place_order(&mut self, order: Order) -> Result<()>;

    /// Cancels an existing order.
    fn cancel_order(&mut self, order_id: u64) -> Result<()>;

    /// Retrieves the current state of the order book.
    fn get_order_book_snapshot(&self) -> Result<OrderBookSnapshot>;
}

/// Represents a single order in the system.
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, Copy, PartialEq, Eq)]
pub struct Order {
    pub order_id: u64,
    pub owner: Pubkey,
    pub price: u64,
    pub quantity: u64,
    pub side: OrderSide,
    pub order_type: OrderType,
    pub timestamp: i64,
}

/// Represents a snapshot of the order book at a specific point in time.
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq, Eq)]
pub struct OrderBookSnapshot {
    pub bids: Vec<(u64, u64)>, // (price, quantity)
    pub asks: Vec<(u64, u64)>, // (price, quantity)
    pub sequence_number: u64,
}

use anchor_lang::{AnchorDeserialize, AnchorSerialize};
/// Represents a trade that has been executed by the matching engine.
#[derive(Debug, Clone, Copy, PartialEq, Eq, AnchorSerialize, AnchorDeserialize)]
pub struct Trade {
    pub taker_order_id: u64,
    pub maker_order_id: u64,
    pub taker: Pubkey,
    pub maker: Pubkey,
    pub price: u64,
    pub quantity: u64,
    pub taker_side: OrderSide,
    pub timestamp: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum OrderSide {
    Bid = 0,
    Ask = 1,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum OrderType {
    Limit = 0,
    Market = 1,
}
