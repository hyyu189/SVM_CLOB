import { createContext } from 'react';
import type { AppApiService } from '../../services/service-factory';
import type { ResilientWebSocketService } from '../../services/resilient-websocket-service';

export type AppServicesContextValue = {
  api: AppApiService;
  ws: ResilientWebSocketService;
};

export const AppServicesContext = createContext<AppServicesContextValue | null>(null);
