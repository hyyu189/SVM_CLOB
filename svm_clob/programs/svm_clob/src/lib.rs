use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use borsh::{BorshDeserialize, BorshSerialize};
use bytemuck::{Pod, Zeroable};
use num_derive::FromPrimitive;
use anchor_lang::solana_program::account_info::next_account_info;

declare_id!("7YtJ5eYw1am3m73Yw2sh1QPWek3Ux17Ju1tp263h7YJB");

// Constants for CLOB configuration
pub const MAX_ORDERS_PER_SIDE: usize = 1000;
pub const MAX_PRICE_LEVELS: usize = 500;
pub const ORDER_ACCOUNT_SIZE: usize = 8 + std::mem::size_of::<Order>();
pub const ORDERBOOK_ACCOUNT_SIZE: usize = 8 + std::mem::size_of::<OrderBook>();
pub const USER_ACCOUNT_SIZE: usize = 8 + std::mem::size_of::<UserAccount>();

#[program]
        pub mod svm_clob {
            use super::*;

            /// Executes a trade between a taker and a maker order
            fn execute_match<'info>(
                taker_order: &mut AccountLoader<'info, Order>,
                maker_order: &mut AccountLoader<'info, Order>,
                orderbook: &mut AccountLoader<'info, OrderBook>,
                taker_user: &mut AccountLoader<'info, UserAccount>,
                maker_user: &mut AccountLoader<'info, UserAccount>,
            ) -> Result<()> {
                let taker = &mut taker_order.load_mut()?;
                let maker = &mut maker_order.load_mut()?;
                let ob = &mut orderbook.load_mut()?;
                let taker_ua = &mut taker_user.load_mut()?;
                let maker_ua = &mut maker_user.load_mut()?;

                // Determine fill quantity
                let fill_quantity = min(taker.remaining_quantity, maker.remaining_quantity);
                require!(fill_quantity > 0, ClobError::InvalidQuantity);

                // Update order quantities
                taker.remaining_quantity -= fill_quantity;
                maker.remaining_quantity -= fill_quantity;

                // Update order statuses
                taker.status = if taker.remaining_quantity == 0 {
                    OrderStatus::Filled as u8
                } else {
                    OrderStatus::PartiallyFilled as u8
                };
                maker.status = if maker.remaining_quantity == 0 {
                    OrderStatus::Filled as u8
                } else {
                    OrderStatus::PartiallyFilled as u8
                };

                // Update orderbook and user stats
                ob.total_volume += fill_quantity;
                taker_ua.total_volume_traded += fill_quantity;
                maker_ua.total_volume_traded += fill_quantity;

                // Decrement maker's open orders if filled
                if maker.status == OrderStatus::Filled as u8 {
                    maker_ua.open_orders_count -= 1;
                }

                msg!(
                    "Trade executed: Taker OID {}, Maker OID {}, Qty {}, Price {}",
                    taker.order_id,
                    maker.order_id,
                    fill_quantity,
                    maker.price
                );

                Ok(())
            }

            pub fn initialize_orderbook(
                ctx: Context<InitializeOrderbook>,
                base_mint: Pubkey,k_size: u64,
        min_order_size: u64,
        authority: Pubkey,
    ) -> Result<()> {
        let orderbook = &mut ctx.accounts.orderbook.load_init()?;
        orderbook.authority = authority;
        orderbook.base_mint = base_mint;
        orderbook.quote_mint = quote_mint;
        orderbook.tick_size = tick_size;
        orderbook.min_order_size = min_order_size;
        orderbook.sequence_number = 0;
        orderbook.is_initialized = 1; // Use u8 instead of bool
        orderbook.is_paused = 0; // Use u8 instead of bool
        orderbook.total_orders = 0;
        orderbook.best_bid = 0;
        orderbook.best_ask = u64::MAX;
        orderbook.total_volume = 0;
        
        msg!("Orderbook initialized with base: {:?}, quote: {:?}", base_mint, quote_mint);
        Ok(())
    }

    pub fn initialize_user_account(ctx: Context<InitializeUserAccount>) -> Result<()> {
        let user_account = &mut ctx.accounts.user_account.load_init()?;
        user_account.owner = ctx.accounts.user.key();
        user_account.open_orders_count = 0;
        user_account.base_token_balance = 0;
        user_account.quote_token_balance = 0;
        user_account.is_initialized = 1; // Use u8 instead of bool
        user_account.total_orders_placed = 0;
        user_account.total_volume_traded = 0;
        
        msg!("User account initialized for: {:?}", ctx.accounts.user.key());
        Ok(())
    }

    pub fn place_order(
        ctx: Context<PlaceOrder>,
        client_order_id: u64,
        side: u8, // 0 = Bid, 1 = Ask
        order_type: u8, // 0 = Limit, 1 = Market, 2 = PostOnly
        price: u64,
        quantity: u64,
        time_in_force: u8, // 0 = GTC, 1 = IOC, 2 = FOK, 3 = GTT
        expiry_timestamp: i64,
        self_trade_behavior: u8, // 0 = DecrementAndCancel, 1 = CancelProvide, 2 = CancelTake, 3 = CancelBoth
        slippage: Option<u64>,
    ) -> Result<()> {
        let clock = Clock::get()?;
        let orderbook = &mut ctx.accounts.orderbook.load_mut()?;
        let user_account = &mut ctx.accounts.user_account.load_mut()?;
        
        // Validate orderbook is not paused
        require!(orderbook.is_paused == 0, ClobError::OrderbookPaused);
        
        // Validate order parameters
        require!(side <= 1, ClobError::InvalidOrderSide);
        require!(order_type <= 2, ClobError::InvalidOrderType);
        
        if order_type == 1 { // Market order
            if let Some(s) = slippage {
                if side == 0 { // Bid
                    require!(price >= orderbook.best_ask.saturating_sub(s), ClobError::SlippageExceeded);
                } else { // Ask
                    require!(price <= orderbook.best_bid.saturating_add(s), ClobError::SlippageExceeded);
                }
            }
        } else {
            require!(price > 0, ClobError::InvalidPrice);
        }
        require!(quantity > 0, ClobError::InvalidQuantity);
        require!(quantity >= orderbook.min_order_size, ClobError::OrderSizeBelowMinimum);
        require!(price % orderbook.tick_size == 0, ClobError::PriceNotAlignedToTickSize);
        
        // Validate time-based orders
        if time_in_force == 3 { // GTT
            require!(expiry_timestamp > clock.unix_timestamp, ClobError::OrderExpired);
        }
        
        // Validate user account ownership and balance
        require!(user_account.owner == ctx.accounts.user.key(), ClobError::Unauthorized);
        if side == 0 { // Bid
            let required_balance = price.checked_mul(quantity).unwrap();
            require!(user_account.quote_token_balance >= required_balance, ClobError::InsufficientBalance);
        } else { // Ask
            require!(user_account.base_token_balance >= quantity, ClobError::InsufficientBalance);
        }
        
        // Initialize order in the order account
        let order = &mut ctx.accounts.order.load_init()?;
        orderbook.sequence_number += 1;
        
        order.order_id = orderbook.sequence_number;
        order.owner = ctx.accounts.user.key();
        order.price = price;
        order.quantity = quantity;
        order.remaining_quantity = quantity;
        order.timestamp = clock.unix_timestamp;
        order.client_order_id = client_order_id;
        order.expiry_timestamp = expiry_timestamp;
        order.side = side;
        order.order_type = order_type;
        order.status = 0; // Open
        order.self_trade_behavior = self_trade_behavior;
        order.time_in_force = time_in_force;
        order.padding = [0; 3];
        order.reserved = [0; 32];
        
            // Update orderbook stats
                orderbook.total_orders += 1;

                // Update user account stats
                user_account.open_orders_count += 1;
                user_account.total_orders_placed += 1;

                // Match against the book
                match_against_book(
                    &ctx.accounts.orderbook,
                    &ctx.accounts.user_account,
                    &ctx.accounts.order,
                    ctx.remaining_accounts,
                )?;
                
                let order = ctx.accounts.order.load()?;
                
                // If the order is still open, update the best bid/ask
                if order.status == 0 { // Open
                    let mut orderbook = ctx.accounts.orderbook.load_mut()?;
                    if order.side == 0 { // Bid
                        if order.price > orderbook.best_bid {
                            orderbook.best_bid = order.price;
                        }
                    } else { // Ask
                        if order.price < orderbook.best_ask {
                            orderbook.best_ask = order.price;
                        }
                    }
                }

                msg!("Order placed: ID {}, Side {}, Price {}, Quantity {}", 
                     order.order_id, side, price, quantity);
                Ok(())<CancelOrder>) -> Result<()> {
        let orderbook = &mut ctx.accounts.orderbook.load_mut()?;
        let user_account = &mut ctx.accounts.user_account.load_mut()?;
        let order = &mut ctx.accounts.order.load_mut()?;
        
        // Validate orderbook is not paused
        require!(orderbook.is_paused == 0, ClobError::OrderbookPaused);
        
        // Validate order ownership
        require!(order.owner == ctx.accounts.user.key(), ClobError::Unauthorized);
        require!(user_account.owner == ctx.accounts.user.key(), ClobError::Unauthorized);
        
        // Validate order can be cancelled
        require!(order.status == 0 || order.status == 1, ClobError::OrderNotFound); // Open or PartiallyFilled
        
        // Update order status
        order.status = 3; // Cancelled
        
        // Update user account stats
        if user_account.open_orders_count > 0 {
            user_account.open_orders_count -= 1;
        }
        
        msg!("Order cancelled: ID {}", order.order_id);
        Ok(())
    }

    pub fn modify_order(
        ctx: Context<ModifyOrder>,
        new_price: Option<u64>,
        new_quantity: Option<u64>,
    ) -> Result<()> {
        let orderbook = &mut ctx.accounts.orderbook.load_mut()?;
        let user_account = &mut ctx.accounts.user_account.load_mut()?;
        let order = &mut ctx.accounts.order.load_mut()?;
        
        // Validate orderbook is not paused
        require!(orderbook.is_paused == 0, ClobError::OrderbookPaused);
        
        // Validate order ownership
        require!(order.owner == ctx.accounts.user.key(), ClobError::Unauthorized);
        require!(user_account.owner == ctx.accounts.user.key(), ClobError::Unauthorized);
        
        // Validate order can be modified
        require!(order.status == 0 || order.status == 1, ClobError::OrderNotFound); // Open or PartiallyFilled
        
        // Validate new parameters if provided
        if let Some(price) = new_price {
            require!(price > 0, ClobError::InvalidPrice);
            require!(price % orderbook.tick_size == 0, ClobError::PriceNotAlignedToTickSize);
            order.price = price;
        }
        
        if let Some(quantity) = new_quantity {
            require!(quantity > 0, ClobError::InvalidQuantity);
            require!(quantity >= orderbook.min_order_size, ClobError::OrderSizeBelowMinimum);
            require!(quantity >= order.quantity - order.remaining_quantity, ClobError::InvalidQuantity);
            
            // Update remaining quantity proportionally
            let filled_quantity = order.quantity - order.remaining_quantity;
            order.quantity = quantity;
            order.remaining_quantity = quantity - filled_quantity;
        }
        
        msg!("Order modified: ID {}, New Price: {:?}, New Quantity: {:?}", 
             order.order_id, new_price, new_quantity);
        Ok(())
    }

    pub fn pause_orderbook(ctx: Context<PauseOrderbook>) -> Result<()> {
        let orderbook = &mut ctx.accounts.orderbook.load_mut()?;
        
        // Only authority can pause/unpause
        require!(orderbook.authority == ctx.accounts.authority.key(), ClobError::Unauthorized);
        
        orderbook.is_paused = 1;
        msg!("Orderbook paused by authority");
        Ok(())
    }

    pub fn resume_orderbook(ctx: Context<ResumeOrderbook>) -> Result<()> {
        let orderbook = &mut ctx.accounts.orderbook.load_mut()?;
        
        // Only authority can pause/unpause
        require!(orderbook.authority == ctx.accounts.authority.key(), ClobError::Unauthorized);
        
        orderbook.is_paused = 0;
        msg!("Orderbook resumed by authority");
        Ok(())
    }

    /// Match incoming order against the orderbook using price-time priority
    pub fn match_order(
        ctx: Context<MatchOrder>,
        taker_client_order_id: u64,
        side: u8,
        order_type: u8,
        price: u64,
        quantity: u64,
        self_trade_behavior: u8,
    ) -> Result<()> {
        let clock = Clock::get()?;
        let orderbook = &mut ctx.accounts.orderbook.load_mut()?;
        let taker_user_account = &mut ctx.accounts.taker_user_account.load_mut()?;
        
        // Validate orderbook is not paused
        require!(orderbook.is_paused == 0, ClobError::OrderbookPaused);
        
        // Validate order parameters
        require!(side <= 1, ClobError::InvalidOrderSide);
        require!(order_type <= 2, ClobError::InvalidOrderType);
        require!(quantity > 0, ClobError::InvalidQuantity);
        
        // Initialize taker order
        let taker_order = &mut ctx.accounts.taker_order.load_init()?;
        orderbook.sequence_number += 1;
        
        taker_order.order_id = orderbook.sequence_number;
        taker_order.owner = ctx.accounts.taker.key();
        taker_order.price = price;
        taker_order.quantity = quantity;
        taker_order.remaining_quantity = quantity;
        taker_order.timestamp = clock.unix_timestamp;
        taker_order.client_order_id = taker_client_order_id;
        taker_order.side = side;
        taker_order.order_type = order_type;
        taker_order.status = 0; // Open
        taker_order.self_trade_behavior = self_trade_behavior;
        taker_order.padding = [0; 3];
        taker_order.reserved = [0; 32];
        
        // Execute matching logic
        let mut remaining_quantity = quantity;
        let mut total_matched = 0u64;
        
        // For bid orders, match against asks (starting from lowest price)
        // For ask orders, match against bids (starting from highest price)
        if side == 0 && remaining_quantity > 0 { // Bid order
            remaining_quantity = match_against_asks(
                orderbook,
                taker_order,
                remaining_quantity,
                price,
                order_type,
                self_trade_behavior,
                &clock,
            )?;
        } else if side == 1 && remaining_quantity > 0 { // Ask order
            remaining_quantity = match_against_bids(
                orderbook,
                taker_order,
                remaining_quantity,
                price,
                order_type,
                self_trade_behavior,
                &clock,
            )?;
        }
        
        total_matched = quantity - remaining_quantity;
        taker_order.remaining_quantity = remaining_quantity;
        
        // Update order status based on fill
        if remaining_quantity == 0 {
            taker_order.status = 2; // Filled
        } else if total_matched > 0 {
            taker_order.status = 1; // PartiallyFilled
        }
        
        // Update orderbook stats
        orderbook.total_orders += 1;
        orderbook.total_volume += total_matched;
        
        // Update user stats
        taker_user_account.open_orders_count += if remaining_quantity > 0 { 1 } else { 0 };
        taker_user_account.total_orders_placed += 1;
        taker_user_account.total_volume_traded += total_matched;
        
        msg!("Order matched: ID {}, Filled {}/{}, Remaining {}", 
             taker_order.order_id, total_matched, quantity, remaining_quantity);
        
        Ok(())
    }

    /// Execute a trade between two orders
    pub fn execute_trade(
        ctx: Context<ExecuteTrade>,
        maker_order_id: u64,
        taker_order_id: u64,
        execution_price: u64,
        execution_quantity: u64,
    ) -> Result<()> {
        let clock = Clock::get()?;
        let orderbook = &mut ctx.accounts.orderbook.load_mut()?;
        let maker_order = &mut ctx.accounts.maker_order.load_mut()?;
        let taker_order = &mut ctx.accounts.taker_order.load_mut()?;
        let maker_user_account = &mut ctx.accounts.maker_user_account.load_mut()?;
        let taker_user_account = &mut ctx.accounts.taker_user_account.load_mut()?;
        
        // Validate orders exist and can be executed
        require!(maker_order.order_id == maker_order_id, ClobError::OrderNotFound);
        require!(taker_order.order_id == taker_order_id, ClobError::OrderNotFound);
        require!(maker_order.status <= 1, ClobError::OrderNotFound); // Open or PartiallyFilled
        require!(taker_order.status <= 1, ClobError::OrderNotFound);
        
        // Validate execution parameters
        require!(execution_quantity > 0, ClobError::InvalidQuantity);
        require!(execution_quantity <= maker_order.remaining_quantity, ClobError::InvalidQuantity);
        require!(execution_quantity <= taker_order.remaining_quantity, ClobError::InvalidQuantity);
        
        // Self-trade prevention check
        if maker_order.owner == taker_order.owner {
            require!(maker_order.self_trade_behavior != 3, ClobError::SelfTradeDetected); // CancelBoth
            
            match maker_order.self_trade_behavior {
                0 => { // DecrementAndCancel
                    let smaller_qty = execution_quantity.min(maker_order.remaining_quantity.min(taker_order.remaining_quantity));
                    maker_order.remaining_quantity -= smaller_qty;
                    taker_order.remaining_quantity -= smaller_qty;
                    return Ok(());
                },
                1 => { // CancelProvide (cancel maker)
                    maker_order.status = 3; // Cancelled
                    return Ok(());
                },
                2 => { // CancelTake (cancel taker)
                    taker_order.status = 3; // Cancelled
                    return Ok(());
                },
                _ => return Err(ClobError::SelfTradeDetected.into()),
            }
        }
        
        // Execute the trade
        maker_order.remaining_quantity -= execution_quantity;
        taker_order.remaining_quantity -= execution_quantity;
        
        // Update order statuses
        if maker_order.remaining_quantity == 0 {
            maker_order.status = 2; // Filled
            if maker_user_account.open_orders_count > 0 {
                maker_user_account.open_orders_count -= 1;
            }
        } else {
            maker_order.status = 1; // PartiallyFilled
        }
        
        if taker_order.remaining_quantity == 0 {
            taker_order.status = 2; // Filled
            if taker_user_account.open_orders_count > 0 {
                taker_user_account.open_orders_count -= 1;
            }
        } else {
            taker_order.status = 1; // PartiallyFilled
        }
        
        // Update user trading volumes
        maker_user_account.total_volume_traded += execution_quantity;
        taker_user_account.total_volume_traded += execution_quantity;
        
        // Update orderbook volume and best prices
        orderbook.total_volume += execution_quantity;
        update_best_prices(orderbook, maker_order.side, maker_order.price)?;
        
        msg!("Trade executed: Maker {} Taker {} Price {} Quantity {}", 
             maker_order_id, taker_order_id, execution_price, execution_quantity);
        
        Ok(())
    }

    /// Deposit funds into the user's CLOB account
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        let user_account = &mut ctx.accounts.user_account.load_mut()?;
        let orderbook = &ctx.accounts.orderbook.load()?;
        
        // Transfer tokens from user wallet to CLOB vault
        let cpi_accounts = Transfer {
            from: ctx.accounts.user_token_account.to_account_info(),
            to: ctx.accounts.clob_token_vault.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_context = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_context, amount)?;
        
        // Update user's balance
        if ctx.accounts.clob_token_vault.mint == orderbook.base_mint {
            user_account.base_token_balance = user_account.base_token_balance.checked_add(amount).unwrap();
        } else if ctx.accounts.clob_token_vault.mint == orderbook.quote_mint {
            user_account.quote_token_balance = user_account.quote_token_balance.checked_add(amount).unwrap();
        }
        
        msg!("Deposited {} tokens for user {:?}", amount, user_account.owner);
        Ok(())
    }

    /// Withdraw funds from the user's CLOB account
    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        let user_account = &mut ctx.accounts.user_account.load_mut()?;
        let orderbook = &ctx.accounts.orderbook.load()?;
        
        // Check for sufficient balance
        if ctx.accounts.clob_token_vault.mint == orderbook.base_mint {
            require!(user_account.base_token_balance >= amount, ClobError::InsufficientBalance);
            user_account.base_token_balance = user_account.base_token_balance.checked_sub(amount).unwrap();
        } else if ctx.accounts.clob_token_vault.mint == orderbook.quote_mint {
            require!(user_account.quote_token_balance >= amount, ClobError::InsufficientBalance);
            user_account.quote_token_balance = user_account.quote_token_balance.checked_sub(amount).unwrap();
        }
        
        // Transfer tokens from CLOB vault to user wallet
        let seeds = &[
            b"orderbook".as_ref(),
            orderbook.base_mint.as_ref(),
            orderbook.quote_mint.as_ref(),
            &[ctx.bumps.orderbook],
        ];
        let signer = &[&seeds[..]];
        
        let cpi_accounts = Transfer {
            from: ctx.accounts.clob_token_vault.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.orderbook.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_context = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        token::transfer(cpi_context, amount)?;
        
        msg!("Withdrew {} tokens for user {:?}", amount, user_account.owner);
        Ok(())
    }

    /// Transfer orderbook authority to a new authority
    pub fn transfer_authority(ctx: Context<TransferAuthority>, new_authority: Pubkey) -> Result<()> {
        let orderbook = &mut ctx.accounts.orderbook.load_mut()?;
        require!(orderbook.authority == ctx.accounts.authority.key(), ClobError::InvalidAuthority);
        orderbook.authority = new_authority;
        msg!("Orderbook authority transferred to {:?}", new_authority);
        Ok(())
    }
}

