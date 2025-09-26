import React from 'react';
import { TrendingUp, BarChart3, Coins, AlertTriangle, Wifi, WifiOff } from 'lucide-react';

interface HomeViewProps {
  setActiveView: (view: 'trade') => void;
  backendStatus: {
    connected: boolean;
    totalVolume: string;
    activeOrders: number;
    users: number;
    loading: boolean;
  };
}

export const HomeView: React.FC<HomeViewProps> = ({ setActiveView, backendStatus }) => (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Welcome Section */}
      <div className="text-center mb-16">
        <h2 className="text-5xl font-bold mb-4 tracking-tight">
          Solana Central Limit Order Book
        </h2>
        <p className="text-xl text-gray-400 max-w-3xl mx-auto">
          An advanced, on-chain trading interface for any SPL token pair, powered by a real-time matching engine.
        </p>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-8">
          {/* Getting Started */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-4">Getting Started</h3>
            <div className="space-y-3">
              {/* Steps */}
              <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-md">
                <span>1. Connect your Solana wallet</span>
                <span className="text-green-400 text-sm font-medium">✓ Ready</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-md">
                <span>2. Initialize your trading account</span>
                <span className="text-blue-400 text-sm font-medium">Available</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-md">
                <span>3. Deposit tokens to start trading</span>
                <span className="text-blue-400 text-sm font-medium">Available</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-md">
                <span>4. Place your first order</span>
                <span className="text-blue-400 text-sm font-medium">Available</span>
              </div>
            </div>
            <div className="mt-6 text-center">
              <button
                onClick={() => setActiveView('trade')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold transition-transform transform hover:scale-105"
              >
                Start Trading
              </button>
            </div>
          </div>

          {/* Key Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-800 rounded-lg p-6 text-center">
              <BarChart3 className="h-10 w-10 text-blue-500 mx-auto mb-3" />
              <h3 className="text-lg font-semibold mb-2">Order Book Trading</h3>
              <p className="text-gray-400 text-sm">
                Professional trading with limit and market orders.
              </p>
            </div>
            <div className="bg-gray-800 rounded-lg p-6 text-center">
              <TrendingUp className="h-10 w-10 text-green-500 mx-auto mb-3" />
              <h3 className="text-lg font-semibold mb-2">Real-time Matching</h3>
              <p className="text-gray-400 text-sm">
                Instant order execution with on-chain settlement.
              </p>
            </div>
            <div className="bg-gray-800 rounded-lg p-6 text-center">
              <Coins className="h-10 w-10 text-yellow-500 mx-auto mb-3" />
              <h3 className="text-lg font-semibold mb-2">Multi-token Support</h3>
              <p className="text-gray-400 text-sm">
                Trade any SPL token pair with deep liquidity.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-8">
          {/* System Status */}
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">System Status</h3>
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                backendStatus.connected
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-red-500/20 text-red-400'
              }`}>
                {backendStatus.connected ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
                <span>{backendStatus.connected ? 'Online' : 'Offline'}</span>
              </div>
            </div>
            {!backendStatus.connected && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0" />
                  <div>
                    <div className="font-semibold text-yellow-200">Backend Not Available</div>
                    <div className="text-sm text-yellow-300/80 mt-1">
                      The off-chain API is not running. Start the backend to see live data.
                    </div>
                  </div>
                </div>
              </div>
            )}
            {/* Quick Stats */}
            <div className="space-y-4">
              <div className="flex justify-between items-baseline">
                <span className="text-gray-400">Total Volume</span>
                <span className={`font-mono text-lg ${backendStatus.connected ? 'text-blue-400' : 'text-gray-500'}`}>
                  {backendStatus.loading ? '...' : backendStatus.totalVolume}
                </span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-gray-400">Active Orders</span>
                <span className={`font-mono text-lg ${backendStatus.connected ? 'text-green-400' : 'text-gray-500'}`}>
                  {backendStatus.loading ? '...' : backendStatus.activeOrders}
                </span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-gray-400">Trading Pairs</span>
                <span className={`font-mono text-lg ${backendStatus.connected ? 'text-yellow-400' : 'text-gray-500'}`}>
                  {backendStatus.connected ? '1' : '0'}
                </span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-gray-400">Users</span>
                <span className={`font-mono text-lg ${backendStatus.connected ? 'text-purple-400' : 'text-gray-500'}`}>
                  {backendStatus.loading ? '...' : backendStatus.users}
                </span>
              </div>
            </div>
          </div>
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