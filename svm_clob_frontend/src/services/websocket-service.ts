/**
 * SVM CLOB WebSocket Service
 *
 * Connects to the svm_clob_infra WebSocket server for real-time market data.
 * Based on the WebSocket specification from svm_clob_infra/README.md
 */

// Subscription types (matching svm_clob_infra specification)
export interface SubscriptionRequest {
  type: 'OrderBook' | 'Trades' | 'UserOrders' | 'AllMarkets';
  market?: string;
  user?: string;
}

// WebSocket message types (matching svm_clob_infra specification)
export interface WebSocketMessage {
  type: 'MarketData' | 'OrderUpdate' | 'ConnectionStatus' | 'Error' | 'Subscribe' | 'Unsubscribe';
  data: any;
  timestamp?: number;
  sequence_id?: number;
}

// Market data update types
export interface MarketDataMessage extends WebSocketMessage {
  type: 'MarketData';
  data: {
    update_type: 'OrderBookUpdate' | 'TradeExecution';
    order_book?: {
      bids: Array<[number, number]>;
      asks: Array<[number, number]>;
      sequence_number: number;
      timestamp: number;
    };
    trade?: {
      maker_order_id: number;
      taker_order_id: number;
      price: number;
      quantity: number;
      timestamp: number;
      maker_side: 'Ask' | 'Bid';
    };
  };
}

// User order update message
export interface OrderUpdateMessage extends WebSocketMessage {
  type: 'OrderUpdate';
  data: {
    order: {
      order_id: number;
      client_order_id: number;
      owner: string;
      side: 'Bid' | 'Ask';
      order_type: 'Limit' | 'Market';
      price: number;
      quantity: number;
      remaining_quantity: number;
      status: 'Open' | 'PartiallyFilled' | 'Filled' | 'Cancelled';
      timestamp: number;
    };
  };
}

export type MessageHandler = (message: WebSocketMessage) => void;

export interface Subscription {
  id: string;
  request: SubscriptionRequest;
  handler: MessageHandler;
}

import { CONFIG } from '../config/config';

// svm_clob_infra WebSocket server URL
const WS_BASE_URL = CONFIG.WS_BASE_URL;

export class WebSocketService {
  private ws: WebSocket | null = null;
  private subscriptions = new Map<string, Subscription>();
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = CONFIG.WEBSOCKET_RECONNECT_ATTEMPTS;
  private reconnectInterval = CONFIG.WEBSOCKET_RECONNECT_INTERVAL;
  private connected = false;

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(WS_BASE_URL);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.connected = true;
          this.reconnectAttempts = 0;

          // Re-subscribe to all existing subscriptions
          this.subscriptions.forEach(sub => {
            this.sendSubscriptionRequest(sub.request, sub.id);
          });

          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onclose = () => {
          console.log('WebSocket disconnected');
          this.connected = false;
          this.handleDisconnection();
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.connected = false;
          reject(new Error('WebSocket connection failed'));
        };

        // Timeout for connection
        setTimeout(() => {
          if (!this.connected) {
            reject(new Error('WebSocket connection timeout'));
          }
        }, 10000);
      } catch (error) {
        reject(error);
      }
    });
  }

  private handleMessage(message: WebSocketMessage) {
    // Broadcast to all subscriptions that might be interested
    this.subscriptions.forEach(sub => {
      try {
        sub.handler(message);
      } catch (error) {
        console.error('Error in subscription handler:', error);
      }
    });
  }

  private handleDisconnection() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    // Attempt reconnection if we haven't exceeded max attempts
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

      this.reconnectTimer = setTimeout(() => {
        this.connect().catch(error => {
          console.error('Reconnection failed:', error);
        });
      }, this.reconnectInterval);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  private sendSubscriptionRequest(request: SubscriptionRequest, subscriptionId: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('Cannot send subscription request: WebSocket not connected');
      return;
    }

    // Send subscription message matching svm_clob_infra format
    const message = {
      type: 'Subscribe',
      subscription_id: subscriptionId,
      subscription: request
    };

    this.ws.send(JSON.stringify(message));
  }

  subscribe(request: SubscriptionRequest, handler: MessageHandler): string {
    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const subscription: Subscription = {
      id: subscriptionId,
      request,
      handler
    };

    this.subscriptions.set(subscriptionId, subscription);

    // Send subscription request if connected
    if (this.connected) {
      this.sendSubscriptionRequest(request, subscriptionId);
    }

    return subscriptionId;
  }

  unsubscribe(subscriptionId: string) {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return;

    // Send unsubscription request if connected
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message = {
        type: 'Unsubscribe',
        subscription_id: subscriptionId
      };
      this.ws.send(JSON.stringify(message));
    }

    this.subscriptions.delete(subscriptionId);
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.connected = false;
    this.subscriptions.clear();
  }

  isConnected(): boolean {
    return this.connected && this.ws?.readyState === WebSocket.OPEN;
  }
}

// Singleton instance
let wsServiceInstance: WebSocketService | null = null;

export const getWebSocketService = (): WebSocketService => {
  if (!wsServiceInstance) {
    wsServiceInstance = new WebSocketService();
  }
  return wsServiceInstance;
};

export default WebSocketService;