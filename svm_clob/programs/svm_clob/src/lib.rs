use anchor_lang::prelude::*;
use anchor_spl::token::Mint;
use borsh::{BorshDeserialize, BorshSerialize};
use bytemuck::{Pod, Zeroable};
use num_derive::FromPrimitive;

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

    pub fn initialize_orderbook(
        ctx: Context<InitializeOrderbook>,
        base_mint: Pubkey,
        quote_mint: Pubkey,
        tick_size: u64,
        min_order_size: u64,
    ) -> Result<()> {
        let orderbook = &mut ctx.accounts.orderbook.load_init()?;
        orderbook.authority = ctx.accounts.authority.key();
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
    ) -> Result<()> {
        let clock = Clock::get()?;
        let orderbook = &mut ctx.accounts.orderbook.load_mut()?;
        let user_account = &mut ctx.accounts.user_account.load_mut()?;
        
        // Validate orderbook is not paused
        require!(orderbook.is_paused == 0, ClobError::OrderbookPaused);
        
        // Validate order parameters
        require!(side <= 1, ClobError::InvalidOrderSide);
        require!(order_type <= 2, ClobError::InvalidOrderType);
        require!(price > 0, ClobError::InvalidPrice);
        require!(quantity > 0, ClobError::InvalidQuantity);
        require!(quantity >= orderbook.min_order_size, ClobError::OrderSizeBelowMinimum);
        require!(price % orderbook.tick_size == 0, ClobError::PriceNotAlignedToTickSize);
        
        // Validate time-based orders
        if time_in_force == 3 { // GTT
            require!(expiry_timestamp > clock.unix_timestamp, ClobError::OrderExpired);
        }
        
        // Validate user account ownership
        require!(user_account.owner == ctx.accounts.user.key(), ClobError::Unauthorized);
        
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
        
        msg!("Order placed: ID {}, Side {}, Price {}, Quantity {}", 
             order.order_id, side, price, quantity);
        Ok(())
    }

    pub fn cancel_order(ctx: Context<CancelOrder>) -> Result<()> {
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

/// Order side enumeration
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, Copy, PartialEq, Eq, FromPrimitive)]
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
}

// Note: Pod and Zeroable traits are automatically implemented by #[account(zero_copy)] attribute
