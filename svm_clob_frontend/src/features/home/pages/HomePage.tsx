import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { HomeView } from '../../../components/HomeView';
import { useBackendStatus } from '../../../app/hooks/useBackendStatus';

export const HomePage = () => {
  const navigate = useNavigate();
  const status = useBackendStatus();

  const viewModel = useMemo(() => {
    const volume = status.marketStats?.['24h_volume'] ?? 0;
    const activeOrders = status.marketStats
      ? (status.marketStats.total_bid_orders + status.marketStats.total_ask_orders)
      : 0;
    const users = status.systemStatus?.active_connections ?? 0;

    return {
      connected: status.connected,
      totalVolume: `$${volume.toLocaleString()}`,
      activeOrders,
      users,
      loading: status.loading,
    };
  }, [status]);

  return (
    <HomeView
      backendStatus={viewModel}
      onLaunchTrade={() => navigate('/trade')}
    />
  );
};

export default HomePage;
