/**
 * SVM CLOB API Service
 *
 * Connects to the svm_clob_infra off-chain infrastructure API.
 * Based on the API specification from svm_clob_infra/README.md
 */

// API Response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  timestamp: number;
}

// Order Types (matching svm-clob-types)
export type OrderSide = 'Bid' | 'Ask';
export type OrderType = 'Limit' | 'Market' | 'PostOnly';
export type OrderStatus = 'Open' | 'PartiallyFilled' | 'Filled' | 'Cancelled';
export type TimeInForce = 'GoodTillCancelled' | 'ImmediateOrCancel' | 'FillOrKill' | 'GoodTillTime';
export type SelfTradeBehavior = 'DecrementAndCancel' | 'CancelProvide' | 'CancelTake' | 'CancelBoth';

// Order structures
export interface OffChainOrder {
  client_order_id?: number;
  side: OrderSide;
  order_type: OrderType;
  price: number; // in lamports/micro-units
  quantity: number; // in micro-units
  time_in_force: TimeInForce;
  self_trade_behavior?: SelfTradeBehavior;
}

export interface OffChainOrderResponse {
  order_id: number;
  client_order_id?: number;
  owner: string; // Base58 encoded pubkey
  side: OrderSide;
  order_type: OrderType;
  price: number;
  quantity: number;
  remaining_quantity: number;
  status: OrderStatus;
  timestamp: number; // Unix timestamp in milliseconds
  expiry_timestamp: number;
}

// Order Book structures
export interface OrderBookSnapshot {
  bids: Array<[number, number]>; // [price, quantity]
  asks: Array<[number, number]>; // [price, quantity]
  sequence_number: number;
  timestamp: number;
}

// Trade data
export interface TradeData {
  maker_order_id: number;
  taker_order_id: number;
  price: number;
  quantity: number;
  timestamp: number;
  maker_side: OrderSide;
}

// Market statistics
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

// System status
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

// User account data
export interface UserAccountData {
  owner: string;
  open_orders_count: number;
  total_orders_placed: number;
  total_volume_traded: number;
  is_initialized: boolean;
}

// Trading pair info
export interface TradingPair {
  symbol: string;
  base_mint: string;
  quote_mint: string;
  tick_size: number;
  min_order_size: number;
  status: 'active' | 'paused' | 'maintenance';
}

import { CONFIG } from '../config/config';

const API_BASE_URL = CONFIG.API_BASE_URL;

export class ApiService {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.API_TIMEOUT);

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error?.message || errorData.message || errorMessage;
        } catch {
          // Ignore JSON parsing errors
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      return {
        success: true,
        data: result.data || result.result || result,
        timestamp: Date.now(),
      };
    } catch (error: any) {
      clearTimeout(timeoutId);

      let errorCode = 'NETWORK_ERROR';
      let errorMessage = 'An unexpected network error occurred.';

      if (error.name === 'AbortError') {
        errorCode = 'TIMEOUT_ERROR';
        errorMessage = 'Request timed out';
      } else if (error.message) {
        errorMessage = error.message;
      }

      return {
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
        },
        timestamp: Date.now(),
      };
    }
  }

  // Order Management
  async placeOrder(order: OffChainOrder, owner: string): Promise<ApiResponse<OffChainOrderResponse>> {
    return this.request<OffChainOrderResponse>('/orders', {
      method: 'POST',
      body: JSON.stringify({ ...order, owner }),
    });
  }

  async cancelOrder(orderId: number): Promise<ApiResponse<{ order_id: number; status: string }>> {
    return this.request<{ order_id: number; status: string }>(`/orders/${orderId}`, {
      method: 'DELETE',
    });
  }

  async getOrder(orderId: number): Promise<ApiResponse<OffChainOrderResponse>> {
    return this.request<OffChainOrderResponse>(`/orders/${orderId}`);
  }

  async modifyOrder(
    orderId: number,
    updates: { new_price?: number; new_quantity?: number }
  ): Promise<ApiResponse<OffChainOrderResponse>> {
    return this.request<OffChainOrderResponse>(`/orders/${orderId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  // Market Data (matching svm_clob_infra API specification)
  async getOrderBookSnapshot(levels = 20): Promise<ApiResponse<OrderBookSnapshot>> {
    return this.request<OrderBookSnapshot>(`/orderbook?levels=${levels}`);
  }

  async getRecentTrades(limit = 50): Promise<ApiResponse<TradeData[]>> {
    return this.request<TradeData[]>(`/trades?limit=${limit}`);
  }

  async getMarketStats(): Promise<ApiResponse<MarketStats>> {
    return this.request<MarketStats>('/market/stats');
  }

  async getMarketDepth(): Promise<ApiResponse<OrderBookSnapshot>> {
    return this.request<OrderBookSnapshot>('/market/depth');
  }

  async getPriceHistory(hours = 24): Promise<ApiResponse<{ timestamp: number; price: number; volume: number }[]>> {
    return this.request<{ timestamp: number; price: number; volume: number }[]>(`/market/price-history?hours=${hours}`);
  }

  async getRecentTradesWithPagination(limit = 50): Promise<ApiResponse<TradeData[]>> {
    return this.request<TradeData[]>(`/trades/recent?limit=${limit}`);
  }

  // User Operations (matching svm_clob_infra API specification)
  async getUserOrders(
    userId: string,
    options: { status?: OrderStatus; limit?: number } = {}
  ): Promise<ApiResponse<OffChainOrderResponse[]>> {
    const params = new URLSearchParams();
    if (options.status) params.append('status', options.status);
    if (options.limit) params.append('limit', options.limit.toString());
    return this.request<OffChainOrderResponse[]>(`/users/${userId}/orders?${params.toString()}`);
  }

  async getUserTrades(
    userId: string,
    limit = 50
  ): Promise<ApiResponse<TradeData[]>> {
    return this.request<TradeData[]>(`/users/${userId}/trades?limit=${limit}`);
  }

  async getUserAccount(
    userId: string
  ): Promise<ApiResponse<UserAccountData>> {
    return this.request<UserAccountData>(`/users/${userId}/account`);
  }

  // System Operations
  async getSystemStatus(): Promise<ApiResponse<SystemStatus>> {
    return this.request<SystemStatus>('/system/status');
  }

  async getAvailableMarkets(): Promise<ApiResponse<TradingPair[]>> {
    return this.request<TradingPair[]>('/system/markets');
  }

  async getSystemConfig(): Promise<ApiResponse<any>> {
    return this.request<any>('/system/config');
  }

  // Health check
  async getHealth(): Promise<ApiResponse<{ status: string }>> {
    return this.request<{ status: string }>('/health');
  }
}

// Singleton instance
let apiServiceInstance: ApiService | null = null;

export const getApiService = (): ApiService => {
  if (!apiServiceInstance) {
    apiServiceInstance = new ApiService();
  }
  return apiServiceInstance;
};

// Re-export types for convenience
export type {
  ApiResponse,
  OffChainOrder,
  OffChainOrderResponse,
  OrderBookSnapshot,
  TradeData,
  MarketStats,
  UserAccountData,
  SystemStatus,
  TradingPair,
};

export default ApiService;