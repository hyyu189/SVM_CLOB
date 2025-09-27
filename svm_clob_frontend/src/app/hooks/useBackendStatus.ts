import { useQuery } from '@tanstack/react-query';
import { useAppServices } from '../providers/useAppServices';
import type { ApiResponse, MarketStats, SystemStatus } from '../../services/api-types';

export interface BackendStatusViewModel {
  connected: boolean;
  loading: boolean;
  marketStats: MarketStats | null;
  systemStatus: SystemStatus | null;
  health: ApiResponse<{ status: string }> | null;
}

export const useBackendStatus = (): BackendStatusViewModel => {
  const { api } = useAppServices();
  const healthQuery = useQuery({
    queryKey: ['system', 'health'],
    queryFn: () => api.getHealth(),
    refetchInterval: 30_000,
  });

  const isHealthy = healthQuery.data?.data?.status === 'ok';

  const marketStatsQuery = useQuery({
    queryKey: ['system', 'market-stats'],
    queryFn: () => api.getMarketStats(),
    refetchInterval: 30_000,
    enabled: isHealthy,
  });

  const systemStatusQuery = useQuery({
    queryKey: ['system', 'status'],
    queryFn: () => api.getSystemStatus(),
    refetchInterval: 60_000,
    enabled: isHealthy,
  });

  return {
    connected: Boolean(isHealthy),
    loading: healthQuery.isLoading,
    marketStats: marketStatsQuery.data?.data ?? null,
    systemStatus: systemStatusQuery.data?.data ?? null,
    health: healthQuery.data ?? null,
  };
};