// Helper functions for matching engine

fn match_against_asks(
    orderbook: &mut OrderBook,
    taker_order: &mut Order,
    mut remaining_quantity: u64,
    price: u64,
    order_type: u8,
    self_trade_behavior: u8,
    clock: &Clock,
) -> Result<u64> {
    // Implement logic to iterate through ask orders and match
    // For simplicity, we assume a mechanism to query resting orders.
    // In a real implementation, this would involve iterating through a price-level tree.
    Ok(remaining_quantity)
}

fn match_against_bids(
    orderbook: &mut OrderBook,
    taker_order: &mut Order,
    mut remaining_quantity: u64,
    price: u64,
    order_type: u8,
    self_trade_behavior: u8,
    clock: &Clock,
) -> Result<u64> {
    // Implement logic to iterate through bid orders and match
    Ok(remaining_quantity)
}

fn update_best_prices(orderbook: &mut OrderBook, side: u8, price: u64) -> Result<()> {
    if side == 0 { // Bid
        if price > orderbook.best_bid {
            orderbook.best_bid = price;
        }
    } else { // Ask
        if price < orderbook.best_ask {
            orderbook.best_ask = price;
        }
    }
    Ok(())
}


// Core data structures

/// Represents a single order in the CLOB
#[account(zero_copy)]
#[repr(C)]
#[derive(Debug)]
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
    /// Order side (bid/ask), type, status - packed together
    pub side: u8, // OrderSide as u8
    /// Order type (limit/market)
    pub order_type: u8, // OrderType as u8
    /// Order status
    pub status: u8, // OrderStatus as u8
    /// Self-trade prevention mode
    pub self_trade_behavior: u8, // SelfTradeBehavior as u8
    /// Time in force
    pub time_in_force: u8, // TimeInForce as u8
    /// Padding to align to 8-byte boundary
    pub padding: [u8; 3],
    /// Reserved space for future use (Pod-compatible size)
    pub reserved: [u8; 32],
}

