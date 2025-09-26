/**
 * Resilient API Service
 *
 * A wrapper around the API service that provides fallback data and graceful error handling
 * when the backend is unavailable. This ensures the frontend remains functional even when
 * the backend infrastructure is not running.
 */

import { CONFIG } from '../config/config';
import { ApiService } from './api-service';
import type {
  ApiResponse,
  OffChainOrder,
  OffChainOrderResponse,
  OrderBookSnapshot,
  TradeData,
  MarketStats,
  UserAccountData,
  SystemStatus,
  TradingPair
} from './api-types';

export class ResilientApiService {
  private apiService: ApiService;
  private backendAvailable: boolean = true;
  private lastHealthCheck: number = 0;
  private healthCheckInterval: number = 30000; // 30 seconds

  constructor() {
    this.apiService = new ApiService();
  }

  private async checkBackendHealth(): Promise<boolean> {
    const now = Date.now();
    if (now - this.lastHealthCheck < this.healthCheckInterval) {
      return this.backendAvailable;
    }

    try {
      const response = await this.apiService.getHealth();
      this.backendAvailable = response.success;
      this.lastHealthCheck = now;
      return this.backendAvailable;
    } catch {
      this.backendAvailable = false;
      this.lastHealthCheck = now;
      return false;
    }
  }

  private createFallbackResponse<T>(data: T): ApiResponse<T> {
    return {
      success: true,
      data,
      timestamp: Date.now()
    };
  }

  private createOfflineErrorResponse<T>(): ApiResponse<T> {
    return {
      success: false,
      error: {
        code: 'BACKEND_OFFLINE',
        message: 'Backend infrastructure is not available. Using fallback data.'
      },
      timestamp: Date.now()
    };
  }

  // Order Management with fallbacks
  async placeOrder(order: OffChainOrder, owner: string): Promise<ApiResponse<OffChainOrderResponse>> {
    if (!(await this.checkBackendHealth())) {
      return this.createOfflineErrorResponse<OffChainOrderResponse>();
    }
    return this.apiService.placeOrder(order, owner);
  }

  async cancelOrder(orderId: number): Promise<ApiResponse<{ order_id: number; status: string }>> {
    if (!(await this.checkBackendHealth())) {
      return this.createOfflineErrorResponse<{ order_id: number; status: string }>();
    }
    return this.apiService.cancelOrder(orderId);
  }

  async getOrder(orderId: number): Promise<ApiResponse<OffChainOrderResponse>> {
    if (!(await this.checkBackendHealth())) {
      return this.createOfflineErrorResponse<OffChainOrderResponse>();
    }
    return this.apiService.getOrder(orderId);
  }

  // Market Data with fallbacks
  async getOrderBookSnapshot(levels = 20): Promise<ApiResponse<OrderBookSnapshot>> {
    if (!(await this.checkBackendHealth())) {
      // Return empty order book
      return this.createFallbackResponse<OrderBookSnapshot>({
        bids: [],
        asks: [],
        sequence_number: 0,
        timestamp: Date.now()
      });
    }
    return this.apiService.getOrderBookSnapshot(levels);
  }

  async getRecentTrades(limit = 50): Promise<ApiResponse<TradeData[]>> {
    if (!(await this.checkBackendHealth())) {
      // Return empty trades array
      return this.createFallbackResponse<TradeData[]>([]);
    }
    return this.apiService.getRecentTrades(limit);
  }

  async getRecentTradesWithPagination(limit = 50): Promise<ApiResponse<TradeData[]>> {
    // This is just an alias for getRecentTrades for compatibility
    return this.getRecentTrades(limit);
  }

  async getMarketStats(): Promise<ApiResponse<MarketStats>> {
    if (!(await this.checkBackendHealth())) {
      // Return default market stats
      return this.createFallbackResponse<MarketStats>({
        best_bid: CONFIG.DEFAULT_FALLBACK_DATA.best_bid,
        best_ask: CONFIG.DEFAULT_FALLBACK_DATA.best_ask,
        spread: CONFIG.DEFAULT_FALLBACK_DATA.spread,
        last_price: CONFIG.DEFAULT_FALLBACK_DATA.last_price,
        '24h_volume': CONFIG.DEFAULT_FALLBACK_DATA['24h_volume'],
        '24h_high': CONFIG.DEFAULT_FALLBACK_DATA['24h_high'],
        '24h_low': CONFIG.DEFAULT_FALLBACK_DATA['24h_low'],
        '24h_change': CONFIG.DEFAULT_FALLBACK_DATA['24h_change'],
        total_bid_orders: CONFIG.DEFAULT_FALLBACK_DATA.total_bid_orders,
        total_ask_orders: CONFIG.DEFAULT_FALLBACK_DATA.total_ask_orders,
        price_levels_count: 0
      });
    }
    return this.apiService.getMarketStats();
  }

