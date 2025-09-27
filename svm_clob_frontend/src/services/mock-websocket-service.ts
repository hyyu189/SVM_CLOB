/**
 * Mock WebSocket Service
 *
 * Simulates real-time market data and order updates for development.
 * In production, this would connect to the actual WebSocket server.
 */

import { getMockApiService } from './mock-api-service';
import type { OrderBookSnapshot, TradeData, OffChainOrderResponse } from './api-types';

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: number;
}

export interface Subscription {
  id: string;
  type: 'OrderBook' | 'Trades' | 'UserOrders' | 'AllMarkets';
  market?: string;
  user?: string;
}

export class MockWebSocketService {
  private subscribers: Map<string, (message: WebSocketMessage) => void> = new Map();
  private subscriptions: Map<string, Subscription> = new Map();
  private intervalIds: Map<string, NodeJS.Timeout> = new Map();
  private isConnected = false;
  private apiService = getMockApiService();

  connect(): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        this.isConnected = true;
        console.log('Mock WebSocket connected');
        resolve();
      }, 100);
    });
  }

  disconnect(): void {
    this.isConnected = false;
    this.subscribers.clear();
    this.subscriptions.clear();

    // Clear all intervals
    this.intervalIds.forEach((intervalId) => {
      clearInterval(intervalId);
    });
    this.intervalIds.clear();

    console.log('Mock WebSocket disconnected');
  }

  subscribe(
    subscription: Omit<Subscription, 'id'>,
    callback: (message: WebSocketMessage) => void
  ): string {
    const id = Math.random().toString(36).substr(2, 9);
    const fullSubscription: Subscription = { ...subscription, id };

    this.subscribers.set(id, callback);
    this.subscriptions.set(id, fullSubscription);

    this.startDataGeneration(id, fullSubscription);

    console.log(`Subscribed to ${subscription.type}:`, fullSubscription);
    return id;
  }

  unsubscribe(subscriptionId: string): void {
    this.subscribers.delete(subscriptionId);
    this.subscriptions.delete(subscriptionId);

    const intervalId = this.intervalIds.get(subscriptionId);
    if (intervalId) {
      clearInterval(intervalId);
      this.intervalIds.delete(subscriptionId);
    }

    console.log(`Unsubscribed from ${subscriptionId}`);
  }

  private startDataGeneration(subscriptionId: string, subscription: Subscription): void {
    switch (subscription.type) {
      case 'OrderBook':
        this.startOrderBookUpdates(subscriptionId);
        break;
      case 'Trades':
        this.startTradeUpdates(subscriptionId);
        break;
      case 'UserOrders':
        this.startUserOrderUpdates(subscriptionId, subscription.user!);
        break;
      case 'AllMarkets':
        this.startAllMarketsUpdates(subscriptionId);
        break;
    }
  }

  private startOrderBookUpdates(subscriptionId: string): void {
    // Send initial snapshot
    this.sendOrderBookUpdate(subscriptionId);

    // Send updates every 2 seconds
    const intervalId = setInterval(() => {
      this.sendOrderBookUpdate(subscriptionId);
    }, 2000);

    this.intervalIds.set(subscriptionId, intervalId);
  }

  private async sendOrderBookUpdate(subscriptionId: string): Promise<void> {
    const callback = this.subscribers.get(subscriptionId);
    if (!callback) return;

    try {
      const response = await this.apiService.getOrderBookSnapshot(10);
      if (response.success && response.data) {
        const message: WebSocketMessage = {
          type: 'MarketData',
          data: {
            update_type: 'OrderBookUpdate',
            order_book: response.data
          },
          timestamp: Date.now()
        };
        callback(message);
      }
    } catch (error) {
      console.error('Error sending order book update:', error);
    }
  }

  private startTradeUpdates(subscriptionId: string): void {
    // Send new trade every 5-10 seconds
    const intervalId = setInterval(() => {
      this.sendTradeUpdate(subscriptionId);
    }, 5000 + Math.random() * 5000);

    this.intervalIds.set(subscriptionId, intervalId);
  }

  private sendTradeUpdate(subscriptionId: string): void {
    const callback = this.subscribers.get(subscriptionId);
    if (!callback) return;

    // Generate a mock trade
    const currentPrice = 100.25 + (Math.random() - 0.5) * 2;
    const trade: TradeData = {
      maker_order_id: Math.floor(Math.random() * 10000),
      taker_order_id: Math.floor(Math.random() * 10000),
      price: parseFloat(currentPrice.toFixed(2)),
      quantity: parseFloat((Math.random() * 5 + 0.1).toFixed(3)),
      timestamp: Date.now(),
      maker_side: Math.random() > 0.5 ? 'Bid' : 'Ask'
    };

    const message: WebSocketMessage = {
      type: 'MarketData',
      data: {
        update_type: 'TradeExecution',
        trade
      },
      timestamp: Date.now()
    };

    callback(message);
  }

  private startUserOrderUpdates(subscriptionId: string, userId: string): void {
    // Send order updates occasionally (simulate order fills, etc.)
    const intervalId = setInterval(() => {
      this.sendUserOrderUpdate(subscriptionId, userId);
    }, 10000 + Math.random() * 10000);

    this.intervalIds.set(subscriptionId, intervalId);
  }

  private async sendUserOrderUpdate(subscriptionId: string, userId: string): Promise<void> {
    const callback = this.subscribers.get(subscriptionId);
    if (!callback) return;

    try {
      // Get user's orders and simulate an update on one of them
      const response = await this.apiService.getUserOrders(userId, { status: 'Open' });
      if (response.success && response.data && response.data.length > 0) {
        const randomOrder = response.data[Math.floor(Math.random() * response.data.length)];

        // Simulate partial fill
        if (randomOrder.status === 'Open' && Math.random() > 0.7) {
          const fillQuantity = Math.min(randomOrder.remaining_quantity, Math.random() * randomOrder.quantity / 2);
          randomOrder.remaining_quantity -= fillQuantity;

          if (randomOrder.remaining_quantity <= 0.001) {
            randomOrder.status = 'Filled';
            randomOrder.remaining_quantity = 0;
          } else {
            randomOrder.status = 'PartiallyFilled';
          }

          const message: WebSocketMessage = {
            type: 'OrderUpdate',
            data: {
              order: randomOrder
            },
            timestamp: Date.now()
          };

          callback(message);
        }
      }
    } catch (error) {
      console.error('Error sending user order update:', error);
    }
  }

  private startAllMarketsUpdates(subscriptionId: string): void {
    // Send market stats updates every 30 seconds
    const intervalId = setInterval(() => {
      this.sendAllMarketsUpdate(subscriptionId);
    }, 30000);

    this.intervalIds.set(subscriptionId, intervalId);
  }

  private async sendAllMarketsUpdate(subscriptionId: string): Promise<void> {
    const callback = this.subscribers.get(subscriptionId);
    if (!callback) return;

    try {
      const [statsResponse, tradesResponse] = await Promise.all([
        this.apiService.getMarketStats(),
        this.apiService.getRecentTrades(5)
      ]);

      if (statsResponse.success && tradesResponse.success) {
        const message: WebSocketMessage = {
          type: 'AllMarketsUpdate',
          data: {
            markets: {
              'SOL/USDC': {
                stats: statsResponse.data,
                recent_trades: tradesResponse.data
              }
            }
          },
          timestamp: Date.now()
        };

        callback(message);
      }
    } catch (error) {
      console.error('Error sending all markets update:', error);
    }
  }

  isSocketConnected(): boolean {
    return this.isConnected;
  }

  // Simulate connection events
  simulateDisconnection(): void {
    if (this.isConnected) {
      this.isConnected = false;
      console.log('Mock WebSocket simulated disconnection');

      // Notify all subscribers
      this.subscribers.forEach((callback) => {
        const message: WebSocketMessage = {
          type: 'ConnectionStatus',
          data: { status: 'disconnected' },
          timestamp: Date.now()
        };
        callback(message);
      });
    }
  }

  simulateReconnection(): void {
    if (!this.isConnected) {
      this.connect().then(() => {
        // Notify all subscribers and restart data generation
        this.subscribers.forEach((callback) => {
          const message: WebSocketMessage = {
            type: 'ConnectionStatus',
            data: { status: 'connected' },
            timestamp: Date.now()
          };
          callback(message);
        });

        // Restart all subscriptions
        this.subscriptions.forEach((subscription, id) => {
          this.startDataGeneration(id, subscription);
        });
      });
    }
  }
}

// Singleton instance
let wsServiceInstance: MockWebSocketService | null = null;

export const getMockWebSocketService = (): MockWebSocketService => {
  if (!wsServiceInstance) {
    wsServiceInstance = new MockWebSocketService();
  }
  return wsServiceInstance;
};

export default MockWebSocketService;