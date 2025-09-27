/**
 * Resilient WebSocket Service
 *
 * A wrapper around the WebSocket service that provides fallback behavior
 * when the WebSocket server is unavailable. This ensures the frontend remains
 * functional even when real-time data is not available.
 */

import { CONFIG } from '../config/config';
import { getWebSocketService, WebSocketService, WebSocketMessage, SubscriptionRequest, MessageHandler } from './websocket-service';

export class ResilientWebSocketService {
  private wsService: WebSocketService;
  private connected: boolean = false;
  private connectionAttempted: boolean = false;
  private subscriptions: Map<string, {
    handler: MessageHandler;
    request: SubscriptionRequest;
    isActive: boolean;
    actualId?: string;
  }> = new Map();
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.wsService = getWebSocketService();
    this.attemptConnection().catch(error => {
      console.warn('Initial WebSocket connection attempt failed:', error);
    });
  }

  private async attemptConnection(): Promise<void> {
    if (this.connectionAttempted && (this.connected || this.wsService.isConnected())) {
      return;
    }

    this.connectionAttempted = true;

    try {
      await this.wsService.connect();
      this.connected = true;

      this.subscriptions.forEach((sub, id) => {
        if (sub.isActive) {
          try {
            const actualId = this.wsService.subscribe(sub.request, sub.handler);
            this.subscriptions.set(id, { ...sub, actualId });
          } catch (subscriptionError) {
            console.warn('Failed to restore WebSocket subscription', subscriptionError);
          }
        }
      });
    } catch (error) {
      this.connected = false;
      this.connectionAttempted = false;
      this.scheduleReconnect();
      const message = error instanceof Error ? error.message : 'WebSocket connection failed';
      throw new Error(message);
    }
  }

  // Public connect method for compatibility
  async connect(): Promise<void> {
    return this.attemptConnection();
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(() => {
      this.connectionAttempted = false;
      this.attemptConnection();
    }, CONFIG.WEBSOCKET_RECONNECT_INTERVAL);
  }

  private createOfflineHandler(originalHandler: MessageHandler): MessageHandler {
    return (message: WebSocketMessage) => {
      if (this.connected && this.wsService.isConnected()) {
        originalHandler(message);
      } else {
        console.debug('WebSocket message skipped in offline mode:', message.type);
      }
    };
  }

  subscribe(request: SubscriptionRequest, handler: MessageHandler): string {
    const subscriptionId = `resilient_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const wrappedHandler = this.createOfflineHandler(handler);

    // Store the subscription for reconnection purposes
    this.subscriptions.set(subscriptionId, {
      handler: wrappedHandler,
      request,
      isActive: true,
    });

    if (this.connected && this.wsService.isConnected()) {
      try {
        const subscription = this.subscriptions.get(subscriptionId);
        if (!subscription) {
          return subscriptionId;
        }

        const actualSubscriptionId = this.wsService.subscribe(request, subscription.handler);
        this.subscriptions.set(subscriptionId, {
          ...subscription,
          actualId: actualSubscriptionId,
        });
      } catch (error) {
        console.warn('Failed to create WebSocket subscription - continuing in offline mode:', error);
        this.connected = false;
        this.scheduleReconnect();
      }
    } else {
      this.connected = false;

      if (!this.connectionAttempted && !this.reconnectTimer) {
        this.attemptConnection().catch(connectionError => {
          console.warn('WebSocket connection attempt failed:', connectionError);
        });
      }

      console.info('WebSocket offline – subscription registered for future reconnection.');
    }

    return subscriptionId;
  }

  unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return;

    subscription.isActive = false;

    if (this.connected && this.wsService.isConnected() && subscription.actualId) {
      try {
        this.wsService.unsubscribe(subscription.actualId);
      } catch (error) {
        console.warn('Failed to unsubscribe from WebSocket:', error);
      }
    }

    this.subscriptions.delete(subscriptionId);
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.subscriptions.forEach((_, id) => {
      this.unsubscribe(id);
    });

    if (this.connected) {
      try {
        this.wsService.disconnect();
      } catch (error) {
        console.warn('Error disconnecting WebSocket:', error);
      }
    }

    this.connected = false;
    this.connectionAttempted = false;
  }

  isConnected(): boolean {
    return this.connected && this.wsService.isConnected();
  }

  async reconnect(): Promise<void> {
    this.disconnect();
    await new Promise(resolve => setTimeout(resolve, 1000)); // Brief delay
    await this.attemptConnection();
  }

  getConnectionStatus(): {
    connected: boolean;
    attempted: boolean;
    activeSubscriptions: number;
  } {
    return {
      connected: this.connected,
      attempted: this.connectionAttempted,
      activeSubscriptions: Array.from(this.subscriptions.values()).filter(sub => sub.isActive).length
    };
  }
}

// Singleton instance
let resilientWsServiceInstance: ResilientWebSocketService | null = null;

export const getResilientWebSocketService = (): ResilientWebSocketService => {
  if (!resilientWsServiceInstance) {
    resilientWsServiceInstance = new ResilientWebSocketService();
  }
  return resilientWsServiceInstance;
};

export default ResilientWebSocketService;
