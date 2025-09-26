import React, { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { WalletContextProvider } from './contexts/WalletContext';
import { AnchorProviderWrapper } from './contexts/AnchorProvider';
import { WalletConnection } from './components/WalletConnection';
import { TradingDashboard } from './components/TradingDashboard';
import { EnhancedTradingDashboard } from './components/EnhancedTradingDashboard';
import { UserDashboard } from './components/UserDashboard';
import { TrendingUp, BarChart3, Coins, Home, Activity, User, AlertTriangle, Wifi, WifiOff } from 'lucide-react';
import clsx from 'clsx';
import { getAppApiService } from './services/service-factory';
import { getEnvironmentConfig } from './config/solana';

function App() {
  const [activeView, setActiveView] = useState<'home' | 'trade' | 'dashboard'>('home');
  const [backendStatus, setBackendStatus] = useState<{
    connected: boolean;
    totalVolume: string;
    activeOrders: number;
    users: number;
    loading: boolean;
  }>({
    connected: false,
    totalVolume: '---',
    activeOrders: 0,
    users: 0,
    loading: true
  });

  // Check backend connection status
  useEffect(() => {
    const checkBackendStatus = async () => {
      const apiService = getAppApiService();
      const config = getEnvironmentConfig();

      try {
        // Try to get system health first (fastest endpoint)
        const healthResponse = await apiService.getHealth();

        if (healthResponse.success) {
          // If health check passes, try to get more detailed system status
          const [statusResponse, marketResponse] = await Promise.allSettled([
            apiService.getSystemStatus(),
            apiService.getMarketStats()
          ]);

          let systemData = null;
          let marketData = null;

          if (statusResponse.status === 'fulfilled' && statusResponse.value.success) {
            systemData = statusResponse.value.data;
          }

          if (marketResponse.status === 'fulfilled' && marketResponse.value.success) {
            marketData = marketResponse.value.data;
          }

          setBackendStatus({
            connected: true,
            totalVolume: marketData ? `$${(marketData['24h_volume'] || 0).toLocaleString()}` : 'Loading...',
            activeOrders: marketData ? (marketData.total_bid_orders + marketData.total_ask_orders) : 0,
            users: systemData?.active_connections || 0,
            loading: false
          });
        } else {
          throw new Error(healthResponse.error?.message || 'Health check failed');
        }
      } catch (error) {
        console.warn('Backend connection failed:', error);
        setBackendStatus({
          connected: false,
          totalVolume: 'Offline',
          activeOrders: 0,
          users: 0,
          loading: false
        });
      }
    };

    checkBackendStatus();

    // Poll backend status every 30 seconds
    const interval = setInterval(checkBackendStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const HomeView = () => (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Welcome Section */}
      <div className="text-center mb-12">
        <h2 className="text-4xl font-bold mb-4">
          Solana Central Limit Order Book
        </h2>
        <p className="text-xl text-gray-400 mb-8">
          Advanced trading interface for Solana-based tokens with on-chain order matching
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
          <div className="bg-gray-800 rounded-lg p-6">
            <BarChart3 className="h-10 w-10 text-blue-500 mx-auto mb-3" />
            <h3 className="text-lg font-semibold mb-2">Order Book Trading</h3>
            <p className="text-gray-400 text-sm">
              Professional trading with limit and market orders
            </p>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-6">
            <TrendingUp className="h-10 w-10 text-green-500 mx-auto mb-3" />
            <h3 className="text-lg font-semibold mb-2">Real-time Matching</h3>
            <p className="text-gray-400 text-sm">
              Instant order execution with on-chain settlement
            </p>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-6">
            <Coins className="h-10 w-10 text-yellow-500 mx-auto mb-3" />
            <h3 className="text-lg font-semibold mb-2">Multi-token Support</h3>
            <p className="text-gray-400 text-sm">
              Trade any SPL token pair with deep liquidity
            </p>
          </div>
        </div>
      </div>

      {/* Status Section */}
      <div className="bg-gray-800 rounded-lg p-6 mb-8">
        <h3 className="text-lg font-semibold mb-4">Getting Started</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-700 rounded">
            <span>1. Connect your Solana wallet</span>
            <span className="text-green-500 text-sm">✓ Ready</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-700 rounded">
            <span>2. Initialize your trading account</span>
            <span className="text-blue-500 text-sm">Available</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-700 rounded">
            <span>3. Deposit tokens to start trading</span>
            <span className="text-blue-500 text-sm">Available</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-700 rounded">
            <span>4. Place your first order</span>
            <span className="text-blue-500 text-sm">Available</span>
          </div>
        </div>
        
        <div className="mt-6 text-center">
          <button
            onClick={() => setActiveView('trade')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-medium transition-colors"
          >
            Start Trading
          </button>
        </div>
      </div>

      {/* Backend Status */}
      <div className="bg-gray-800 rounded-lg p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">System Status</h3>
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
            backendStatus.connected
              ? 'bg-green-500/20 text-green-400'
              : 'bg-red-500/20 text-red-400'
          }`}>
            {backendStatus.connected ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
            <span>{backendStatus.connected ? 'Backend Online' : 'Backend Offline'}</span>
          </div>
        </div>

        {!backendStatus.connected && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0" />
              <div>
                <div className="font-medium text-yellow-200">SVM CLOB Infrastructure Offline</div>
                <div className="text-sm text-yellow-300/80 mt-1">
                  The svm_clob_infra services (RPC server on port 8000 and WebSocket server on port 8001) are not running.
                  Run <code className="bg-yellow-800/20 px-1 rounded">cargo run --bin svm-clob-cli start</code> to launch the infrastructure.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 text-center">
          <div className={`text-2xl font-bold ${backendStatus.connected ? 'text-blue-500' : 'text-gray-500'}`}>
            {backendStatus.loading ? '...' : backendStatus.totalVolume}
          </div>
          <div className="text-sm text-gray-400">Total Volume</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 text-center">
          <div className={`text-2xl font-bold ${backendStatus.connected ? 'text-green-500' : 'text-gray-500'}`}>
            {backendStatus.loading ? '...' : backendStatus.activeOrders}
          </div>
          <div className="text-sm text-gray-400">Active Orders</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 text-center">
          <div className={`text-2xl font-bold ${backendStatus.connected ? 'text-yellow-500' : 'text-gray-500'}`}>
            {backendStatus.connected ? '1' : '0'}
          </div>
          <div className="text-sm text-gray-400">Trading Pairs</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 text-center">
          <div className={`text-2xl font-bold ${backendStatus.connected ? 'text-purple-500' : 'text-gray-500'}`}>
            {backendStatus.loading ? '...' : backendStatus.users}
          </div>
          <div className="text-sm text-gray-400">Users</div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-16 pt-8">
        <div className="text-center text-gray-400">
          <p>SVM CLOB - Solana Central Limit Order Book</p>
          <p className="text-sm mt-2">
            Built with Anchor, React, and TypeScript
          </p>
        </div>
      </footer>
    </main>
  );

  return (
    <WalletContextProvider>
      <AnchorProviderWrapper>
        <div className="min-h-screen bg-gray-900 text-white">
          {/* Header */}
          <header className="border-b border-gray-800 bg-gray-900/95 backdrop-blur-sm sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center h-16">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="h-8 w-8 text-blue-500" />
                    <h1 className="text-xl font-bold">SVM CLOB</h1>
                  </div>
                  <span className="text-xs bg-purple-600 px-2 py-1 rounded-full">
                    DEVNET
                  </span>
                </div>
                
                <nav className="hidden md:flex items-center space-x-8">
                  <button
                    onClick={() => setActiveView('home')}
                    className={clsx(
                      'flex items-center gap-2 transition-colors',
                      activeView === 'home' 
                        ? 'text-white' 
                        : 'text-gray-300 hover:text-white'
                    )}
                  >
                    <Home className="h-4 w-4" />
                    Home
                  </button>
                  <button
                    onClick={() => setActiveView('trade')}
                    className={clsx(
                      'flex items-center gap-2 transition-colors',
                      activeView === 'trade' 
                        ? 'text-white' 
                        : 'text-gray-300 hover:text-white'
                    )}
                  >
                    <Activity className="h-4 w-4" />
                    Trade
                  </button>
                  <button
                    onClick={() => setActiveView('dashboard')}
                    className={clsx(
                      'flex items-center gap-2 transition-colors',
                      activeView === 'dashboard' 
                        ? 'text-white' 
                        : 'text-gray-300 hover:text-white'
                    )}
                  >
                    <User className="h-4 w-4" />
                    Dashboard
                  </button>
                </nav>

                <WalletConnection />
              </div>
            </div>
          </header>

          {/* Main Content */}
          {activeView === 'home' && <HomeView />}
          {activeView === 'trade' && <EnhancedTradingDashboard />}
          {activeView === 'dashboard' && <UserDashboard />}
        </div>

        {/* Toast Notifications */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#374151',
              color: '#f3f4f6',
              border: '1px solid #4b5563',
            },
          }}
        />
      </AnchorProviderWrapper>
    </WalletContextProvider>
  );
}

export default App;
