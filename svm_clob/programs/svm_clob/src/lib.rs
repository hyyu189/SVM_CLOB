use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use borsh::{BorshDeserialize, BorshSerialize};
use num_derive::FromPrimitive;
use num_traits::FromPrimitive;

declare_id!("7YtJ5eYw1am3m73Yw2sh1QPWek3Ux17Ju1tp263h7YJB");

pub mod offchain_api;

// Constants for CLOB configuration
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
                orderbook.is_initialized = 1;
                orderbook.is_paused = 0;
                orderbook.total_volume = 0;
        
                msg!("Orderbook initialized with base: {:?}, quote: {:?}", base_mint, quote_mint);
                Ok(())
            }

    pub fn initialize_user_account(ctx: Context<InitializeUserAccount>) -> Result<()> {
        let user_account = &mut ctx.accounts.user_account.load_init()?;
        user_account.owner = ctx.accounts.user.key();
        user_account.base_token_balance = 0;
        user_account.quote_token_balance = 0;
        user_account.is_initialized = 1;
        user_account.total_volume_traded = 0;

        msg!("User account initialized for: {:?}", ctx.accounts.user.key());
        Ok(())
    }

    pub fn execute_trade(
        ctx: Context<ExecuteTrade>,
        trade: offchain_api::Trade,
    ) -> Result<()> {
        let clock = Clock::get()?;
        let orderbook = &mut ctx.accounts.orderbook.load_mut()?;
        let taker_user_account = &mut ctx.accounts.taker_user_account.load_mut()?;
        let maker_user_account = &mut ctx.accounts.maker_user_account.load_mut()?;

        require!(orderbook.is_paused == 0, ClobError::OrderbookPaused);
        require!(taker_user_account.owner == trade.taker, ClobError::Unauthorized);
        require!(maker_user_account.owner == trade.maker, ClobError::Unauthorized);

        let quote_transfer_amount = trade.quantity.checked_mul(trade.price).ok_or(ClobError::InsufficientBalance)?;

        if trade.taker_side == offchain_api::OrderSide::Bid {
            // Taker is the buyer
            taker_user_account.quote_token_balance = taker_user_account.quote_token_balance.checked_sub(quote_transfer_amount).ok_or(ClobError::InsufficientBalance)?;
            taker_user_account.base_token_balance = taker_user_account.base_token_balance.checked_add(trade.quantity).ok_or(ClobError::InsufficientBalance)?;
            // Maker is the seller
            maker_user_account.quote_token_balance = maker_user_account.quote_token_balance.checked_add(quote_transfer_amount).ok_or(ClobError::InsufficientBalance)?;
            maker_user_account.base_token_balance = maker_user_account.base_token_balance.checked_sub(trade.quantity).ok_or(ClobError::InsufficientBalance)?;
        } else {
            // Taker is the seller
            taker_user_account.quote_token_balance = taker_user_account.quote_token_balance.checked_add(quote_transfer_amount).ok_or(ClobError::InsufficientBalance)?;
            taker_user_account.base_token_balance = taker_user_account.base_token_balance.checked_sub(trade.quantity).ok_or(ClobError::InsufficientBalance)?;
            // Maker is the buyer
            maker_user_account.quote_token_balance = maker_user_account.quote_token_balance.checked_sub(quote_transfer_amount).ok_or(ClobError::InsufficientBalance)?;
            maker_user_account.base_token_balance = maker_user_account.base_token_balance.checked_add(trade.quantity).ok_or(ClobError::InsufficientBalance)?;
        }

        orderbook.total_volume += trade.quantity;
        taker_user_account.total_volume_traded += trade.quantity;
        maker_user_account.total_volume_traded += trade.quantity;

        emit!(TradeSettled {
            taker_order_id: trade.taker_order_id,
            maker_order_id: trade.maker_order_id,
            taker: trade.taker,
            maker: trade.maker,
            price: trade.price,
            quantity: trade.quantity,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        let user_account = &mut ctx.accounts.user_account.load_mut()?;
        let orderbook = &ctx.accounts.orderbook.load()?;
        let is_base_deposit = ctx.accounts.user_token_account.mint == orderbook.base_mint;

        let transfer_accounts = Transfer {
            from: ctx.accounts.user_token_account.to_account_info(),
            to: ctx.accounts.clob_token_vault.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), transfer_accounts);
        token::transfer(cpi_ctx, amount)?;

        if is_base_deposit {
            user_account.base_token_balance += amount;
        } else {
            user_account.quote_token_balance += amount;
        }
        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        let user_account = &mut ctx.accounts.user_account.load_mut()?;
        let orderbook = &ctx.accounts.orderbook.load()?;
        let is_base_withdrawal = ctx.accounts.token_mint.key() == orderbook.base_mint;

        if is_base_withdrawal {
            require!(user_account.base_token_balance >= amount, ClobError::InsufficientBalance);
        } else {
            require!(user_account.quote_token_balance >= amount, ClobError::InsufficientBalance);
        }

        let seeds = &[
            b"clob_vault".as_ref(),
            ctx.accounts.token_mint.to_account_info().key.as_ref(),
            &[ctx.bumps.clob_token_vault],
        ];
        let signer = &[&seeds[..]];

        let transfer_accounts = Transfer {
            from: ctx.accounts.clob_token_vault.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.clob_token_vault.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), transfer_accounts, signer);
        token::transfer(cpi_ctx, amount)?;

        if is_base_withdrawal {
            user_account.base_token_balance -= amount;
        } else {
            user_account.quote_token_balance -= amount;
        }
        Ok(())
    }
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
    pub total_volume_traded: u64,
    pub base_token_balance: u64,
    pub quote_token_balance: u64,
    pub is_initialized: u8,
    pub padding: [u8; 7],
    pub reserved: [u8; 32],
}

