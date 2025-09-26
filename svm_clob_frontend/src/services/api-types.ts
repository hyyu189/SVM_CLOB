
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  timestamp: number;
}

export interface OffChainOrder {
  client_order_id?: number;
  side: 'Bid' | 'Ask';
  order_type: 'Limit' | 'Market' | 'PostOnly';
  price: number;
  quantity: number;
  time_in_force: 'GoodTillCancelled' | 'ImmediateOrCancel' | 'FillOrKill';
  self_trade_behavior?: 'DecrementAndCancel' | 'CancelProvide' | 'CancelTake';
}

export interface OffChainOrderResponse {
  order_id: number;
  client_order_id?: number;
  owner: string;
  side: 'Bid' | 'Ask';
  order_type: 'Limit' | 'Market' | 'PostOnly';
  price: number;
  quantity: number;
  remaining_quantity: number;
  status: 'Open' | 'PartiallyFilled' | 'Filled' | 'Cancelled';
  timestamp: number;
  expiry_timestamp: number;
}

export interface OrderBookSnapshot {
  bids: [number, number][]; // [price, quantity]
  asks: [number, number][]; // [price, quantity]
  sequence_number: number;
  timestamp: number;
}

export interface TradeData {
  maker_order_id: number;
  taker_order_id: number;
  price: number;
  quantity: number;
  timestamp: number;
  maker_side: 'Bid' | 'Ask';
}

export interface MarketStats {
  best_bid: number | null;
  best_ask: number | null;
  spread: number | null;
  last_price: number;
  '24h_volume': number;
  '24h_high': number;
  '24h_low': number;
  '24h_change': number;
  total_bid_orders: number;
  total_ask_orders: number;
  price_levels_count: number;
}

export interface UserAccountData {
  owner: string;
  open_orders_count: number;
  total_orders_placed: number;
  total_volume_traded: number;
  is_initialized: boolean;
}

export interface SystemStatus {
  status: 'healthy' | 'degraded' | 'down';
  uptime: number;
  version: string;
  components: {
    matching_engine: 'healthy' | 'degraded' | 'down';
    database: 'healthy' | 'degraded' | 'down';
    websocket: 'healthy' | 'degraded' | 'down';
  };
}

export interface TradingPair {
  symbol: string;
  base_mint: string;
  quote_mint: string;
  tick_size: number;
  min_order_size: number;
  status: 'active' | 'paused' | 'maintenance';
}
