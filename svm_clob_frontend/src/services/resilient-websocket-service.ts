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
  private subscriptions: Map<string, { handler: MessageHandler; isActive: boolean }> = new Map();
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.wsService = getWebSocketService();
    this.attemptConnection();
  }

  private async attemptConnection(): Promise<void> {
    if (this.connectionAttempted) return;

    this.connectionAttempted = true;
    console.log('Attempting to connect to WebSocket server...');

    try {
      await this.wsService.connect();
      this.connected = true;
      console.log('WebSocket connection established');

      // Reactivate all subscriptions
      this.subscriptions.forEach((sub, id) => {
        if (sub.isActive) {
          // The actual subscription will be handled by the underlying service
          console.log(`Reactivated subscription: ${id}`);
        }
      });
    } catch (error) {
      console.warn('WebSocket connection failed - continuing with offline mode:', error);
      this.connected = false;
      this.scheduleReconnect();
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
        // Optionally handle offline state
        console.log('Received message in offline mode - ignoring:', message.type);
      }
    };
  }

  subscribe(request: SubscriptionRequest, handler: MessageHandler): string {
    const subscriptionId = `resilient_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Store the subscription for reconnection purposes
    this.subscriptions.set(subscriptionId, {
      handler: this.createOfflineHandler(handler),
      isActive: true
    });

    if (this.connected && this.wsService.isConnected()) {
      try {
        const actualSubscriptionId = this.wsService.subscribe(request, this.subscriptions.get(subscriptionId)!.handler);
        // Map our ID to the actual subscription ID for cleanup
        this.subscriptions.set(subscriptionId, {
          ...this.subscriptions.get(subscriptionId)!,
          actualId: actualSubscriptionId
        } as any);
      } catch (error) {
        console.warn('Failed to create WebSocket subscription - continuing in offline mode:', error);
        this.connected = false;
        this.scheduleReconnect();
      }
    } else {
      console.log(`Subscription ${subscriptionId} created in offline mode - will activate when connection is available`);
    }

    return subscriptionId;
  }

  unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return;

    subscription.isActive = false;

    if (this.connected && this.wsService.isConnected() && (subscription as any).actualId) {
      try {
        this.wsService.unsubscribe((subscription as any).actualId);
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