import React, { useState, useEffect, useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  RefreshCw, 
  BarChart3,
  Zap,
  Eye,
  EyeOff,
  Settings,
  ArrowUpDown,
  DollarSign,
  Percent
} from 'lucide-react';
import clsx from 'clsx';
import { useOrderBook, OrderBookLevel } from '../hooks/useOrderBook';

interface OrderBookProps {
  baseMint: PublicKey;
  quoteMint: PublicKey;
  onPriceClick?: (price: number) => void;
}

interface OrderBookSettings {
  maxLevels: number;
  aggregation: number;
  showSpread: boolean;
  showTotal: boolean;
  showOrderCount: boolean;
  colorIntensity: 'low' | 'medium' | 'high';
}

type ViewMode = 'full' | 'spread' | 'bids' | 'asks';

export const OrderBook: React.FC<OrderBookProps> = ({ 
  baseMint, 
  quoteMint, 
  onPriceClick 
}) => {
  const { connected } = useWallet();
  const { orderBook, loading, error, refresh } = useOrderBook(baseMint, quoteMint);
  const { bids, asks, spread, lastPrice, bestBid, bestAsk } = orderBook;

  const [viewMode, setViewMode] = useState<ViewMode>('full');
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<OrderBookSettings>({
    maxLevels: 10,
    aggregation: 0.01,
    showSpread: true,
    showTotal: true,
    showOrderCount: false,
    colorIntensity: 'medium'
  });
  const [priceHover, setPriceHover] = useState<number | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());

  // Update timestamp when order book changes
  useEffect(() => {
    setLastUpdate(Date.now());
  }, [bids, asks]);

  // Aggregate order book levels based on settings
  const aggregatedData = useMemo(() => {
    const aggregateLevel = settings.aggregation;
    
    const aggregateLevels = (levels: OrderBookLevel[], isAsk: boolean) => {
      const aggregated = new Map<number, { price: number; quantity: number; total: number; count: number }>();
      
      levels.forEach(level => {
        const aggPrice = Math.floor(level.price / aggregateLevel) * aggregateLevel;
        const existing = aggregated.get(aggPrice);
        
        if (existing) {
          existing.quantity += level.quantity;
          existing.total += level.total;
          existing.count += 1;
        } else {
          aggregated.set(aggPrice, {
            price: aggPrice,
            quantity: level.quantity,
            total: level.total,
            count: 1
          });
        }
      });
      
      return Array.from(aggregated.values())
        .sort((a, b) => isAsk ? a.price - b.price : b.price - a.price)
        .slice(0, settings.maxLevels);
    };

    return {
      bids: aggregateLevels(bids, false),
      asks: aggregateLevels(asks, true)
    };
  }, [bids, asks, settings.aggregation, settings.maxLevels]);

  const formatPrice = (price: number) => price.toFixed(2);
  const formatQuantity = (quantity: number) => quantity.toFixed(4);
  const formatTotal = (total: number) => total.toFixed(2);

  const getColorIntensity = () => {
    switch (settings.colorIntensity) {
      case 'low': return 'opacity-10';
      case 'medium': return 'opacity-20';
      case 'high': return 'opacity-30';
    }
  };

  const OrderBookRow: React.FC<{
    entry: { price: number; quantity: number; total: number; count?: number };
    type: 'bid' | 'ask';
    maxTotal: number;
    index: number;
  }> = ({ entry, type, maxTotal, index }) => {
    const percentage = maxTotal > 0 ? (entry.total / maxTotal) * 100 : 0;
    const isHovered = priceHover === entry.price;
    const colorIntensity = getColorIntensity();
    
    return (
      <div
        className={clsx(
          'relative flex items-center justify-between py-1 px-2 text-xs cursor-pointer transition-all duration-150',
          'hover:bg-gray-700/50',
          type === 'bid' ? 'text-green-400' : 'text-red-400',
          isHovered && 'bg-gray-700/30 scale-105'
        )}
        onClick={() => onPriceClick?.(entry.price)}
        onMouseEnter={() => setPriceHover(entry.price)}
        onMouseLeave={() => setPriceHover(null)}
      >
        {/* Background fill for depth visualization */}
        <div
          className={clsx(
            'absolute right-0 top-0 h-full transition-all duration-300',
            type === 'bid' ? 'bg-green-500' : 'bg-red-500',
            colorIntensity
          )}
          style={{ width: `${percentage}%` }}
        />
        
        {/* Price */}
        <div className="relative z-10 flex items-center gap-1 min-w-0 flex-1">
          <span className="font-mono font-medium">
            {formatPrice(entry.price)}
          </span>
          {isHovered && (
            <Zap className="h-3 w-3 text-blue-400" />
          )}
        </div>
        
        {/* Quantity */}
        <div className="relative z-10 font-mono text-gray-300 min-w-0 flex-1 text-center">
          {formatQuantity(entry.quantity)}
          {settings.showOrderCount && entry.count && (
            <span className="text-xs text-gray-500 ml-1">
              ({entry.count})
            </span>
          )}
        </div>
        
        {/* Total (if enabled) */}
        {settings.showTotal && (
          <div className="relative z-10 font-mono text-gray-400 text-xs min-w-0 flex-1 text-right">
            {formatTotal(entry.total)}
          </div>
        )}
      </div>
    );
  };

  const SpreadIndicator: React.FC = () => {
    const spreadPercentage = bestBid && bestAsk ? ((spread / bestBid) * 100) : 0;
    const midPrice = bestBid && bestAsk ? (bestBid + bestAsk) / 2 : lastPrice;
    const priceChange = midPrice - lastPrice;
    const priceChangePercent = lastPrice > 0 ? (priceChange / lastPrice) * 100 : 0;

    return (
      <div className="py-3 px-2 border-y border-gray-700 my-1 bg-gray-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Spread:</span>
            <span className="font-mono text-sm text-yellow-400">
              ${spread.toFixed(2)}
            </span>
            <span className="text-xs text-gray-500">
              ({spreadPercentage.toFixed(2)}%)
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Mid:</span>
            <span className="font-mono text-sm text-white">
              ${midPrice.toFixed(2)}
            </span>
            <div className={clsx(
              'flex items-center gap-1 text-xs',
              priceChange >= 0 ? 'text-green-400' : 'text-red-400'
            )}>
              {priceChange >= 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              <span>
                {priceChange >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-5 w-5 text-blue-500 animate-pulse" />
          <h3 className="text-lg font-semibold">Order Book</h3>
        </div>
        <div className="flex items-center justify-center h-96">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="text-sm text-gray-400">Loading order book...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-5 w-5 text-red-500" />
          <h3 className="text-lg font-semibold">Order Book</h3>
        </div>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="text-red-400 mb-2">Failed to load order book</div>
            <button
              onClick={refresh}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const maxBidTotal = Math.max(...aggregatedData.bids.map(b => b.total), 1);
  const maxAskTotal = Math.max(...aggregatedData.asks.map(a => a.total), 1);
  const maxTotal = Math.max(maxBidTotal, maxAskTotal);

  const shouldShowAsks = viewMode === 'full' || viewMode === 'asks';
  const shouldShowBids = viewMode === 'full' || viewMode === 'bids';
  const shouldShowSpread = viewMode === 'full' || viewMode === 'spread';

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-blue-500" />
          <h3 className="text-lg font-semibold">Order Book</h3>
          <span className="text-xs text-gray-500 bg-gray-700 px-2 py-1 rounded">
            {aggregatedData.bids.length + aggregatedData.asks.length} levels
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Last update indicator */}
          <div className="text-xs text-gray-500">
            Updated {Math.floor((Date.now() - lastUpdate) / 1000)}s ago
          </div>
          
          {/* Settings button */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-1 text-gray-400 hover:text-white transition-colors"
          >
            <Settings className="h-4 w-4" />
          </button>
          
          {/* Refresh button */}
          <button
            onClick={refresh}
            className="p-1 text-gray-400 hover:text-white transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="mb-4 p-3 bg-gray-700/50 rounded-md space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-300">Max Levels:</span>
            <select
              value={settings.maxLevels}
              onChange={(e) => setSettings(prev => ({ ...prev, maxLevels: parseInt(e.target.value) }))}
              className="bg-gray-600 text-white text-sm rounded px-2 py-1"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={20}>20</option>
            </select>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-300">Price Aggregation:</span>
            <select
              value={settings.aggregation}
              onChange={(e) => setSettings(prev => ({ ...prev, aggregation: parseFloat(e.target.value) }))}
              className="bg-gray-600 text-white text-sm rounded px-2 py-1"
            >
              <option value={0.01}>$0.01</option>
              <option value={0.1}>$0.10</option>
              <option value={1}>$1.00</option>
              <option value={5}>$5.00</option>
            </select>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={settings.showTotal}
                onChange={(e) => setSettings(prev => ({ ...prev, showTotal: e.target.checked }))}
                className="rounded"
              />
              Show Total
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={settings.showOrderCount}
                onChange={(e) => setSettings(prev => ({ ...prev, showOrderCount: e.target.checked }))}
                className="rounded"
              />
              Order Count
            </label>
          </div>
        </div>
      )}

      {/* View Mode Toggle */}
      <div className="flex mb-4 bg-gray-700 rounded-lg p-1">
        {[
          { mode: 'asks' as ViewMode, label: 'Asks', icon: TrendingDown, color: 'text-red-400' },
          { mode: 'spread' as ViewMode, label: 'Spread', icon: ArrowUpDown, color: 'text-yellow-400' },
          { mode: 'full' as ViewMode, label: 'Full', icon: BarChart3, color: 'text-blue-400' },
          { mode: 'bids' as ViewMode, label: 'Bids', icon: TrendingUp, color: 'text-green-400' }
        ].map(({ mode, label, icon: Icon, color }) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={clsx(
              'flex-1 py-2 px-2 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1',
              viewMode === mode
                ? 'bg-gray-600 text-white'
                : `${color} hover:text-white`
            )}
          >
            <Icon className="h-3 w-3" />
            {label}
          </button>
        ))}
      </div>

      {/* Column Headers */}
      <div className="flex items-center justify-between py-2 px-2 text-xs text-gray-400 border-b border-gray-700 mb-1">
        <span className="flex-1">Price (USDC)</span>
        <span className="flex-1 text-center">Size (SOL)</span>
        {settings.showTotal && <span className="flex-1 text-right">Total</span>}
      </div>

      {/* Order Book Content */}
      <div className="space-y-0 max-h-96 overflow-y-auto">
        {/* Asks (sells) - reversed to show highest prices first */}
        {shouldShowAsks && (
          <div className="space-y-0">
            {aggregatedData.asks.slice().reverse().map((ask, index) => (
              <OrderBookRow
                key={`ask-${ask.price}-${index}`}
                entry={ask}
                type="ask"
                maxTotal={maxTotal}
                index={index}
              />
            ))}
          </div>
        )}

        {/* Spread indicator */}
        {shouldShowSpread && settings.showSpread && (
          <SpreadIndicator />
        )}

        {/* Bids (buys) */}
        {shouldShowBids && (
          <div className="space-y-0">
            {aggregatedData.bids.map((bid, index) => (
              <OrderBookRow
                key={`bid-${bid.price}-${index}`}
                entry={bid}
                type="bid"
                maxTotal={maxTotal}
                index={index}
              />
            ))}
          </div>
        )}
      </div>

      {/* Market Summary */}
      <div className="mt-4 pt-4 border-t border-gray-700">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="text-center">
            <div className="text-gray-400 text-xs mb-1">Best Bid</div>
            <div className="font-mono text-green-400 font-medium">
              ${formatPrice(bestBid || 0)}
            </div>
            <div className="text-xs text-gray-500">
              {aggregatedData.bids[0]?.quantity ? `${formatQuantity(aggregatedData.bids[0].quantity)} SOL` : '—'}
            </div>
          </div>
          <div className="text-center">
            <div className="text-gray-400 text-xs mb-1">Best Ask</div>
            <div className="font-mono text-red-400 font-medium">
              ${formatPrice(bestAsk || 0)}
            </div>
            <div className="text-xs text-gray-500">
              {aggregatedData.asks[0]?.quantity ? `${formatQuantity(aggregatedData.asks[0].quantity)} SOL` : '—'}
            </div>
          </div>
        </div>
        
        {/* Additional Stats */}
        <div className="mt-3 pt-3 border-t border-gray-700/50">
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="text-center">
              <div className="text-gray-400">Total Bids</div>
              <div className="text-gray-300 font-mono">
                {aggregatedData.bids.reduce((sum, bid) => sum + bid.quantity, 0).toFixed(2)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-gray-400">Spread %</div>
              <div className="text-yellow-400 font-mono">
                {bestBid ? ((spread / bestBid) * 100).toFixed(3) : '—'}%
              </div>
            </div>
            <div className="text-center">
              <div className="text-gray-400">Total Asks</div>
              <div className="text-gray-300 font-mono">
                {aggregatedData.asks.reduce((sum, ask) => sum + ask.quantity, 0).toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Price hover tooltip */}
      {priceHover && (
        <div className="fixed bottom-4 left-4 bg-gray-900 border border-gray-600 rounded-lg p-3 shadow-lg z-50">
          <div className="text-sm">
            <div className="text-gray-400">Click to set price</div>
            <div className="font-mono text-white">
              ${formatPrice(priceHover)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};