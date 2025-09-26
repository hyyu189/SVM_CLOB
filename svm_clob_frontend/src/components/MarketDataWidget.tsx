import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Activity, Volume2, AlertTriangle } from 'lucide-react';
import { getAppApiService } from '../services/service-factory';
import { getResilientWebSocketService } from '../services/resilient-websocket-service';
import type { MarketStats } from '../services/api-types';

interface MarketDataWidgetProps {
  symbol: string;
}

export const MarketDataWidget: React.FC<MarketDataWidgetProps> = ({ symbol }) => {
  const [marketStats, setMarketStats] = useState<MarketStats | null>(null);
  const [lastPrice, setLastPrice] = useState<number>(0);
  const [priceDirection, setPriceDirection] = useState<'up' | 'down' | 'neutral'>('neutral');
  const [loading, setLoading] = useState(true);

  const apiService = getAppApiService();
  const wsService = getResilientWebSocketService();

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const response = await apiService.getMarketStats();
        if (response.success && response.data) {
          setMarketStats(response.data);
          setLastPrice(response.data.last_price);
          setLoading(false);
        }
      } catch (error) {
        console.error('Error loading market data:', error);
        setLoading(false);
      }
    };

    loadInitialData();

    // Connect WebSocket and subscribe to market updates
    wsService.connect().then(() => {
      const subscriptionId = wsService.subscribe(
        { type: 'AllMarkets' },
        (message) => {
          if (message.type === 'AllMarketsUpdate') {
            const marketData = message.data.markets[symbol];
            if (marketData) {
              const newPrice = marketData.stats.last_price;

              // Determine price direction
              if (newPrice > lastPrice) {
                setPriceDirection('up');
              } else if (newPrice < lastPrice) {
                setPriceDirection('down');
              }

              setLastPrice(newPrice);
              setMarketStats(marketData.stats);
            }
          }
        }
      );

      return () => {
        wsService.unsubscribe(subscriptionId);
      };
    });

    // Reset price direction after a brief moment
    const directionTimer = setTimeout(() => setPriceDirection('neutral'), 1000);
    return () => clearTimeout(directionTimer);
  }, [symbol, lastPrice, apiService, wsService]);

  if (loading || !marketStats) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-700 rounded mb-2"></div>
          <div className="h-6 bg-gray-700 rounded mb-2"></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="h-4 bg-gray-700 rounded"></div>
            <div className="h-4 bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  const formatNumber = (num: number, decimals = 2) => {
    return num.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  };

  const formatVolume = (volume: number) => {
    if (volume >= 1000000) {
      return `${(volume / 1000000).toFixed(1)}M`;
    }
    if (volume >= 1000) {
      return `${(volume / 1000).toFixed(1)}K`;
    }
    return volume.toFixed(1);
  };

  const isPositiveChange = marketStats['24h_change'] >= 0;

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      {/* Symbol and Last Price */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold text-white">{symbol}</h2>
          <Activity className="h-5 w-5 text-blue-500" />
        </div>
        <div className="text-right">
          <div className={`flex items-center gap-1 text-xl font-mono ${
            priceDirection === 'up' ? 'text-green-400' :
            priceDirection === 'down' ? 'text-red-400' : 'text-white'
          } transition-colors duration-300`}>
            <span>${formatNumber(marketStats.last_price, 2)}</span>
            {priceDirection === 'up' && <TrendingUp className="h-4 w-4" />}
            {priceDirection === 'down' && <TrendingDown className="h-4 w-4" />}
          </div>
        </div>
      </div>

      {/* 24h Stats */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="text-gray-400 text-sm">24h Change</div>
          <div className={`font-mono ${isPositiveChange ? 'text-green-400' : 'text-red-400'}`}>
            {isPositiveChange ? '+' : ''}{formatNumber(marketStats['24h_change'], 2)}%
          </div>
        </div>
        <div>
          <div className="text-gray-400 text-sm">24h Volume</div>
          <div className="font-mono text-white">
            {formatVolume(marketStats['24h_volume'])} {symbol.split('/')[0]}
          </div>
        </div>
      </div>

      {/* High/Low */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="text-gray-400 text-sm">24h High</div>
          <div className="font-mono text-white">
            ${formatNumber(marketStats['24h_high'], 2)}
          </div>
        </div>
        <div>
          <div className="text-gray-400 text-sm">24h Low</div>
          <div className="font-mono text-white">
            ${formatNumber(marketStats['24h_low'], 2)}
          </div>
        </div>
      </div>

      {/* Spread and Best Bid/Ask */}
      <div className="border-t border-gray-700 pt-4">
        <div className="grid grid-cols-2 gap-4 mb-2">
          <div>
            <div className="text-gray-400 text-sm">Best Bid</div>
            <div className="font-mono text-green-400">
              {marketStats.best_bid ? `$${formatNumber(marketStats.best_bid, 2)}` : '--'}
            </div>
          </div>
          <div>
            <div className="text-gray-400 text-sm">Best Ask</div>
            <div className="font-mono text-red-400">
              {marketStats.best_ask ? `$${formatNumber(marketStats.best_ask, 2)}` : '--'}
            </div>
          </div>
        </div>

        <div>
          <div className="text-gray-400 text-sm">Spread</div>
          <div className="font-mono text-gray-300">
            {marketStats.spread ?
              `$${formatNumber(marketStats.spread, 4)} (${((marketStats.spread / marketStats.last_price) * 100).toFixed(3)}%)` :
              '--'
            }
          </div>
        </div>
      </div>

      {/* Order Book Stats */}
      <div className="border-t border-gray-700 pt-4 mt-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-gray-400 text-sm">Order Book Depth</div>
          <Volume2 className="h-4 w-4 text-gray-400" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-gray-400 text-sm">Total Bids</div>
            <div className="font-mono text-green-400">
              {marketStats.total_bid_orders}
            </div>
          </div>
          <div>
            <div className="text-gray-400 text-sm">Total Asks</div>
            <div className="font-mono text-red-400">
              {marketStats.total_ask_orders}
            </div>
          </div>
        </div>
      </div>

      {/* Connection Status Indicator */}
      <div className="mt-4 pt-4 border-t border-gray-700">
        <div className="flex items-center justify-between">
          <span className="text-gray-400 text-xs">Market Data</span>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-green-400 text-xs">Live</span>
          </div>
        </div>
      </div>
    </div>
  );
};