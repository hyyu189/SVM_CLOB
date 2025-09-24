use anchor_lang::prelude::*;
use anchor_spl::token::Mint;
use borsh::{BorshDeserialize, BorshSerialize};
use num_derive::FromPrimitive;
use num_traits::FromPrimitive;

declare_id!("7YtJ5eYw1am3m73Yw2sh1QPWek3Ux17Ju1tp263h7YJB");

// Constants for CLOB configuration
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
        authority: Pubkey,
    ) -> Result<()> {
        let orderbook = &mut ctx.accounts.orderbook.load_init()?;
        orderbook.authority = authority;
        orderbook.base_mint = base_mint;
        orderbook.quote_mint = quote_mint;
        orderbook.tick_size = tick_size;
        orderbook.min_order_size = min_order_size;
        orderbook.sequence_number = 0;
        orderbook.is_initialized = 1;
        orderbook.is_paused = 0;
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
        user_account.is_initialized = 1;
        user_account.total_orders_placed = 0;
        user_account.total_volume_traded = 0;

        msg!("User account initialized for: {:?}", ctx.accounts.user.key());
        Ok(())
    }

    pub fn place_order<'info>(
        ctx: Context<'_, '_, 'info, 'info, PlaceOrder<'info>>,
        client_order_id: u64,
        side: u8,
        order_type: u8,
        price: u64,
        quantity: u64,
        time_in_force: u8,
        expiry_timestamp: i64,
        self_trade_behavior: u8,
    ) -> Result<()> {
        let clock = Clock::get()?;
        let orderbook = &mut ctx.accounts.orderbook.load_mut()?;
        let user_account = &mut ctx.accounts.user_account.load_mut()?;

        require!(orderbook.is_paused == 0, ClobError::OrderbookPaused);

        let side = OrderSide::from_u8(side).ok_or(ClobError::InvalidOrderSide)?;
        let order_type = OrderType::from_u8(order_type).ok_or(ClobError::InvalidOrderType)?;
        let time_in_force = TimeInForce::from_u8(time_in_force).ok_or(ClobError::InvalidOrderType)?;
        require!(price > 0, ClobError::InvalidPrice);
        require!(quantity > 0, ClobError::InvalidQuantity);
        require!(quantity >= orderbook.min_order_size, ClobError::OrderSizeBelowMinimum);
        require!(price % orderbook.tick_size == 0, ClobError::PriceNotAlignedToTickSize);

        if time_in_force == TimeInForce::GoodTillTime {
            require!(expiry_timestamp > clock.unix_timestamp, ClobError::OrderExpired);
        }

        require!(user_account.owner == ctx.accounts.user.key(), ClobError::Unauthorized);

        orderbook.sequence_number += 1;
        let new_order_id = orderbook.sequence_number;

        let mut remaining_quantity = quantity;

        for resting_order_info in ctx.remaining_accounts.iter() {
            if remaining_quantity == 0 {
                break;
            }

            let resting_order_loader: AccountLoader<Order> = AccountLoader::try_from(resting_order_info)?;
            let mut resting_order = resting_order_loader.load_mut()?;

            require!(resting_order.status == OrderStatus::Open as u8 || resting_order.status == OrderStatus::PartiallyFilled as u8, ClobError::OrderNotFound);
            require!(resting_order.owner != ctx.accounts.user.key(), ClobError::SelfTradeDetected);

            let can_match = match side {
                OrderSide::Bid => price >= resting_order.price,
                OrderSide::Ask => price <= resting_order.price,
            };

            if can_match {
                if order_type == OrderType::PostOnly {
                    return err!(ClobError::PostOnlyOrderWouldMatch);
                }

                let fill_quantity = std::cmp::min(remaining_quantity, resting_order.remaining_quantity);
                let fill_price = resting_order.price;

                if fill_quantity > 0 {
                    remaining_quantity -= fill_quantity;
                    resting_order.remaining_quantity -= fill_quantity;

                    if resting_order.remaining_quantity == 0 {
                        resting_order.status = OrderStatus::Filled as u8;
                    } else {
                        resting_order.status = OrderStatus::PartiallyFilled as u8;
                    }

                    orderbook.total_volume += fill_quantity;
                    user_account.total_volume_traded += fill_quantity;

                    emit!(TradeEvent {
                        order_id: new_order_id,
                        client_order_id,
                        owner: user_account.owner,
                        side: side as u8,
                        price: fill_price,
                        quantity: fill_quantity,
                        matched_order_id: resting_order.order_id,
                        matched_client_order_id: resting_order.client_order_id,
                        matched_owner: resting_order.owner,
                        matched_quantity: fill_quantity,
                        timestamp: clock.unix_timestamp,
                    });
                }
            }
        }

        if time_in_force == TimeInForce::FillOrKill && remaining_quantity > 0 {
            return err!(ClobError::FOKOrderNotFilled);
        }

        if remaining_quantity > 0 && time_in_force != TimeInForce::ImmediateOrCancel && order_type != OrderType::Market {
            let order = &mut ctx.accounts.order.load_init()?;

            order.order_id = new_order_id;
            order.owner = ctx.accounts.user.key();
            order.price = price;
            order.quantity = quantity;
            order.remaining_quantity = remaining_quantity;
            order.timestamp = clock.unix_timestamp;
            order.client_order_id = client_order_id;
            order.expiry_timestamp = expiry_timestamp;
            order.side = side as u8;
            order.order_type = order_type as u8;
            order.status = if remaining_quantity < quantity { OrderStatus::PartiallyFilled as u8 } else { OrderStatus::Open as u8 };
            order.self_trade_behavior = self_trade_behavior;
            order.time_in_force = time_in_force as u8;
            order.padding = [0; 3];
            order.reserved = [0; 32];

            orderbook.total_orders += 1;
            user_account.open_orders_count += 1;
            user_account.total_orders_placed += 1;

            msg!("Order placed: ID {}, Side {:?}, Price {}, Quantity {}, Remaining {}",
                 order.order_id, side, price, quantity, remaining_quantity);
        } else {
            msg!("Order fully matched or IOC/FOK cancelled, not placed on book. Remaining: {}", remaining_quantity);
            user_account.total_orders_placed += 1;
        }

        Ok(())
    }

    pub fn cancel_order(ctx: Context<CancelOrder>) -> Result<()> {
        let orderbook = &mut ctx.accounts.orderbook.load_mut()?;
        let user_account = &mut ctx.accounts.user_account.load_mut()?;
        let order = &mut ctx.accounts.order.load_mut()?;

        require!(orderbook.is_paused == 0, ClobError::OrderbookPaused);
        require!(order.owner == ctx.accounts.user.key(), ClobError::Unauthorized);
        require!(user_account.owner == ctx.accounts.user.key(), ClobError::Unauthorized);
        require!(order.status == OrderStatus::Open as u8 || order.status == OrderStatus::PartiallyFilled as u8, ClobError::OrderNotFound);

        order.status = OrderStatus::Cancelled as u8;

        if user_account.open_orders_count > 0 {
            user_account.open_orders_count -= 1;
        }

        msg!("Order cancelled: ID {}", order.order_id);
        Ok(())
    }
}


