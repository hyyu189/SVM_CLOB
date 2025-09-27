
import { CONFIG } from '../config/config';
import { getResilientWebSocketService, ResilientWebSocketService } from './resilient-websocket-service';
import { getMockWebSocketService, MockWebSocketService } from './mock-websocket-service';

export type AppWebSocketService = ResilientWebSocketService | MockWebSocketService;

let wsServiceInstance: AppWebSocketService | null = null;

export const getAppWebSocketService = (): AppWebSocketService => {
  if (!wsServiceInstance) {
    if (CONFIG.USE_MOCK_API) {
      console.log('Using Mock WebSocket Service for development/testing');
      wsServiceInstance = getMockWebSocketService();
    } else {
      console.log('Using Resilient WebSocket Service with real backend integration');
      wsServiceInstance = getResilientWebSocketService();
    }
  }
  return wsServiceInstance;
};
