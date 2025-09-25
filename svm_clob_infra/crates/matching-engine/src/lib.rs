/// Matching Engine for SVM CLOB Infrastructure
/// 
/// This module implements the core order matching logic with price-time priority
/// and self-trade prevention, designed to interface with the SVM CLOB smart contract.

use svm_clob_types::*;
use svm_clob_order_book::OrderBookManager;
use svm_clob_storage::Storage;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn, error};

/// Main matching engine that processes orders and executes trades
pub struct MatchingEngine<S: Storage> {
    /// Order book manager for price-level operations
    order_book: Arc<RwLock<OrderBookManager>>,
    /// Storage layer for persistence
    storage: Arc<S>,
    /// Current orderbook configuration
    orderbook_config: OrderBook,
}

impl<S: Storage> MatchingEngine<S> {
    /// Create a new matching engine instance
    pub fn new(storage: Arc<S>, orderbook_config: OrderBook) -> Self {
        Self {
            order_book: Arc::new(RwLock::new(OrderBookManager::new(
                orderbook_config.tick_size,
                orderbook_config.min_order_size,
            ))),
            storage,
            orderbook_config,
        }
    }

    /// Process a new order placement
    pub async fn place_order(&self, mut order: Order) -> ClobResult<Vec<TradeExecution>> {
        info!("Processing order placement: ID {}", order.order_id);

        // Validate order parameters
        self.validate_order(&order)?;

        let mut trades = Vec::new();
        let mut order_book = self.order_book.write().await;

        match order.order_type {
            OrderType::Market => {
                trades = self.execute_market_order(&mut order_book, &mut order).await?;
            }
            OrderType::Limit => {
                trades = self.execute_limit_order(&mut order_book, &mut order).await?;
            }
            OrderType::PostOnly => {
                if self.would_match_immediately(&order_book, &order).await? {
                    return Err(ClobError::PostOnlyOrderWouldMatch);
                }
                order_book.add_order(order.clone())?;
            }
        }

        // Persist order and trades
        self.storage.store_order(&order).await?;
        for trade in &trades {
            self.storage.store_trade(trade).await?;
        }

        info!("Order processed: {} trades executed", trades.len());
        Ok(trades)
    }

    /// Cancel an existing order
    pub async fn cancel_order(&self, order_id: u64) -> ClobResult<Order> {
        info!("Canceling order: {}", order_id);

        let mut order_book = self.order_book.write().await;
        let order = order_book.remove_order(order_id)?;
        
        // Update order status and persist
        let mut cancelled_order = order;
        cancelled_order.status = OrderStatus::Cancelled;
        self.storage.update_order(&cancelled_order).await?;

        info!("Order cancelled: {}", order_id);
        Ok(cancelled_order)
    }

    /// Get current order book snapshot
    pub async fn get_order_book_snapshot(&self) -> ClobResult<OrderBookSnapshot> {
        let order_book = self.order_book.read().await;
        Ok(order_book.get_snapshot())
    }

    /// Execute market order with immediate matching
    async fn execute_market_order(
        &self,
        order_book: &mut OrderBookManager,
        order: &mut Order,
    ) -> ClobResult<Vec<TradeExecution>> {
        let mut trades = Vec::new();
        let current_time = chrono::Utc::now().timestamp();

        // Get matching orders from opposite side
        let matching_orders = match order.side {
            OrderSide::Bid => order_book.get_asks_up_to_price(u64::MAX)?,
            OrderSide::Ask => order_book.get_bids_down_to_price(0)?,
        };

        for matching_order in matching_orders {
            if order.remaining_quantity == 0 {
                break;
            }

            // Check for self-trade
            if self.is_self_trade(order, &matching_order) {
                self.handle_self_trade(order_book, order, &matching_order)?;
                continue;
            }

            // Execute trade
            let trade_quantity = order.remaining_quantity.min(matching_order.remaining_quantity);
            let trade_price = matching_order.price; // Market orders take maker price

            let trade = TradeExecution {
                maker_order_id: matching_order.order_id,
                taker_order_id: order.order_id,
                price: trade_price,
                quantity: trade_quantity,
                timestamp: current_time,
                maker_side: matching_order.side,
            };

            trades.push(trade);

            // Update order quantities
            order.remaining_quantity -= trade_quantity;
            
            // Update maker order in book
            order_book.update_order_quantity(matching_order.order_id, 
                                           matching_order.remaining_quantity - trade_quantity)?;
        }

        // Update order status based on remaining quantity
        if order.remaining_quantity == 0 {
            order.status = OrderStatus::Filled;
        } else if order.remaining_quantity < order.quantity {
            order.status = OrderStatus::PartiallyFilled;
        }

        // Market orders that can't be fully filled are cancelled (IOC behavior)
        if order.remaining_quantity > 0 && order.time_in_force == TimeInForce::ImmediateOrCancel {
            order.status = OrderStatus::Cancelled;
        }

        Ok(trades)
    }