/// Main orderbook structure containing all orders and market state
#[account(zero_copy)]
#[repr(C)]
#[derive(Debug)]
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
    /// Whether orderbook is initialized (1 = true, 0 = false)
    pub is_initialized: u8,
    /// Whether trading is paused (1 = true, 0 = false)
    pub is_paused: u8,
    /// Padding to align to 8-byte boundary
    pub padding: [u8; 6],
    /// Reserved space for future use (Pod-compatible size)
    pub reserved: [u8; 32],
}

/// User account for tracking orders and balances
#[account(zero_copy)]
#[repr(C)]
#[derive(Debug)]
pub struct UserAccount {
    /// Owner of the account
    pub owner: Pubkey,
    /// Number of open orders
    pub open_orders_count: u64,
    /// Total orders placed by user
    pub total_orders_placed: u64,
    /// Total volume traded by user
    pub total_volume_traded: u64,
    /// User's base token balance in the CLOB
    pub base_token_balance: u64,
    /// User's quote token balance in the CLOB
    pub quote_token_balance: u64,
    /// Whether account is initialized (1 = true, 0 = false)
    pub is_initialized: u8,
    /// Padding to align to 8-byte boundary
    pub padding: [u8; 7],
    /// Reserved space for future use (Pod-compatible size)
    pub reserved: [u8; 32],
}

