/// Order Book Management for SVM CLOB Infrastructure
/// 
/// This module implements efficient order book operations with price-level tracking
/// and fast order lookup, designed to match the SVM CLOB contract interface.

use svm_clob_types::*;
use dashmap::DashMap;
use std::collections::BTreeMap;
use std::sync::Arc;
use tracing::{info, warn, debug};

/// Order book manager for efficient price-level operations
pub struct OrderBookManager {
    /// Bid orders organized by price level (descending)
    bid_levels: BTreeMap<u64, PriceLevel>,
    /// Ask orders organized by price level (ascending)  
    ask_levels: BTreeMap<u64, PriceLevel>,
    /// Fast order lookup by order ID
    orders: DashMap<u64, Order>,
    /// Configuration parameters
    tick_size: u64,
    min_order_size: u64,
    /// Current sequence number for snapshots
    sequence_number: u64,
}

impl OrderBookManager {
    /// Create a new order book manager
    pub fn new(tick_size: u64, min_order_size: u64) -> Self {
        Self {
            bid_levels: BTreeMap::new(),
            ask_levels: BTreeMap::new(),
            orders: DashMap::new(),
            tick_size,
            min_order_size,
            sequence_number: 0,
        }
    }

    /// Add a new order to the book
    pub fn add_order(&mut self, order: Order) -> ClobResult<()> {
        debug!("Adding order {} to book at price {}", order.order_id, order.price);

        // Validate price alignment
        if order.price % self.tick_size != 0 {
            return Err(ClobError::PriceNotAlignedToTickSize);
        }

        // Add to appropriate side
        match order.side {
            OrderSide::Bid => {
                let level = self.bid_levels.entry(order.price).or_insert(PriceLevel {
                    price: order.price,
                    quantity: 0,
                    order_count: 0,
                });
                level.quantity += order.remaining_quantity;
                level.order_count += 1;
            }
            OrderSide::Ask => {
                let level = self.ask_levels.entry(order.price).or_insert(PriceLevel {
                    price: order.price,
                    quantity: 0,
                    order_count: 0,
                });
                level.quantity += order.remaining_quantity;
                level.order_count += 1;
            }
        }

        // Store order for fast lookup
        self.orders.insert(order.order_id, order);
        self.sequence_number += 1;

        info!("Order {} added to book", order.order_id);
        Ok(())
    }

    /// Remove an order from the book
    pub fn remove_order(&mut self, order_id: u64) -> ClobResult<Order> {
        let order = self.orders.remove(&order_id)
            .ok_or(ClobError::OrderNotFound)?
            .1;

        debug!("Removing order {} from book", order_id);

        // Remove from appropriate side
        match order.side {
            OrderSide::Bid => {
                if let Some(level) = self.bid_levels.get_mut(&order.price) {
                    level.quantity -= order.remaining_quantity;
                    level.order_count -= 1;
                    
                    // Remove empty levels
                    if level.order_count == 0 {
                        self.bid_levels.remove(&order.price);
                    }
                }
            }
            OrderSide::Ask => {
                if let Some(level) = self.ask_levels.get_mut(&order.price) {
                    level.quantity -= order.remaining_quantity;
                    level.order_count -= 1;
                    
                    // Remove empty levels
                    if level.order_count == 0 {
                        self.ask_levels.remove(&order.price);
                    }
                }
            }
        }

        self.sequence_number += 1;
        info!("Order {} removed from book", order_id);
        Ok(order)
    }

    /// Update order quantity (for partial fills)
    pub fn update_order_quantity(&mut self, order_id: u64, new_remaining_quantity: u64) -> ClobResult<()> {
        let mut order_ref = self.orders.get_mut(&order_id)
            .ok_or(ClobError::OrderNotFound)?;
        
        let old_quantity = order_ref.remaining_quantity;
        let quantity_change = old_quantity - new_remaining_quantity;
        
        order_ref.remaining_quantity = new_remaining_quantity;

        // Update price level
        match order_ref.side {
            OrderSide::Bid => {
                if let Some(level) = self.bid_levels.get_mut(&order_ref.price) {
                    level.quantity -= quantity_change;
                    
                    // Remove empty levels
                    if level.quantity == 0 {
                        self.bid_levels.remove(&order_ref.price);
                    }
                }
            }
            OrderSide::Ask => {
                if let Some(level) = self.ask_levels.get_mut(&order_ref.price) {
                    level.quantity -= quantity_change;
                    
                    // Remove empty levels
                    if level.quantity == 0 {
                        self.ask_levels.remove(&order_ref.price);
                    }
                }
            }
        }

        // Update order status if fully filled
        if new_remaining_quantity == 0 {
            order_ref.status = OrderStatus::Filled;
            self.remove_order(order_id)?;
        } else if new_remaining_quantity < order_ref.quantity {
            order_ref.status = OrderStatus::PartiallyFilled;
        }

        self.sequence_number += 1;
        Ok(())
    }