    /// Execute limit order with price-time matching
    async fn execute_limit_order(
        &self,
        order_book: &mut OrderBookManager,
        order: &mut Order,
    ) -> ClobResult<Vec<TradeExecution>> {
        let mut trades = Vec::new();
        let current_time = chrono::Utc::now().timestamp();

        // Get matching orders within price range
        let matching_orders = match order.side {
            OrderSide::Bid => order_book.get_asks_up_to_price(order.price)?,
            OrderSide::Ask => order_book.get_bids_down_to_price(order.price)?,
        };

        for matching_order in matching_orders {
            if order.remaining_quantity == 0 {
                break;
            }

            // Check price compatibility
            let can_match = match order.side {
                OrderSide::Bid => order.price >= matching_order.price,
                OrderSide::Ask => order.price <= matching_order.price,
            };

            if !can_match {
                break;
            }

            // Check for self-trade
            if self.is_self_trade(order, &matching_order) {
                self.handle_self_trade(order_book, order, &matching_order)?;
                continue;
            }

            // Execute trade at maker price
            let trade_quantity = order.remaining_quantity.min(matching_order.remaining_quantity);
            let trade_price = matching_order.price;

            let trade = TradeExecution {
                maker_order_id: matching_order.order_id,
                taker_order_id: order.order_id,
                price: trade_price,
                quantity: trade_quantity,
                timestamp: current_time,
                maker_side: matching_order.side,
            };

            trades.push(trade);

            // Update order quantities
            order.remaining_quantity -= trade_quantity;
            
            // Update maker order in book
            order_book.update_order_quantity(matching_order.order_id,
                                           matching_order.remaining_quantity - trade_quantity)?;
        }

        // Update order status
        if order.remaining_quantity == 0 {
            order.status = OrderStatus::Filled;
        } else if order.remaining_quantity < order.quantity {
            order.status = OrderStatus::PartiallyFilled;
        }

        // Handle time in force for unfilled portions
        match order.time_in_force {
            TimeInForce::FillOrKill => {
                if order.remaining_quantity > 0 {
                    order.status = OrderStatus::Cancelled;
                    return Ok(Vec::new()); // Cancel all trades for FOK
                }
            }
            TimeInForce::ImmediateOrCancel => {
                if order.remaining_quantity > 0 {
                    order.status = OrderStatus::Cancelled;
                }
            }
            TimeInForce::GoodTillCancelled | TimeInForce::GoodTillTime => {
                // Add remaining order to book if not fully filled
                if order.remaining_quantity > 0 {
                    order_book.add_order(order.clone())?;
                }
            }
        }

        Ok(trades)
    }

    /// Check if an order would match immediately (for PostOnly validation)
    async fn would_match_immediately(
        &self,
        order_book: &OrderBookManager,
        order: &Order,
    ) -> ClobResult<bool> {
        let best_opposite = match order.side {
            OrderSide::Bid => order_book.get_best_ask(),
            OrderSide::Ask => order_book.get_best_bid(),
        };

        if let Some(best_price) = best_opposite {
            match order.side {
                OrderSide::Bid => Ok(order.price >= best_price),
                OrderSide::Ask => Ok(order.price <= best_price),
            }
        } else {
            Ok(false)
        }
    }

    /// Check if two orders would constitute a self-trade
    fn is_self_trade(&self, order1: &Order, order2: &Order) -> bool {
        order1.owner == order2.owner
    }

    /// Handle self-trade prevention based on configured behavior
    fn handle_self_trade(
        &self,
        order_book: &mut OrderBookManager,
        taker_order: &mut Order,
        maker_order: &Order,
    ) -> ClobResult<()> {
        match taker_order.self_trade_behavior {
            SelfTradeBehavior::DecrementAndCancel => {
                // Cancel the smaller order
                if taker_order.remaining_quantity <= maker_order.remaining_quantity {
                    taker_order.status = OrderStatus::Cancelled;
                } else {
                    order_book.remove_order(maker_order.order_id)?;
                }
            }
            SelfTradeBehavior::CancelProvide => {
                // Cancel the resting (maker) order
                order_book.remove_order(maker_order.order_id)?;
            }
            SelfTradeBehavior::CancelTake => {
                // Cancel the incoming (taker) order
                taker_order.status = OrderStatus::Cancelled;
            }
            SelfTradeBehavior::CancelBoth => {
                // Cancel both orders
                taker_order.status = OrderStatus::Cancelled;
                order_book.remove_order(maker_order.order_id)?;
            }
        }

        warn!("Self-trade prevented between orders {} and {}", 
              taker_order.order_id, maker_order.order_id);
        Ok(())
    }

    /// Validate order parameters against orderbook configuration
    fn validate_order(&self, order: &Order) -> ClobResult<()> {
        // Check minimum order size
        if order.quantity < self.orderbook_config.min_order_size {
            return Err(ClobError::OrderSizeBelowMinimum);
        }

        // Check tick size alignment
        if order.price % self.orderbook_config.tick_size != 0 {
            return Err(ClobError::PriceNotAlignedToTickSize);
        }

        // Check if orderbook is paused
        if self.orderbook_config.is_paused {
            return Err(ClobError::OrderbookPaused);
        }

        // Check expiry for time-based orders
        if order.time_in_force == TimeInForce::GoodTillTime {
            let current_time = chrono::Utc::now().timestamp();
            if order.expiry_timestamp <= current_time {
                return Err(ClobError::OrderExpired);
            }
        }

        Ok(())
    }
}