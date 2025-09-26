import React, { useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { OrderBook } from './OrderBook';
import { TradingInterface } from './TradingInterface';
import { BalanceManager } from './BalanceManager';
import { BarChart3, TrendingUp, Clock, History, AlertTriangle, WifiOff, Activity, ExternalLink } from 'lucide-react';

// Mock mint addresses - replace with actual token mints
const SOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

interface TradeHistory {
  id: string;
  price: number;
  quantity: number;
  side: 'buy' | 'sell';
  timestamp: number;
}

export const TradingDashboard: React.FC = () => {
  const [selectedPrice, setSelectedPrice] = useState<number | undefined>();
  const [activeTab, setActiveTab] = useState<'orderbook' | 'history'>('orderbook');

  // Mock trade history data
  const [tradeHistory] = useState<TradeHistory[]>([
    { id: '1', price: 100.25, quantity: 2.5, side: 'buy', timestamp: Date.now() - 1000 * 60 * 5 },
    { id: '2', price: 100.20, quantity: 1.8, side: 'sell', timestamp: Date.now() - 1000 * 60 * 10 },
    { id: '3', price: 100.30, quantity: 0.5, side: 'buy', timestamp: Date.now() - 1000 * 60 * 15 },
    { id: '4', price: 100.15, quantity: 3.2, side: 'sell', timestamp: Date.now() - 1000 * 60 * 20 },
    { id: '5', price: 100.35, quantity: 1.0, side: 'buy', timestamp: Date.now() - 1000 * 60 * 25 },
  ]);

  const handlePriceClick = (price: number) => {
    setSelectedPrice(price);
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const TradeHistoryComponent = () => (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <History className="h-5 w-5 text-blue-500" />
        <h3 className="text-lg font-semibold">Recent Trades</h3>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between py-2 px-2 text-xs text-gray-400 border-b border-gray-700 mb-2">
        <span>Time</span>
        <span>Price</span>
        <span>Size</span>
        <span>Side</span>
      </div>

      {/* Trade entries */}
      <div className="space-y-1 max-h-96 overflow-y-auto">
        {tradeHistory.map((trade) => (
          <div
            key={trade.id}
            className="flex items-center justify-between py-1 px-2 text-xs hover:bg-gray-700/50 transition-colors"
          >
            <span className="text-gray-400 font-mono">
              {formatTime(trade.timestamp)}
            </span>
            <span className="font-mono text-white">
              ${trade.price.toFixed(2)}
            </span>
            <span className="font-mono text-gray-300">
              {trade.quantity.toFixed(4)}
            </span>
            <span className={`font-medium ${trade.side === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
              {trade.side.toUpperCase()}
            </span>
          </div>
        ))}
      </div>

      {/* Trade summary */}
      <div className="mt-4 pt-4 border-t border-gray-700">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-gray-400">24h Volume</div>
            <div className="font-mono text-white">125.8 SOL</div>
          </div>
          <div>
            <div className="text-gray-400">Total Trades</div>
            <div className="font-mono text-white">1,247</div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen text-white" style={{ background: 'var(--bg-primary)' }}>
      {/* Trading Header */}
      <div className="glass border-b p-6" style={{ borderColor: 'var(--border-primary)' }}>
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'var(--color-primary)' }}>
                  <BarChart3 className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">SOL/USDC</h1>
                  <div className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Spot Trading</div>
                </div>
              </div>
              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>Last Price:</span>
                  <span className="font-mono text-white text-lg font-bold">$100.25</span>
                  <div className="flex items-center gap-1" style={{ color: 'var(--color-buy)' }}>
                    <TrendingUp className="h-4 w-4" />
                    <span className="font-medium">+2.15%</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div style={{ color: 'var(--text-tertiary)' }}>24h High</div>
                    <div className="font-mono font-medium">$102.50</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-tertiary)' }}>24h Low</div>
                    <div className="font-mono font-medium">$98.80</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--color-buy)' }}></div>
              <span style={{ color: 'var(--text-secondary)' }}>Live Market Data</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Trading Layout */}
      <div className="max-w-7xl mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Column - Order Book / Trade History */}
          <div className="lg:col-span-1">
            {/* Tab Toggle */}
            <div className="flex mb-4 bg-gray-700 rounded-lg p-1">
              <button
                onClick={() => setActiveTab('orderbook')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'orderbook'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                Order Book
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'history'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                Trades
              </button>
            </div>

            {activeTab === 'orderbook' ? (
              <OrderBook
                baseMint={SOL_MINT}
                quoteMint={USDC_MINT}
                onPriceClick={handlePriceClick}
              />
            ) : (
              <TradeHistoryComponent />
            )}
          </div>

          {/* Middle Column - Price Chart Placeholder */}
          <div className="lg:col-span-2">
            <div className="card-glass p-6 h-[600px]" style={{ border: '1px solid var(--border-primary)' }}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'var(--color-warning)' }}>
                    <BarChart3 className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold">Price Chart</h3>
                    <div className="text-sm" style={{ color: 'var(--text-tertiary)' }}>SOL/USDC • 15m</div>
                  </div>
                </div>
                <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                  {['1m', '5m', '15m', '1h', '4h', '1d'].map((timeframe) => {
                    const isActive = timeframe === '15m';
                    return (
                      <button
                        key={timeframe}
                        className={isActive ? 'px-3 py-1.5 rounded-md text-sm font-medium transition-all text-white shadow-sm' : 'px-3 py-1.5 rounded-md text-sm font-medium transition-all text-gray-400 hover:text-white hover:bg-white/5'}
                        style={isActive ? { background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' } : {}}
                      >
                        {timeframe}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Chart placeholder */}
              <div className="h-full flex items-center justify-center border-2 border-dashed rounded-xl" style={{ borderColor: 'var(--border-primary)' }}>
                <div className="text-center">
                  <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center" style={{ background: 'var(--bg-tertiary)' }}>
                    <BarChart3 className="h-10 w-10" style={{ color: 'var(--text-tertiary)' }} />
                  </div>
                  <p className="text-xl font-semibold mb-2">Advanced Price Chart</p>
                  <p className="text-sm mb-4" style={{ color: 'var(--text-tertiary)' }}>
                    Professional trading chart with technical indicators
                  </p>
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg" style={{ background: 'var(--color-primary)', color: 'white' }}>
                    <ExternalLink className="h-4 w-4" />
                    <span className="text-sm font-medium">Integrate TradingView</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Trading Interface & Balance Manager */}
          <div className="lg:col-span-1 space-y-6">
            <TradingInterface
              baseMint={SOL_MINT}
              quoteMint={USDC_MINT}
              selectedPrice={selectedPrice}
            />

            <BalanceManager
              baseMint={SOL_MINT}
              quoteMint={USDC_MINT}
            />
          </div>
        </div>

        {/* Bottom Section - Open Orders & Trade History */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Open Orders */}
          <div className="card-glass p-6" style={{ border: '1px solid var(--border-primary)' }}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'var(--color-buy)' }}>
                <Activity className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-semibold">Open Orders</h3>
                <div className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Active positions</div>
              </div>
            </div>
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: 'var(--bg-tertiary)' }}>
                <Activity className="h-8 w-8" style={{ color: 'var(--text-tertiary)' }} />
              </div>
              <p className="text-lg font-medium mb-2">No Open Orders</p>
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Place an order to see it here</p>
            </div>
          </div>

          {/* Order History */}
          <div className="card-glass p-6" style={{ border: '1px solid var(--border-primary)' }}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'var(--color-secondary)' }}>
                <History className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-semibold">Order History</h3>
                <div className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Completed trades</div>
              </div>
            </div>
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: 'var(--bg-tertiary)' }}>
                <History className="h-8 w-8" style={{ color: 'var(--text-tertiary)' }} />
              </div>
              <p className="text-lg font-medium mb-2">No Order History</p>
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Your completed orders will appear here</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};