/// Price level in the orderbook
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, Copy)]
#[repr(C)]
pub struct PriceLevel {
    /// Price at this level
    pub price: u64,
    /// Total quantity at this level
    pub quantity: u64,
    /// Number of orders at this level
    pub order_count: u32,
    /// Reserved space
    pub reserved: [u8; 20],
}

unsafe impl Pod for PriceLevel {}
unsafe impl Zeroable for PriceLevel {}

/// Trade execution result
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
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

        // Enums for order management

        #[event]
        pub struct TradeEvent {
            pub orderbook: Pubkey,
            pub maker_order_id: u64,
            pub taker_order_id: u64,
            pub maker: Pubkey,
            pub taker: Pubkey,
            pub price: u64,
            pub quantity: u64,
            pub side: u8, // Taker side
            pub timestamp: i64,
        }

        /// Order side enumerationerialize, BorshDeserialize, Debug, Clone, Copy, PartialEq, Eq, FromPrimitive)]
#[repr(u8)]
pub enum OrderSide {
    Bid = 0,  // Buy order
    Ask = 1,  // Sell order
}

/// Order type enumeration
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, Copy, PartialEq, Eq, FromPrimitive)]
#[repr(u8)]
pub enum OrderType {
    Limit = 0,    // Limit order
    Market = 1,   // Market order
    PostOnly = 2, // Post-only limit order
}

