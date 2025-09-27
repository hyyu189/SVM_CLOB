import { ReactNode, useMemo } from 'react';
import { getAppApiService } from '../../services/service-factory';
import { getResilientWebSocketService } from '../../services/resilient-websocket-service';
import { AppServicesContext, AppServicesContextValue } from './AppServicesContext';

interface AppServicesProviderProps {
  children: ReactNode;
}

export const AppServicesProvider = ({ children }: AppServicesProviderProps) => {
  const value = useMemo<AppServicesContextValue>(() => ({
    api: getAppApiService(),
    ws: getResilientWebSocketService(),
  }), []);

  return (
    <AppServicesContext.Provider value={value}>
      {children}
    </AppServicesContext.Provider>
  );
};

export default AppServicesProvider;
