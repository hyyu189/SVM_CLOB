/**
 * Resilient API Service
 *
 * A wrapper around the API service that surfaces connectivity status and avoids serving
 * fabricated market data. When the backend is unavailable the UI receives explicit
 * `BACKEND_OFFLINE` errors so it can render connection warnings instead of mock values.
 */

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

  private createOfflineErrorResponse<T>(message = 'Backend infrastructure is not available.'): ApiResponse<T> {
    return {
      success: false,
      error: {
        code: 'BACKEND_OFFLINE',
        message,
      },
      timestamp: Date.now()
    };
  }

  // Order Management with fallbacks
  async placeOrder(order: OffChainOrder, owner: string): Promise<ApiResponse<OffChainOrderResponse>> {
    if (!(await this.checkBackendHealth())) {
      return this.createOfflineErrorResponse<OffChainOrderResponse>('Backend infrastructure is not available.');
    }
    return this.apiService.placeOrder(order, owner);
  }

  async cancelOrder(orderId: number): Promise<ApiResponse<{ order_id: number; status: string }>> {
    if (!(await this.checkBackendHealth())) {
      return this.createOfflineErrorResponse<{ order_id: number; status: string }>('Backend infrastructure is not available.');
    }
    return this.apiService.cancelOrder(orderId);
  }

  async getOrder(orderId: number): Promise<ApiResponse<OffChainOrderResponse>> {
    if (!(await this.checkBackendHealth())) {
      return this.createOfflineErrorResponse<OffChainOrderResponse>('Backend infrastructure is not available.');
    }
    return this.apiService.getOrder(orderId);
  }

  // Market Data with fallbacks
  async getOrderBookSnapshot(levels = 20): Promise<ApiResponse<OrderBookSnapshot>> {
    if (!(await this.checkBackendHealth())) {
      return this.createOfflineErrorResponse<OrderBookSnapshot>('Order book service is offline.');
    }
    return this.apiService.getOrderBookSnapshot(levels);
  }

  async getRecentTrades(limit = 50): Promise<ApiResponse<TradeData[]>> {
    if (!(await this.checkBackendHealth())) {
      return this.createOfflineErrorResponse<TradeData[]>('Recent trade service is offline.');
    }
    return this.apiService.getRecentTrades(limit);
  }

  async getRecentTradesWithPagination(limit = 50): Promise<ApiResponse<TradeData[]>> {
    // This is just an alias for getRecentTrades for compatibility
    return this.getRecentTrades(limit);
  }

  async getMarketStats(): Promise<ApiResponse<MarketStats>> {
    if (!(await this.checkBackendHealth())) {
      return this.createOfflineErrorResponse<MarketStats>('Market statistics service is offline.');
    }
    return this.apiService.getMarketStats();
  }

  async getMarketDepth(): Promise<ApiResponse<OrderBookSnapshot>> {
    return this.getOrderBookSnapshot(50); // Depth typically shows more levels
  }

  async getPriceHistory(hours = 24): Promise<ApiResponse<{ timestamp: number; price: number; volume: number }[]>> {
    if (!(await this.checkBackendHealth())) {
      return this.createOfflineErrorResponse<{ timestamp: number; price: number; volume: number }[]>('Price history service is offline.');
    }
    return this.apiService.getPriceHistory(hours);
  }

  // User operations (surface offline errors, no mock data)
  async getUserOrders(
    userId: string,
    options: { status?: 'Open' | 'PartiallyFilled' | 'Filled' | 'Cancelled'; limit?: number } = {}
  ): Promise<ApiResponse<OffChainOrderResponse[]>> {
    if (!(await this.checkBackendHealth())) {
      return this.createOfflineErrorResponse<OffChainOrderResponse[]>('User order service is offline.');
    }
    return this.apiService.getUserOrders(userId, options);
  }

  async getUserTrades(userId: string, limit = 50): Promise<ApiResponse<TradeData[]>> {
    if (!(await this.checkBackendHealth())) {
      return this.createOfflineErrorResponse<TradeData[]>('User trade service is offline.');
    }
    return this.apiService.getUserTrades(userId, limit);
  }

  async getUserAccount(userId: string): Promise<ApiResponse<UserAccountData>> {
    if (!(await this.checkBackendHealth())) {
      return this.createOfflineErrorResponse<UserAccountData>('User account service is offline.');
    }
    return this.apiService.getUserAccount(userId);
  }

  // System operations
  async getSystemStatus(): Promise<ApiResponse<SystemStatus>> {
    if (!(await this.checkBackendHealth())) {
      return this.createOfflineErrorResponse<SystemStatus>('System status service is offline.');
    }
    return this.apiService.getSystemStatus();
  }

  async getAvailableMarkets(): Promise<ApiResponse<TradingPair[]>> {
    if (!(await this.checkBackendHealth())) {
      return this.createOfflineErrorResponse<TradingPair[]>('Market discovery service is offline.');
    }
    return this.apiService.getAvailableMarkets();
  }

  async getSystemConfig(): Promise<ApiResponse<any>> {
    if (!(await this.checkBackendHealth())) {
      return this.createOfflineErrorResponse('System configuration service is offline.');
    }
    return this.apiService.getSystemConfig();
  }

  // Health check
  async getHealth(): Promise<ApiResponse<{ status: string }>> {
    return this.apiService.getHealth();
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