/// Order status enumeration
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, Copy, PartialEq, Eq, FromPrimitive)]
#[repr(u8)]
pub enum OrderStatus {
    Open = 0,        // Order is active
    PartiallyFilled = 1, // Order is partially executed
    Filled = 2,      // Order is completely executed
    Cancelled = 3,   // Order is cancelled
    Expired = 4,     // Order has expired
}

/// Self-trade prevention behavior
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, Copy, PartialEq, Eq, FromPrimitive)]
#[repr(u8)]
pub enum SelfTradeBehavior {
    DecrementAndCancel = 0, // Cancel the smaller order
    CancelProvide = 1,      // Cancel the resting order
    CancelTake = 2,         // Cancel the incoming order
    CancelBoth = 3,         // Cancel both orders
}

/// Time in force enumeration
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, Copy, PartialEq, Eq, FromPrimitive)]
#[repr(u8)]
pub enum TimeInForce {
    GoodTillCancelled = 0, // GTC - remains until cancelled
    ImmediateOrCancel = 1, // IOC - execute immediately or cancel
    FillOrKill = 2,        // FOK - execute completely or cancel
    GoodTillTime = 3,      // GTT - remains until expiry time
}

// Account validation structs

#[derive(Accounts)]
pub struct InitializeOrderbook<'info> {
    #[account(
        init,
        payer = authority,
        space = ORDERBOOK_ACCOUNT_SIZE,
        seeds = [b"orderbook", base_mint.key().as_ref(), quote_mint.key().as_ref()],
        bump
    )]
    pub orderbook: AccountLoader<'info, OrderBook>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    /// Base token mint
    pub base_mint: Account<'info, Mint>,
    
    /// Quote token mint
    pub quote_mint: Account<'info, Mint>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeUserAccount<'info> {
    #[account(
        init,
        payer = user,
        space = USER_ACCOUNT_SIZE,
        seeds = [b"user_account", user.key().as_ref()],
        bump
    )]
    pub user_account: AccountLoader<'info, UserAccount>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(client_order_id: u64)]
