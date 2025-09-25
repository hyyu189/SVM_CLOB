import React, { useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { OrderBook } from './OrderBook';
import { TradingInterface } from './TradingInterface';
import { BalanceManager } from './BalanceManager';
import { BarChart3, TrendingUp, Clock, History } from 'lucide-react';

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
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Trading Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-6 w-6 text-blue-500" />
                <h1 className="text-xl font-bold">SOL/USDC</h1>
              </div>
              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-1">
                  <span className="text-gray-400">Last Price:</span>
                  <span className="font-mono text-white text-lg">$100.25</span>
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <span className="text-green-500">+2.15%</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-gray-400">24h High:</span>
                  <span className="font-mono text-gray-300">$102.50</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-gray-400">24h Low:</span>
                  <span className="font-mono text-gray-300">$98.80</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-gray-400" />
              <span className="text-gray-400">
                Last updated: {new Date().toLocaleTimeString()}
              </span>
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
            <div className="bg-gray-800 rounded-lg p-6 h-[600px]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Price Chart</h3>
                <div className="flex items-center gap-2 text-sm">
                  <button className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded transition-colors">
                    1m
                  </button>
                  <button className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded transition-colors">
                    5m
                  </button>
                  <button className="bg-blue-600 px-3 py-1 rounded">
                    15m
                  </button>
                  <button className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded transition-colors">
                    1h
                  </button>
                  <button className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded transition-colors">
                    4h
                  </button>
                  <button className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded transition-colors">
                    1d
                  </button>
                </div>
              </div>
              
              {/* Chart placeholder */}
              <div className="h-full flex items-center justify-center border-2 border-dashed border-gray-600 rounded-lg">
                <div className="text-center">
                  <BarChart3 className="h-16 w-16 text-gray-500 mx-auto mb-4" />
                  <p className="text-gray-400 text-lg">TradingView Chart</p>
                  <p className="text-gray-500 text-sm">
                    Integrate TradingView widget or custom chart component
                  </p>
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
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4">Open Orders</h3>
            <div className="text-center py-8">
              <p className="text-gray-400">No open orders</p>
              <p className="text-gray-500 text-sm mt-2">
                Place an order to see it here
              </p>
            </div>
          </div>

          {/* Order History */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4">Order History</h3>
            <div className="text-center py-8">
              <p className="text-gray-400">No order history</p>
              <p className="text-gray-500 text-sm mt-2">
                Your completed orders will appear here
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};