    /// Get best bid price
    pub fn get_best_bid(&self) -> Option<u64> {
        self.bid_levels.keys().last().copied()
    }

    /// Get best ask price
    pub fn get_best_ask(&self) -> Option<u64> {
        self.ask_levels.keys().next().copied()
    }

    /// Get bid orders down to a specific price (for matching)
    pub fn get_bids_down_to_price(&self, min_price: u64) -> ClobResult<Vec<Order>> {
        let mut orders = Vec::new();
        
        for (&price, _level) in self.bid_levels.range(min_price..).rev() {
            for order_entry in self.orders.iter() {
                let order = order_entry.value();
                if order.side == OrderSide::Bid && order.price == price && order.remaining_quantity > 0 {
                    orders.push(order.clone());
                }
            }
            
            // Sort by timestamp for price-time priority
            orders.sort_by_key(|o| o.timestamp);
        }

        Ok(orders)
    }

    /// Get ask orders up to a specific price (for matching)
    pub fn get_asks_up_to_price(&self, max_price: u64) -> ClobResult<Vec<Order>> {
        let mut orders = Vec::new();
        
        for (&price, _level) in self.ask_levels.range(..=max_price) {
            for order_entry in self.orders.iter() {
                let order = order_entry.value();
                if order.side == OrderSide::Ask && order.price == price && order.remaining_quantity > 0 {
                    orders.push(order.clone());
                }
            }
            
            // Sort by timestamp for price-time priority
            orders.sort_by_key(|o| o.timestamp);
        }

        Ok(orders)
    }

    /// Get current order book snapshot
    pub fn get_snapshot(&self) -> OrderBookSnapshot {
        let current_time = chrono::Utc::now().timestamp();
        
        // Convert bid levels to price-quantity pairs (sorted by price desc)
        let bids: Vec<(u64, u64)> = self.bid_levels
            .iter()
            .rev()
            .map(|(&price, level)| (price, level.quantity))
            .collect();

        // Convert ask levels to price-quantity pairs (sorted by price asc)
        let asks: Vec<(u64, u64)> = self.ask_levels
            .iter()
            .map(|(&price, level)| (price, level.quantity))
            .collect();

        OrderBookSnapshot {
            bids,
            asks,
            sequence_number: self.sequence_number,
            timestamp: current_time,
        }
    }

    /// Get order by ID
    pub fn get_order(&self, order_id: u64) -> Option<Order> {
        self.orders.get(&order_id).map(|entry| entry.value().clone())
    }

    /// Get all orders for a specific user
    pub fn get_user_orders(&self, user: &solana_sdk::pubkey::Pubkey) -> Vec<Order> {
        self.orders
            .iter()
            .filter(|entry| &entry.value().owner == user)
            .map(|entry| entry.value().clone())
            .collect()
    }

    /// Get market statistics
    pub fn get_market_stats(&self) -> MarketStats {
        let total_bid_orders = self.bid_levels.values().map(|l| l.order_count as u64).sum();
        let total_ask_orders = self.ask_levels.values().map(|l| l.order_count as u64).sum();
        let total_bid_quantity = self.bid_levels.values().map(|l| l.quantity).sum();
        let total_ask_quantity = self.ask_levels.values().map(|l| l.quantity).sum();

        MarketStats {
            best_bid: self.get_best_bid(),
            best_ask: self.get_best_ask(),
            spread: match (self.get_best_bid(), self.get_best_ask()) {
                (Some(bid), Some(ask)) => Some(ask - bid),
                _ => None,
            },
            total_bid_orders,
            total_ask_orders,
            total_bid_quantity,
            total_ask_quantity,
            price_levels_count: (self.bid_levels.len() + self.ask_levels.len()) as u64,
        }
    }
}

/// Market statistics structure
#[derive(Debug, Clone)]
pub struct MarketStats {
    pub best_bid: Option<u64>,
    pub best_ask: Option<u64>,
    pub spread: Option<u64>,
    pub total_bid_orders: u64,
    pub total_ask_orders: u64,
    pub total_bid_quantity: u64,
    pub total_ask_quantity: u64,
    pub price_levels_count: u64,
}