pub struct PlaceOrder<'info> {
    #[account(
        init,
        payer = user,
        space = ORDER_ACCOUNT_SIZE,
        seeds = [b"order", user.key().as_ref(), client_order_id.to_le_bytes().as_ref()],
        bump
    )]
    pub order: AccountLoader<'info, Order>,
    
    #[account(
        mut,
        seeds = [b"orderbook", orderbook.load()?.base_mint.as_ref(), orderbook.load()?.quote_mint.as_ref()],
        bump
    )]
    pub orderbook: AccountLoader<'info, OrderBook>,
    
    #[account(
        mut,
        seeds = [b"user_account", user.key().as_ref()],
        bump
    )]
    pub user_account: AccountLoader<'info, UserAccount>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CancelOrder<'info> {
    #[account(
        mut,
        seeds = [b"order", user.key().as_ref(), order.load()?.client_order_id.to_le_bytes().as_ref()],
        bump
    )]
    pub order: AccountLoader<'info, Order>,
    
    #[account(
        mut,
        seeds = [b"orderbook", orderbook.load()?.base_mint.as_ref(), orderbook.load()?.quote_mint.as_ref()],
        bump
    )]
    pub orderbook: AccountLoader<'info, OrderBook>,
    
    #[account(
        mut,
        seeds = [b"user_account", user.key().as_ref()],
        bump
    )]
    pub user_account: AccountLoader<'info, UserAccount>,
    
    #[account(mut)]
    pub user: Signer<'info>,
}

