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
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Hero Section */}
      <div className="text-center mb-16">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6" style={{
          background: 'var(--bg-glass)',
          border: '1px solid var(--border-accent)',
          backdropFilter: 'blur(12px)'
        }}>
          <div className="w-2 h-2 rounded-full" style={{ background: 'var(--color-buy)' }}></div>
          <span className="text-sm font-medium">Next-Gen DeFi Trading</span>
        </div>

        <h2 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-400 via-purple-400 to-blue-400 bg-clip-text text-transparent leading-tight text-center">
          Solana Central
          <br />
          Limit Order Book
        </h2>

        <p className="text-xl mb-12 max-w-2xl mx-auto text-center" style={{ color: '#cbd5e1' }}>
          Professional trading infrastructure with advanced order matching,
          real-time execution, and institutional-grade performance on Solana.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {[
            {
              icon: BarChart3,
              title: 'Advanced Order Book',
              description: 'Professional limit & market orders with deep liquidity and tight spreads',
              color: 'var(--color-primary)'
            },
            {
              icon: TrendingUp,
              title: 'Instant Settlement',
              description: 'Sub-second order matching with on-chain settlement and MEV protection',
              color: 'var(--color-buy)'
            },
            {
              icon: Coins,
              title: 'Multi-Asset Support',
              description: 'Trade any SPL token with cross-collateral margin and portfolio management',
              color: 'var(--color-warning)'
            }
          ].map(({ icon: Icon, title, description, color }, index) => (
            <div
              key={title}
              className="card-glass p-8 hover:scale-105 transition-all duration-300 group cursor-pointer"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="relative mb-6">
                <Icon className="h-12 w-12 mx-auto transition-colors duration-300" style={{ color }} />
                <div
                  className="absolute inset-0 rounded-full blur-lg opacity-20 group-hover:opacity-40 transition-opacity"
                  style={{ background: color }}
                ></div>
              </div>
              <h3 className="text-xl font-semibold mb-3 text-center">{title}</h3>
              <p className="text-sm leading-relaxed text-center" style={{ color: '#94a3b8' }}>
                {description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Getting Started Section */}
      <div className="card-glass p-8 mb-12">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'var(--color-primary)' }}>
            <span className="text-white font-bold">1</span>
          </div>
          <h3 className="text-2xl font-semibold">Get Started in Minutes</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { step: '1', title: 'Connect Wallet', status: 'ready', icon: '🔗' },
            { step: '2', title: 'Initialize Account', status: 'available', icon: '⚡' },
            { step: '3', title: 'Deposit Assets', status: 'available', icon: '💰' },
            { step: '4', title: 'Start Trading', status: 'available', icon: '📈' }
          ].map(({ step, title, status, icon }) => (
            <div
              key={step}
              className="flex items-center gap-4 p-4 rounded-lg transition-all hover:scale-105"
              style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)' }}
            >
              <span className="text-2xl">{icon}</span>
              <div>
                <div className="font-medium">{title}</div>
                <div className="text-sm flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${
                    status === 'ready' ? 'bg-green-400' : 'bg-blue-400'
                  }`}></div>
                  <span style={{
                    color: status === 'ready' ? 'var(--color-buy)' : 'var(--color-primary)'
                  }}>
                    {status === 'ready' ? 'Ready' : 'Available'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center">
          <button
            onClick={() => setActiveView('trade')}
            className="px-8 py-4 rounded-lg font-semibold text-white transition-all hover:scale-105 hover:shadow-lg"
            style={{
              background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))',
              boxShadow: 'var(--shadow-md)'
            }}
          >
            Launch Trading Dashboard
          </button>
        </div>
      </div>

      {/* System Status */}
      <div className="card-glass p-6 mb-12">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{
              background: backendStatus.connected ? 'var(--color-buy)' : 'var(--color-sell)'
            }}></div>
            System Status
          </h3>
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
            backendStatus.connected
              ? 'text-green-400'
              : 'text-red-400'
          }`} style={{
            background: backendStatus.connected ? 'var(--color-buy-bg)' : 'var(--color-sell-bg)',
            border: `1px solid ${backendStatus.connected ? 'var(--color-buy)' : 'var(--color-sell)'}`
          }}>
            {backendStatus.connected ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
            <span>{backendStatus.connected ? 'Infrastructure Online' : 'Running in Mock Mode'}</span>
          </div>
        </div>

        {!backendStatus.connected && (
          <div className="p-4 rounded-lg mb-4" style={{
            background: 'var(--color-warning)' + '20',
            border: '1px solid var(--color-warning)'
          }}>
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--color-warning)' }} />
              <div>
                <div className="font-medium mb-2" style={{ color: 'var(--color-warning)' }}>
                  Demo Mode Active
                </div>
                <div className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  Running with simulated data for demonstration. To connect to live infrastructure,
                  run <code className="px-2 py-1 rounded text-xs font-mono" style={{ background: 'var(--bg-tertiary)' }}>cargo run --bin svm-clob-cli start</code>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Market Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {[
          {
            label: '24h Volume',
            value: backendStatus.loading ? '...' : backendStatus.totalVolume,
            color: 'var(--color-primary)',
            icon: '📊'
          },
          {
            label: 'Active Orders',
            value: backendStatus.loading ? '...' : backendStatus.activeOrders,
            color: 'var(--color-buy)',
            icon: '⚡'
          },
          {
            label: 'Trading Pairs',
            value: backendStatus.connected ? '1' : '0',
            color: 'var(--color-warning)',
            icon: '💎'
          },
          {
            label: 'Active Traders',
            value: backendStatus.loading ? '...' : backendStatus.users,
            color: 'var(--color-secondary)',
            icon: '👥'
          }
        ].map(({ label, value, color, icon }, index) => (
          <div
            key={label}
            className="card text-center p-6 hover:scale-105 transition-all duration-300"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="text-2xl mb-3">{icon}</div>
            <div className="text-3xl font-bold mb-2" style={{
              color: backendStatus.connected ? color : 'var(--text-disabled)'
            }}>
              {value}
            </div>
            <div className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <footer className="mt-20 pt-12" style={{ borderTop: '1px solid var(--border-primary)' }}>
        <div className="text-center">
          <div className="inline-flex items-center gap-2 mb-4">
            <TrendingUp className="h-6 w-6 text-blue-400" />
            <span className="text-lg font-semibold">SVM CLOB</span>
          </div>
          <p className="mb-4" style={{ color: 'var(--text-secondary)' }}>
            Next-generation decentralized trading infrastructure
          </p>
          <div className="flex items-center justify-center gap-6 text-sm" style={{ color: 'var(--text-tertiary)' }}>
            <span>Built with Anchor</span>
            <span>•</span>
            <span>Powered by Solana</span>
            <span>•</span>
            <span>Open Source</span>
          </div>
        </div>
      </footer>
    </main>
  );

  return (
    <WalletContextProvider>
      <AnchorProviderWrapper>
        <div className="min-h-screen text-white" style={{ background: 'var(--bg-primary)' }}>
          {/* Modern Header */}
          <header className="glass sticky top-0 z-50 border-b" style={{ borderColor: 'var(--border-primary)' }}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center h-16">
                <div className="flex items-center space-x-6">
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <TrendingUp className="h-8 w-8 text-blue-400" />
                      <div className="absolute inset-0 bg-blue-400/20 rounded-full blur animate-pulse-slow"></div>
                    </div>
                    <div>
                      <h1 className="text-xl font-bold tracking-tight">SVM CLOB</h1>
                      <div className="text-xs opacity-60">Central Limit Order Book</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-3 py-1 rounded-full" style={{
                      background: 'var(--color-secondary)',
                      color: 'white'
                    }}>
                      DEVNET
                    </span>
                    {backendStatus.connected && (
                      <span className="text-xs px-2 py-1 rounded-full flex items-center gap-1" style={{
                        background: 'var(--color-buy-bg)',
                        color: 'var(--color-buy)'
                      }}>
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--color-buy)' }}></div>
                        Live
                      </span>
                    )}
                  </div>
                </div>

                <nav className="hidden md:flex items-center space-x-1">
                  {[
                    { id: 'home', icon: Home, label: 'Home' },
                    { id: 'trade', icon: Activity, label: 'Trade' },
                    { id: 'dashboard', icon: User, label: 'Portfolio' }
                  ].map(({ id, icon: Icon, label }) => (
                    <button
                      key={id}
                      onClick={() => setActiveView(id as any)}
                      className={clsx(
                        'flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200',
                        activeView === id
                          ? 'text-white'
                          : 'text-gray-400 hover:text-white hover:bg-white/5'
                      )}
                      style={activeView === id ? {
                        background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))',
                        boxShadow: 'var(--shadow-md)'
                      } : {}}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="font-medium">{label}</span>
                    </button>
                  ))}
                </nav>

                <WalletConnection />
              </div>
            </div>
          </header>

          {/* Main Content with fade transition */}
          <div className="animate-fade-in">
            {activeView === 'home' && <HomeView />}
            {activeView === 'trade' && <TradingDashboard />}
            {activeView === 'dashboard' && <UserDashboard />}
          </div>
        </div>

        {/* Modern Toast Notifications */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-primary)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-xl)',
              backdropFilter: 'blur(12px)',
            },
            success: {
              style: {
                background: 'var(--color-buy-bg)',
                border: '1px solid var(--color-buy)',
                color: 'var(--color-buy)',
              },
            },
            error: {
              style: {
                background: 'var(--color-sell-bg)',
                border: '1px solid var(--color-sell)',
                color: 'var(--color-sell)',
              },
            },
          }}
        />
      </AnchorProviderWrapper>
    </WalletContextProvider>
  );
}

export default App;
