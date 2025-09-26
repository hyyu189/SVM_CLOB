/**
 * Mock API Service
 *
 * Simulates the off-chain infrastructure API for development and testing.
 * In production, this would be replaced with actual API calls to the infrastructure.
 */

import { PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';

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

export class MockApiService {
  private orderIdCounter = 1;
  private orders: Map<number, OffChainOrderResponse> = new Map();
  private trades: TradeData[] = [];
  private sequenceNumber = 0;

  // Mock market data
  private currentPrice = 100.25;
  private priceHistory: { timestamp: number; price: number; volume: number }[] = [];

  constructor() {
    this.initializeMockData();
    this.startPriceSimulation();
  }

  private initializeMockData() {
    // Initialize some historical price data
    const now = Date.now();
    for (let i = 24; i >= 0; i--) {
      const timestamp = now - (i * 60 * 60 * 1000); // Hourly data for 24 hours
      const price = 100 + Math.sin(i * 0.5) * 5 + Math.random() * 2 - 1;
      const volume = 1000 + Math.random() * 2000;
      this.priceHistory.push({ timestamp, price, volume });
    }

    // Add some mock trades
    for (let i = 0; i < 20; i++) {
      const trade: TradeData = {
        maker_order_id: 1000 + i * 2,
        taker_order_id: 1001 + i * 2,
        price: this.currentPrice + (Math.random() - 0.5) * 2,
        quantity: Math.random() * 5 + 0.1,
        timestamp: Date.now() - (i * 30000),
        maker_side: Math.random() > 0.5 ? 'Bid' : 'Ask'
      };
      this.trades.unshift(trade);
    }
  }

  private startPriceSimulation() {
    // Simulate price movements every 5 seconds
    setInterval(() => {
      const change = (Math.random() - 0.5) * 0.5;
      this.currentPrice = Math.max(80, Math.min(120, this.currentPrice + change));

      // Add to history
      this.priceHistory.push({
        timestamp: Date.now(),
        price: this.currentPrice,
        volume: Math.random() * 100
      });

      // Keep only last 100 entries
      if (this.priceHistory.length > 100) {
        this.priceHistory.shift();
      }
    }, 5000);
  }

  private createResponse<T>(data: T): ApiResponse<T> {
    return {
      success: true,
      data,
      timestamp: Date.now()
    };
  }

  private createErrorResponse(code: string, message: string): ApiResponse<never> {
    return {
      success: false,
      error: { code, message },
      timestamp: Date.now()
    };
  }

  // Order Management
  async placeOrder(order: OffChainOrder, owner: string): Promise<ApiResponse<OffChainOrderResponse>> {
    const newOrder: OffChainOrderResponse = {
      order_id: this.orderIdCounter++,
      client_order_id: order.client_order_id,
      owner,
      side: order.side,
      order_type: order.order_type,
      price: order.price,
      quantity: order.quantity,
      remaining_quantity: order.quantity,
      status: 'Open',
      timestamp: Date.now(),
      expiry_timestamp: Date.now() + 24 * 60 * 60 * 1000 // 24 hours from now
    };

    this.orders.set(newOrder.order_id, newOrder);
    this.sequenceNumber++;

    // Simulate immediate execution for market orders or aggressive limit orders
    if (order.order_type === 'Market' || this.shouldMatchImmediately(order)) {
      const trade = this.simulateExecution(newOrder);
      if (trade) {
        this.trades.unshift(trade);
      }
    }

    return this.createResponse(newOrder);
  }

  private shouldMatchImmediately(order: OffChainOrder): boolean {
    // Simple simulation: match if price crosses current market
    if (order.side === 'Bid') {
      return order.price >= this.currentPrice;
    } else {
      return order.price <= this.currentPrice;
    }
  }

  private simulateExecution(order: OffChainOrderResponse): TradeData | null {
    // Simulate partial or full execution
    const executionQuantity = Math.min(order.remaining_quantity, Math.random() * order.quantity + 0.1);

    order.remaining_quantity -= executionQuantity;
    if (order.remaining_quantity <= 0.001) {
      order.status = 'Filled';
      order.remaining_quantity = 0;
    } else {
      order.status = 'PartiallyFilled';
    }

    return {
      maker_order_id: this.orderIdCounter + 1000, // Simulate maker order
      taker_order_id: order.order_id,
      price: order.price,
      quantity: executionQuantity,
      timestamp: Date.now(),
      maker_side: order.side === 'Bid' ? 'Ask' : 'Bid'
    };
  }

  async cancelOrder(orderId: number): Promise<ApiResponse<{ order_id: number; status: string; cancelled_at: number }>> {
    const order = this.orders.get(orderId);
    if (!order) {
      return this.createErrorResponse('ORDER_NOT_FOUND', 'Order not found');
    }

    if (order.status === 'Filled' || order.status === 'Cancelled') {
      return this.createErrorResponse('ORDER_NOT_CANCELLABLE', 'Order cannot be cancelled');
    }

    order.status = 'Cancelled';
    this.sequenceNumber++;

    return this.createResponse({
      order_id: orderId,
      status: 'Cancelled',
      cancelled_at: Date.now()
    });
  }

  async getOrder(orderId: number): Promise<ApiResponse<OffChainOrderResponse>> {
    const order = this.orders.get(orderId);
    if (!order) {
      return this.createErrorResponse('ORDER_NOT_FOUND', 'Order not found');
    }
    return this.createResponse(order);
  }

  async modifyOrder(
    orderId: number,
    updates: { new_price?: number; new_quantity?: number }
  ): Promise<ApiResponse<OffChainOrderResponse>> {
    const order = this.orders.get(orderId);
    if (!order) {
      return this.createErrorResponse('ORDER_NOT_FOUND', 'Order not found');
    }

    if (order.status !== 'Open' && order.status !== 'PartiallyFilled') {
      return this.createErrorResponse('ORDER_NOT_MODIFIABLE', 'Order cannot be modified');
    }

    if (updates.new_price !== undefined) {
      order.price = updates.new_price;
    }
    if (updates.new_quantity !== undefined) {
      order.quantity = updates.new_quantity;
      order.remaining_quantity = Math.min(order.remaining_quantity, updates.new_quantity);
    }

    this.sequenceNumber++;
    return this.createResponse(order);
  }

  // Market Data
  async getOrderBookSnapshot(levels = 10): Promise<ApiResponse<OrderBookSnapshot>> {
    // Generate mock order book around current price
    const bids: [number, number][] = [];
    const asks: [number, number][] = [];

    for (let i = 0; i < levels; i++) {
      const bidPrice = this.currentPrice - (i + 1) * 0.05;
      const askPrice = this.currentPrice + (i + 1) * 0.05;
      const bidQuantity = Math.random() * 10 + 1;
      const askQuantity = Math.random() * 10 + 1;

      bids.push([parseFloat(bidPrice.toFixed(2)), parseFloat(bidQuantity.toFixed(3))]);
      asks.push([parseFloat(askPrice.toFixed(2)), parseFloat(askQuantity.toFixed(3))]);
    }

    const snapshot: OrderBookSnapshot = {
      bids,
      asks,
      sequence_number: this.sequenceNumber,
      timestamp: Date.now()
    };

    return this.createResponse(snapshot);
  }

  async getRecentTrades(limit = 50): Promise<ApiResponse<TradeData[]>> {
    return this.createResponse(this.trades.slice(0, limit));
  }

  async getRecentTradesWithPagination(limit = 50): Promise<ApiResponse<TradeData[]>> {
    // This is just an alias for getRecentTrades for compatibility
    return this.getRecentTrades(limit);
  }

  async getMarketStats(): Promise<ApiResponse<MarketStats>> {
    const orderBook = await this.getOrderBookSnapshot();
    const snapshot = orderBook.data!;

    const bestBid = snapshot.bids.length > 0 ? snapshot.bids[0][0] : null;
    const bestAsk = snapshot.asks.length > 0 ? snapshot.asks[0][0] : null;
    const spread = bestBid && bestAsk ? bestAsk - bestBid : null;

    // Calculate 24h stats from price history
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const recent24h = this.priceHistory.filter(p => p.timestamp > dayAgo);

    const prices = recent24h.map(p => p.price);
    const high24h = Math.max(...prices);
    const low24h = Math.min(...prices);
    const volume24h = recent24h.reduce((sum, p) => sum + p.volume, 0);
    const firstPrice = recent24h[0]?.price || this.currentPrice;
    const change24h = ((this.currentPrice - firstPrice) / firstPrice) * 100;

    const stats: MarketStats = {
      best_bid: bestBid,
      best_ask: bestAsk,
      spread,
      last_price: this.currentPrice,
      '24h_volume': volume24h,
      '24h_high': high24h,
      '24h_low': low24h,
      '24h_change': change24h,
      total_bid_orders: snapshot.bids.length,
      total_ask_orders: snapshot.asks.length,
      price_levels_count: snapshot.bids.length + snapshot.asks.length
    };

    return this.createResponse(stats);
  }

  async getPriceHistory(hours = 24): Promise<ApiResponse<{ timestamp: number; price: number; volume: number }[]>> {
    const since = Date.now() - hours * 60 * 60 * 1000;
    const filtered = this.priceHistory.filter(p => p.timestamp > since);
    return this.createResponse(filtered);
  }

  // User Operations
  async getUserOrders(
    userId: string,
    options: { status?: string; limit?: number } = {}
  ): Promise<ApiResponse<OffChainOrderResponse[]>> {
    let userOrders = Array.from(this.orders.values()).filter(order => order.owner === userId);

    if (options.status) {
      userOrders = userOrders.filter(order => order.status === options.status);
    }

    if (options.limit) {
      userOrders = userOrders.slice(0, options.limit);
    }

    // Sort by timestamp descending
    userOrders.sort((a, b) => b.timestamp - a.timestamp);

    return this.createResponse(userOrders);
  }

  async getUserTrades(
    userId: string,
    options: { limit?: number; since?: number } = {}
  ): Promise<ApiResponse<TradeData[]>> {
    // In a real system, we'd track trades by user. For mock, return recent trades
    let userTrades = this.trades.slice(0, options.limit || 50);

    if (options.since) {
      userTrades = userTrades.filter(trade => trade.timestamp > options.since!);
    }

    return this.createResponse(userTrades);
  }

  async getUserAccountData(userId: string): Promise<ApiResponse<UserAccountData>> {
    const userOrders = await this.getUserOrders(userId);
    const userTrades = await this.getUserTrades(userId);

    const openOrders = userOrders.data?.filter(o => o.status === 'Open' || o.status === 'PartiallyFilled') || [];
    const totalVolume = userTrades.data?.reduce((sum, trade) => sum + trade.quantity, 0) || 0;

    const accountData: UserAccountData = {
      owner: userId,
      open_orders_count: openOrders.length,
      total_orders_placed: userOrders.data?.length || 0,
      total_volume_traded: totalVolume,
      is_initialized: true
    };

    return this.createResponse(accountData);
  }

  // System Information
  async getSystemStatus(): Promise<ApiResponse<SystemStatus>> {
    const status: SystemStatus = {
      status: 'healthy',
      uptime: 86400, // 24 hours
      version: '0.1.0-mock',
      components: {
        matching_engine: 'healthy',
        database: 'healthy',
        websocket: 'healthy'
      }
    };

    return this.createResponse(status);
  }

  async getTradingPairs(): Promise<ApiResponse<TradingPair[]>> {
    const pairs: TradingPair[] = [
      {
        symbol: 'SOL/USDC',
        base_mint: 'So11111111111111111111111111111111111111112',
        quote_mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        tick_size: 0.01,
        min_order_size: 0.001,
        status: 'active'
      }
    ];

    return this.createResponse(pairs);
  }

  async getPublicConfig(): Promise<ApiResponse<any>> {
    const config = {
      tick_sizes: { 'SOL/USDC': 0.01 },
      min_order_sizes: { 'SOL/USDC': 0.001 },
      trading_fees: { maker: 0.001, taker: 0.002 },
      max_orders_per_user: 100,
      supported_order_types: ['Limit', 'Market', 'PostOnly'],
      supported_time_in_force: ['GoodTillCancelled', 'ImmediateOrCancel', 'FillOrKill']
    };

    return this.createResponse(config);
  }
}

// Singleton instance
let apiServiceInstance: MockApiService | null = null;

export const getMockApiService = (): MockApiService => {
  if (!apiServiceInstance) {
    apiServiceInstance = new MockApiService();
  }
  return apiServiceInstance;
};

export default MockApiService;