#[derive(Accounts)]
pub struct ModifyOrder<'info> {
    #[account(
        mut,
        seeds = [b"order", user.key().as_ref(), order.load()?.client_order_id.to_le_bytes().as_ref()],
        bump
    )]
    pub order: AccountLoader<'info, Order>,
    
    #[account(
        mut,
        seeds = [b"orderbook", orderbook.load()?.base_mint.as_ref(), orderbook.load()?.quote_mint.as_ref()],
        bump
    )]
    pub orderbook: AccountLoader<'info, OrderBook>,
    
    #[account(
        mut,
        seeds = [b"user_account", user.key().as_ref()],
        bump
    )]
    pub user_account: AccountLoader<'info, UserAccount>,
    
    #[account(mut)]
    pub user: Signer<'info>,
}

#[derive(Accounts)]
pub struct PauseOrderbook<'info> {
    #[account(
        mut,
        seeds = [b"orderbook", orderbook.load()?.base_mint.as_ref(), orderbook.load()?.quote_mint.as_ref()],
        bump
    )]
    pub orderbook: AccountLoader<'info, OrderBook>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct ResumeOrderbook<'info> {
    #[account(
        mut,
        seeds = [b"orderbook", orderbook.load()?.base_mint.as_ref(), orderbook.load()?.quote_mint.as_ref()],
        bump
    )]
    pub orderbook: AccountLoader<'info, OrderBook>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(taker_client_order_id: u64)]
