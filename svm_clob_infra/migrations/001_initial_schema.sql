-- Initial database schema for SVM CLOB Infrastructure
-- This migration creates all necessary tables for order and trade storage

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Orders table - stores all order data
CREATE TABLE IF NOT EXISTS orders (
    order_id BIGINT PRIMARY KEY,
    owner TEXT NOT NULL,
    price BIGINT NOT NULL,
    quantity BIGINT NOT NULL,
    remaining_quantity BIGINT NOT NULL,
    timestamp BIGINT NOT NULL,
    client_order_id BIGINT NOT NULL,
    expiry_timestamp BIGINT NOT NULL DEFAULT 0,
    side SMALLINT NOT NULL CHECK (side IN (0, 1)), -- 0 = Bid, 1 = Ask
    order_type SMALLINT NOT NULL CHECK (order_type IN (0, 1, 2)), -- 0 = Limit, 1 = Market, 2 = PostOnly
    status SMALLINT NOT NULL CHECK (status IN (0, 1, 2, 3, 4)), -- 0 = Open, 1 = PartiallyFilled, 2 = Filled, 3 = Cancelled, 4 = Expired
    self_trade_behavior SMALLINT NOT NULL CHECK (self_trade_behavior IN (0, 1, 2, 3)),
    time_in_force SMALLINT NOT NULL CHECK (time_in_force IN (0, 1, 2, 3)),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_orders_owner ON orders (owner);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_side ON orders (side);
CREATE INDEX IF NOT EXISTS idx_orders_timestamp ON orders (timestamp);
CREATE INDEX IF NOT EXISTS idx_orders_price ON orders (price);
CREATE INDEX IF NOT EXISTS idx_orders_client_order_id ON orders (client_order_id);

-- Trades table - stores all trade executions
CREATE TABLE IF NOT EXISTS trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    maker_order_id BIGINT NOT NULL,
    taker_order_id BIGINT NOT NULL,
    price BIGINT NOT NULL,
    quantity BIGINT NOT NULL,
    timestamp BIGINT NOT NULL,
    maker_side SMALLINT NOT NULL CHECK (maker_side IN (0, 1)),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (maker_order_id) REFERENCES orders(order_id),
    FOREIGN KEY (taker_order_id) REFERENCES orders(order_id)
);

-- Create indexes for trades
CREATE INDEX IF NOT EXISTS idx_trades_maker_order_id ON trades (maker_order_id);
CREATE INDEX IF NOT EXISTS idx_trades_taker_order_id ON trades (taker_order_id);
CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades (timestamp);
CREATE INDEX IF NOT EXISTS idx_trades_price ON trades (price);

-- Orderbook snapshots table - stores periodic orderbook state
CREATE TABLE IF NOT EXISTS orderbook_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sequence_number BIGINT NOT NULL UNIQUE,
    timestamp BIGINT NOT NULL,
    bids JSONB NOT NULL, -- Array of [price, quantity] pairs
    asks JSONB NOT NULL, -- Array of [price, quantity] pairs
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for orderbook snapshots
CREATE INDEX IF NOT EXISTS idx_orderbook_snapshots_sequence_number ON orderbook_snapshots (sequence_number);
CREATE INDEX IF NOT EXISTS idx_orderbook_snapshots_timestamp ON orderbook_snapshots (timestamp);

-- User accounts table - stores user trading statistics
CREATE TABLE IF NOT EXISTS user_accounts (
    owner TEXT PRIMARY KEY,
    open_orders_count BIGINT NOT NULL DEFAULT 0,
    total_orders_placed BIGINT NOT NULL DEFAULT 0,
    total_volume_traded BIGINT NOT NULL DEFAULT 0,
    is_initialized BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for user accounts
CREATE INDEX IF NOT EXISTS idx_user_accounts_total_volume ON user_accounts (total_volume_traded);
CREATE INDEX IF NOT EXISTS idx_user_accounts_total_orders ON user_accounts (total_orders_placed);

-- Market statistics table - stores aggregated market data
CREATE TABLE IF NOT EXISTS market_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    base_mint TEXT NOT NULL,
    quote_mint TEXT NOT NULL,
    best_bid BIGINT,
    best_ask BIGINT,
    spread BIGINT,
    total_bid_orders BIGINT NOT NULL DEFAULT 0,
    total_ask_orders BIGINT NOT NULL DEFAULT 0,
    total_bid_quantity BIGINT NOT NULL DEFAULT 0,
    total_ask_quantity BIGINT NOT NULL DEFAULT 0,
    price_levels_count BIGINT NOT NULL DEFAULT 0,
    last_trade_price BIGINT,
    volume_24h BIGINT NOT NULL DEFAULT 0,
    timestamp BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for market stats
CREATE INDEX IF NOT EXISTS idx_market_stats_base_quote ON market_stats (base_mint, quote_mint);
CREATE INDEX IF NOT EXISTS idx_market_stats_timestamp ON market_stats (timestamp);

-- System configuration table - stores runtime configuration
CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default system configuration
INSERT INTO system_config (key, value, description) VALUES
('orderbook.tick_size', '1000', 'Minimum price increment in quote token units'),
('orderbook.min_order_size', '1000000', 'Minimum order size in base token units'),
('orderbook.base_mint', '"So11111111111111111111111111111111111111112"', 'Base token mint (SOL)'),
('orderbook.quote_mint', '"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"', 'Quote token mint (USDC)'),
('matching_engine.max_orders_per_batch', '100', 'Maximum orders processed per matching batch'),
('matching_engine.matching_interval_ms', '10', 'Matching engine interval in milliseconds')
ON CONFLICT (key) DO NOTHING;

-- Create trigger to automatically update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply the trigger to relevant tables
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_accounts_updated_at BEFORE UPDATE ON user_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_system_config_updated_at BEFORE UPDATE ON system_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();