import React from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { TrendingUp, TrendingDown, Activity, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import { useOrderBook, OrderBookLevel } from '../hooks/useOrderBook';

interface OrderBookProps {
  baseMint: PublicKey;
  quoteMint: PublicKey;
  onPriceClick?: (price: number) => void;
}

export const OrderBook: React.FC<OrderBookProps> = ({ 
  baseMint, 
  quoteMint, 
  onPriceClick 
}) => {
  const { connected } = useWallet();
  const { orderBook, loading, error, refresh } = useOrderBook(baseMint, quoteMint);
  const { bids, asks, spread, lastPrice, bestBid, bestAsk } = orderBook;

  const formatPrice = (price: number) => price.toFixed(2);
  const formatQuantity = (quantity: number) => quantity.toFixed(4);

  const OrderBookRow: React.FC<{
    entry: OrderBookLevel;
    type: 'bid' | 'ask';
    maxTotal: number;
  }> = ({ entry, type, maxTotal }) => {
    const percentage = (entry.total / maxTotal) * 100;
    
    return (
      <div
        className={clsx(
          'relative flex items-center justify-between py-1 px-2 text-xs cursor-pointer hover:bg-gray-700/50 transition-colors',
          type === 'bid' ? 'text-green-400' : 'text-red-400'
        )}
        onClick={() => onPriceClick?.(entry.price)}
      >
        {/* Background fill */}
        <div
          className={clsx(
            'absolute right-0 top-0 h-full opacity-20',
            type === 'bid' ? 'bg-green-500' : 'bg-red-500'
          )}
          style={{ width: `${percentage}%` }}
        />
        
        <span className="relative z-10 font-mono">
          {formatPrice(entry.price)}
        </span>
        <span className="relative z-10 font-mono text-gray-300">
          {formatQuantity(entry.quantity)}
        </span>
        <span className="relative z-10 font-mono text-gray-400 text-xs">
          {formatQuantity(entry.total)}
        </span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-5 w-5 text-blue-500" />
          <h3 className="text-lg font-semibold">Order Book</h3>
        </div>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  const maxBidTotal = Math.max(...bids.map(b => b.total));
  const maxAskTotal = Math.max(...asks.map(a => a.total));

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-blue-500" />
          <h3 className="text-lg font-semibold">Order Book</h3>
        </div>
        <div className="text-sm text-gray-400">
          Spread: ${spread.toFixed(2)}
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between py-2 px-2 text-xs text-gray-400 border-b border-gray-700 mb-2">
        <span>Price</span>
        <span>Size</span>
        <span>Total</span>
      </div>

      <div className="space-y-0">
        {/* Asks (sells) - reversed to show highest prices first */}
        {asks.slice().reverse().map((ask, index) => (
          <OrderBookRow
            key={`ask-${index}`}
            entry={ask}
            type="ask"
            maxTotal={maxAskTotal}
          />
        ))}

        {/* Spread indicator */}
        <div className="flex items-center justify-center py-3 border-y border-gray-700 my-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-400">Last:</span>
            <span className="font-mono text-white">${formatPrice(lastPrice)}</span>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </div>
        </div>

        {/* Bids (buys) */}
        {bids.map((bid, index) => (
          <OrderBookRow
            key={`bid-${index}`}
            entry={bid}
            type="bid"
            maxTotal={maxBidTotal}
          />
        ))}
      </div>

      {/* Market summary */}
      <div className="mt-4 pt-4 border-t border-gray-700">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-gray-400">Best Bid</div>
            <div className="font-mono text-green-400">
              ${formatPrice(bids[0]?.price || 0)}
            </div>
          </div>
          <div>
            <div className="text-gray-400">Best Ask</div>
            <div className="font-mono text-red-400">
              ${formatPrice(asks[0]?.price || 0)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};