pub struct MatchOrder<'info> {
    #[account(
        init,
        payer = taker,
        space = ORDER_ACCOUNT_SIZE,
        seeds = [b"order", taker.key().as_ref(), taker_client_order_id.to_le_bytes().as_ref()],
        bump
    )]
    pub taker_order: AccountLoader<'info, Order>,
    
    #[account(
        mut,
        seeds = [b"orderbook", orderbook.load()?.base_mint.as_ref(), orderbook.load()?.quote_mint.as_ref()],
        bump
    )]
    pub orderbook: AccountLoader<'info, OrderBook>,
    
    #[account(
        mut,
        seeds = [b"user_account", taker.key().as_ref()],
        bump
    )]
    pub taker_user_account: AccountLoader<'info, UserAccount>,
    
    #[account(mut)]
    pub taker: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ExecuteTrade<'info> {
    #[account(
        mut,
        seeds = [b"orderbook", orderbook.load()?.base_mint.as_ref(), orderbook.load()?.quote_mint.as_ref()],
        bump
    )]
    pub orderbook: AccountLoader<'info, OrderBook>,

    #[account(mut)]
    pub maker_order: AccountLoader<'info, Order>,

    #[account(mut)]
    pub taker_order: AccountLoader<'info, Order>,

    #[account(mut)]
    pub maker_user_account: AccountLoader<'info, UserAccount>,

    #[account(mut)]
    pub taker_user_account: AccountLoader<'info, UserAccount>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(
        mut,
        seeds = [b"orderbook", orderbook.load()?.base_mint.as_ref(), orderbook.load()?.quote_mint.as_ref()],
        bump
    )]
    pub orderbook: AccountLoader<'info, OrderBook>,

    #[account(mut)]
    pub user_account: AccountLoader<'info, UserAccount>,

    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        seeds = [b"clob_vault", clob_token_vault.mint.as_ref()],
        bump,
    )]
    pub clob_token_vault: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub user: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(
        mut,
        seeds = [b"orderbook", orderbook.load()?.base_mint.as_ref(), orderbook.load()?.quote_mint.as_ref()],
        bump
    )]
    pub orderbook: AccountLoader<'info, OrderBook>,

    #[account(mut)]
    pub user_account: AccountLoader<'info, UserAccount>,

    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        seeds = [b"clob_vault", clob_token_vault.mint.as_ref()],
        bump,
    )]
    pub clob_token_vault: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub user: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct TransferAuthority<'info> {
    #[account(
        mut,
        seeds = [b"orderbook", orderbook.load()?.base_mint.as_ref(), orderbook.load()?.quote_mint.as_ref()],
        bump
    )]
    pub orderbook: AccountLoader<'info, OrderBook>,

    #[account(mut)]
    pub authority: Signer<'info>,
}

// Error codes for CLOB operations
#[error_code]
pub enum ClobError {
    #[msg("Invalid order side")]
    InvalidOrderSide,
    #[msg("Invalid order type")]
    InvalidOrderType,
    #[msg("Invalid price")]
    InvalidPrice,
    #[msg("Invalid quantity")]
    InvalidQuantity,
    #[msg("Order size below minimum")]
    OrderSizeBelowMinimum,
    #[msg("Price not aligned to tick size")]
    PriceNotAlignedToTickSize,
    #[msg("Orderbook is paused")]
    OrderbookPaused,
    #[msg("Insufficient balance")]
    InsufficientBalance,
    #[msg("Order not found")]
    OrderNotFound,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Self trade detected")]
    SelfTradeDetected,
    #[msg("Order expired")]
    OrderExpired,
    #[msg("Market order would cross spread")]
    MarketOrderWouldCrossSpread,
    #[msg("Post-only order would match")]
    PostOnlyOrderWouldMatch,
    #[msg("Invalid authority")]
    InvalidAuthority,
    #[msg("Slippage tolerance exceeded")]
    SlippageExceeded,
}

// Note: Pod and Zeroable traits are automatically implemented by #[account(zero_copy)] attribute