  async getMarketDepth(): Promise<ApiResponse<OrderBookSnapshot>> {
    return this.getOrderBookSnapshot(50); // Depth typically shows more levels
  }

  async getPriceHistory(hours = 24): Promise<ApiResponse<{ timestamp: number; price: number; volume: number }[]>> {
    if (!(await this.checkBackendHealth())) {
      // Return minimal price history with current price
      const now = Date.now();
      const price = CONFIG.DEFAULT_FALLBACK_DATA.last_price;
      return this.createFallbackResponse([
        { timestamp: now - (hours * 60 * 60 * 1000), price, volume: 0 },
        { timestamp: now, price, volume: 0 }
      ]);
    }
    return this.apiService.getPriceHistory(hours);
  }

  // User Operations with fallbacks
  async getUserOrders(
    userId: string,
    options: { status?: 'Open' | 'PartiallyFilled' | 'Filled' | 'Cancelled'; limit?: number } = {}
  ): Promise<ApiResponse<OffChainOrderResponse[]>> {
    if (!(await this.checkBackendHealth())) {
      return this.createFallbackResponse<OffChainOrderResponse[]>([]);
    }
    return this.apiService.getUserOrders(userId, options);
  }

  async getUserTrades(userId: string, limit = 50): Promise<ApiResponse<TradeData[]>> {
    if (!(await this.checkBackendHealth())) {
      return this.createFallbackResponse<TradeData[]>([]);
    }
    return this.apiService.getUserTrades(userId, limit);
  }

  async getUserAccount(userId: string): Promise<ApiResponse<UserAccountData>> {
    if (!(await this.checkBackendHealth())) {
      return this.createFallbackResponse<UserAccountData>({
        owner: userId,
        open_orders_count: 0,
        total_orders_placed: 0,
        total_volume_traded: 0,
        is_initialized: false
      });
    }
    return this.apiService.getUserAccount(userId);
  }

  // System Operations with fallbacks
  async getSystemStatus(): Promise<ApiResponse<SystemStatus>> {
    if (!(await this.checkBackendHealth())) {
      return this.createFallbackResponse<SystemStatus>({
        status: 'down',
        uptime: 0,
        version: 'unknown',
        components: {
          matching_engine: 'down',
          database: 'down',
          websocket: 'down'
        }
      });
    }
    return this.apiService.getSystemStatus();
  }

  async getAvailableMarkets(): Promise<ApiResponse<TradingPair[]>> {
    if (!(await this.checkBackendHealth())) {
      // Return default SOL/USDC market
      return this.createFallbackResponse<TradingPair[]>([
        {
          symbol: 'SOL/USDC',
          base_mint: 'So11111111111111111111111111111111111111112',
          quote_mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          tick_size: 1000,
          min_order_size: 1000000,
          status: 'active'
        }
      ]);
    }
    return this.apiService.getAvailableMarkets();
  }

  async getSystemConfig(): Promise<ApiResponse<any>> {
    if (!(await this.checkBackendHealth())) {
      return this.createFallbackResponse({
        default_market: 'SOL/USDC',
        tick_size: 1000,
        min_order_size: 1000000
      });
    }
    return this.apiService.getSystemConfig();
  }

  // Health check
  async getHealth(): Promise<ApiResponse<{ status: string }>> {
    const isHealthy = await this.checkBackendHealth();
    return this.createFallbackResponse({
      status: isHealthy ? 'ok' : 'offline'
    });
  }

  // Utility methods
  isBackendAvailable(): boolean {
    return this.backendAvailable;
  }

  async refreshBackendStatus(): Promise<boolean> {
    this.lastHealthCheck = 0; // Force health check
    return this.checkBackendHealth();
  }
}

// Singleton instance
let resilientApiServiceInstance: ResilientApiService | null = null;

export const getResilientApiService = (): ResilientApiService => {
  if (!resilientApiServiceInstance) {
    resilientApiServiceInstance = new ResilientApiService();
  }
  return resilientApiServiceInstance;
};

export default ResilientApiService;