#[account(zero_copy)]
#[repr(C)]
#[derive(Debug)]
pub struct Order {
    pub order_id: u64,
    pub owner: Pubkey,
    pub price: u64,
    pub quantity: u64,
    pub remaining_quantity: u64,
    pub timestamp: i64,
    pub client_order_id: u64,
    pub expiry_timestamp: i64,
    pub side: u8,
    pub order_type: u8,
    pub status: u8,
    pub self_trade_behavior: u8,
    pub time_in_force: u8,
    pub padding: [u8; 3],
    pub reserved: [u8; 32],
}

#[account(zero_copy)]
#[repr(C)]
#[derive(Debug)]
pub struct OrderBook {
    pub authority: Pubkey,
    pub base_mint: Pubkey,
    pub quote_mint: Pubkey,
    pub tick_size: u64,
    pub min_order_size: u64,
    pub sequence_number: u64,
    pub total_orders: u64,
    pub best_bid: u64,
    pub best_ask: u64,
    pub total_volume: u64,
    pub is_initialized: u8,
    pub is_paused: u8,
    pub padding: [u8; 6],
    pub reserved: [u8; 32],
}

#[account(zero_copy)]
#[repr(C)]
#[derive(Debug)]
pub struct UserAccount {
    pub owner: Pubkey,
    pub open_orders_count: u64,
    pub total_orders_placed: u64,
    pub total_volume_traded: u64,
    pub base_token_balance: u64,
    pub quote_token_balance: u64,
    pub is_initialized: u8,
    pub padding: [u8; 7],
    pub reserved: [u8; 32],
}

#[event]
pub struct TradeEvent {
    pub order_id: u64,
    pub client_order_id: u64,
    pub owner: Pubkey,
    pub side: u8,
    pub price: u64,
    pub quantity: u64,
    pub matched_order_id: u64,
    pub matched_client_order_id: u64,
    pub matched_owner: Pubkey,
    pub matched_quantity: u64,
    pub timestamp: i64,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, Copy, PartialEq, Eq, FromPrimitive)]
#[repr(u8)]
pub enum OrderSide {
    Bid = 0,
    Ask = 1,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, Copy, PartialEq, Eq, FromPrimitive)]
#[repr(u8)]
pub enum OrderType {
    Limit = 0,
    Market = 1,
    PostOnly = 2,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, Copy, PartialEq, Eq, FromPrimitive)]
#[repr(u8)]
pub enum OrderStatus {
    Open = 0,
    PartiallyFilled = 1,
    Filled = 2,
    Cancelled = 3,
    Expired = 4,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, Copy, PartialEq, Eq, FromPrimitive)]
#[repr(u8)]
pub enum SelfTradeBehavior {
    DecrementAndCancel = 0,
    CancelProvide = 1,
    CancelTake = 2,
    CancelBoth = 3,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, Copy, PartialEq, Eq, FromPrimitive)]
#[repr(u8)]
pub enum TimeInForce {
    GoodTillCancelled = 0,
    ImmediateOrCancel = 1,
    FillOrKill = 2,
    GoodTillTime = 3,
}

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
    pub base_mint: Account<'info, Mint>,
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
    #[msg("FOK order was not completely filled")]
    FOKOrderNotFilled,
    #[msg("Invalid authority")]
    InvalidAuthority,
    #[msg("Slippage tolerance exceeded")]
    SlippageExceeded,
}