#[event]
pub struct TradeSettled {
    pub taker_order_id: u64,
    pub maker_order_id: u64,
    pub taker: Pubkey,
    pub maker: Pubkey,
    pub price: u64,
    pub quantity: u64,
    pub timestamp: i64,
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
pub struct ExecuteTrade<'info> {
    #[account(
        mut,
        seeds = [b"orderbook", orderbook.load()?.base_mint.as_ref(), orderbook.load()?.quote_mint.as_ref()],
        bump
    )]
    pub orderbook: AccountLoader<'info, OrderBook>,
    #[account(
        mut,
        seeds = [b"user_account", taker_user_account.load()?.owner.as_ref()],
        bump
    )]
    pub taker_user_account: AccountLoader<'info, UserAccount>,
    #[account(
        mut,
        seeds = [b"user_account", maker_user_account.load()?.owner.as_ref()],
        bump
    )]
    pub maker_user_account: AccountLoader<'info, UserAccount>,
    #[account(mut)]
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    pub orderbook: AccountLoader<'info, OrderBook>,
    #[account(mut)]
    pub user_account: AccountLoader<'info, UserAccount>,
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    pub token_mint: Account<'info, Mint>,
    #[account(
        init_if_needed,
        payer = user,
        token::mint = token_mint,
        token::authority = clob_token_vault,
        seeds = [b"clob_vault", token_mint.key().as_ref()],
        bump
    )]
    pub clob_token_vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    pub orderbook: AccountLoader<'info, OrderBook>,
    #[account(mut)]
    pub user_account: AccountLoader<'info, UserAccount>,
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    pub token_mint: Account<'info, Mint>,
    #[account(
        mut,
        seeds = [b"clob_vault", token_mint.key().as_ref()],
        bump
    )]
    pub clob_token_vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}


#[error_code]
pub enum ClobError {
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
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Invalid authority")]
    InvalidAuthority,
    #[msg("Slippage tolerance exceeded")]
    SlippageExceeded,
}
