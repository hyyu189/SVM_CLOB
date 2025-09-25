import React, { useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { WalletContextProvider } from './contexts/WalletContext';
import { AnchorProviderWrapper } from './contexts/AnchorProvider';
import { WalletConnection } from './components/WalletConnection';
import { TradingDashboard } from './components/TradingDashboard';
import { EnhancedTradingDashboard } from './components/EnhancedTradingDashboard';
import { UserDashboard } from './components/UserDashboard';
import { TrendingUp, BarChart3, Coins, Home, Activity, User } from 'lucide-react';
import clsx from 'clsx';
import './App.css';

function App() {
  const [activeView, setActiveView] = useState<'home' | 'trade' | 'dashboard'>('home');

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

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-500">$12.5K</div>
          <div className="text-sm text-gray-400">Total Volume</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-500">24</div>
          <div className="text-sm text-gray-400">Active Orders</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-yellow-500">1</div>
          <div className="text-sm text-gray-400">Trading Pairs</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-purple-500">15</div>
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
