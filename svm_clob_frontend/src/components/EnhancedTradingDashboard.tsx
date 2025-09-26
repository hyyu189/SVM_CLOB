import React, { useState, useEffect } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { OrderBook } from './OrderBook';
import { TradingInterface } from './TradingInterface';
import { BalanceManager } from './BalanceManager';
import { MarketDataWidget } from './MarketDataWidget';
import { PriceChart } from './PriceChart';
import {
  BarChart3,
  TrendingUp,
  Clock,
  History,
  Activity,
  RefreshCw,
  Settings,
  Eye,
  EyeOff,
  Wifi,
  WifiOff
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getAppApiService } from '../services/service-factory';
import { getResilientWebSocketService } from '../services/resilient-websocket-service';
import type { TradeData, OffChainOrderResponse } from '../services/api-types';
import { CLOB_CONFIG } from '../config/solana';
import type { OrderSide } from '../services/api-types';

// Use actual token mints from configuration
const SOL_MINT = CLOB_CONFIG.TOKENS.SOL;
const USDC_MINT = CLOB_CONFIG.TOKENS.USDC;

interface RecentTrade extends TradeData {
  side: 'buy' | 'sell';
}

export const EnhancedTradingDashboard: React.FC = () => {
  const { publicKey } = useWallet();
  const [selectedPrice, setSelectedPrice] = useState<number | undefined>();
  const [activeTab, setActiveTab] = useState<'orderbook' | 'history'>('orderbook');
  const [recentTrades, setRecentTrades] = useState<RecentTrade[]>([]);
  const [userOrders, setUserOrders] = useState<OffChainOrderResponse[]>([]);
  const [orderHistory, setOrderHistory] = useState<OffChainOrderResponse[]>([]);
  const [showAdvancedView, setShowAdvancedView] = useState(false);
  const [loading, setLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const [backendOnline, setBackendOnline] = useState(true);

  const apiService = getAppApiService();
  const wsService = getResilientWebSocketService();

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        // Load recent trades
        const tradesResponse = await apiService.getRecentTradesWithPagination(20);
        if (tradesResponse.success && tradesResponse.data) {
          const formattedTrades: RecentTrade[] = tradesResponse.data.map((trade: TradeData) => ({
            ...trade,
            side: trade.maker_side === 'Ask' ? 'sell' : 'buy' // Taker gets opposite of maker side
          }));
          setRecentTrades(formattedTrades);
          setBackendOnline(true);
        } else {
          console.warn('Failed to load recent trades:', tradesResponse.error);

          // Check if this is a backend availability issue
          if (tradesResponse.error?.code === 'BACKEND_OFFLINE' || tradesResponse.error?.code === 'NETWORK_ERROR') {
            setBackendOnline(false);
            console.log('Backend is offline, using fallback data');
          } else if (tradesResponse.error?.code !== 'NETWORK_ERROR') {
            toast.error(`Failed to load recent trades: ${tradesResponse.error?.message || 'Unknown error'}`);
          }
        }

        // Load user orders if connected
        if (publicKey) {
          const [openOrdersResponse, allOrdersResponse] = await Promise.all([
            apiService.getUserOrders(publicKey.toString(), { status: 'Open' }),
            apiService.getUserOrders(publicKey.toString(), { limit: 20 })
          ]);

          if (openOrdersResponse.success && openOrdersResponse.data) {
            setUserOrders(openOrdersResponse.data);
          } else {
            console.warn('Failed to load user orders:', openOrdersResponse.error);
            if (openOrdersResponse.error?.code !== 'NETWORK_ERROR') {
              toast.error(`Failed to load orders: ${openOrdersResponse.error?.message || 'Unknown error'}`);
            }
          }

          if (allOrdersResponse.success && allOrdersResponse.data) {
            const completedOrders = allOrdersResponse.data.filter(
              order => order.status === 'Filled' || order.status === 'Cancelled'
            );
            setOrderHistory(completedOrders);
          }
        }
      } catch (error) {
        console.error('Error loading trading dashboard data:', error);
        // Only show generic error toast if it's not a network connectivity issue
        if (error instanceof Error && !error.message.includes('fetch')) {
          toast.error('An unexpected error occurred while loading dashboard data.');
        }
      } finally {
        setLoading(false);
      }
    };

    loadData();

    // Set up real-time updates
    wsService.connect()
      .then(() => {
        setWsConnected(true);

        // Subscribe to trade updates
        const tradeSubId = wsService.subscribe(
          { type: 'Trades', market: 'SOL/USDC' },
          (message: any) => {
            if (message.type === 'MarketData' && message.data.update_type === 'TradeExecution') {
              const trade = message.data.trade;
              const newTrade: RecentTrade = {
                ...trade,
                side: trade.maker_side === 'Bid' ? 'sell' : 'buy'
              };

              setRecentTrades(prev => [newTrade, ...prev.slice(0, 19)]); // Keep latest 20
            } else if (message.type === 'ConnectionStatus') {
              setWsConnected(message.data.status === 'connected');
            }
          }
        );

        // Subscribe to user order updates if connected
        if (publicKey) {
          const userOrderSubId = wsService.subscribe(
            { type: 'UserOrders', user: publicKey.toString() },
            (message: any) => {
              if (message.type === 'OrderUpdate') {
                const updatedOrder = message.data.order;

                // Update user orders
                setUserOrders(prev => {
                  const filtered = prev.filter(order => order.order_id !== updatedOrder.order_id);
                  if (updatedOrder.status === 'Open' || updatedOrder.status === 'PartiallyFilled') {
                    return [updatedOrder, ...filtered];
                  }
                  return filtered;
                });

                // Add to order history if completed
                if (updatedOrder.status === 'Filled' || updatedOrder.status === 'Cancelled') {
                  setOrderHistory(prev => [updatedOrder, ...prev.slice(0, 19)]);
                }
              }
            }
          );
        }
      })
      .catch((error) => {
        console.warn('WebSocket connection failed:', error);
        setWsConnected(false);
      });

    return () => {
      wsService.disconnect();
    };
  }, [publicKey, apiService, wsService]);

  const handlePriceClick = (price: number) => {
    setSelectedPrice(price);
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatPrice = (price: number) => `$${price.toFixed(2)}`;
  const formatQuantity = (quantity: number) => quantity.toFixed(4);

  const TradeHistoryComponent = () => (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-blue-500" />
          <h3 className="text-lg font-semibold">Recent Trades</h3>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="p-1 text-gray-400 hover:text-white transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
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
        {recentTrades.map((trade, index) => (
          <div
            key={`${trade.maker_order_id}-${trade.taker_order_id}-${index}`}
            className="flex items-center justify-between py-1 px-2 text-xs hover:bg-gray-700/50 transition-colors"
          >
            <span className="text-gray-400 font-mono">
              {formatTime(trade.timestamp)}
            </span>
            <span className={`font-mono ${
              trade.side === 'buy' ? 'text-green-400' : 'text-red-400'
            }`}>
              {formatPrice(trade.price)}
            </span>
            <span className="font-mono text-gray-300">
              {formatQuantity(trade.quantity)}
            </span>
            <span className={`font-medium text-xs px-2 py-1 rounded ${
              trade.side === 'buy' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
            }`}>
              {trade.side.toUpperCase()}
            </span>
          </div>
        ))}

        {recentTrades.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No recent trades</p>
          </div>
        )}
      </div>

      {/* Trade summary */}
      <div className="mt-4 pt-4 border-t border-gray-700">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-gray-400">Total Trades</div>
            <div className="font-mono text-white">{recentTrades.length}</div>
          </div>
          <div>
            <div className="text-gray-400">Avg Size</div>
            <div className="font-mono text-white">
              {recentTrades.length > 0
                ? (recentTrades.reduce((sum, t) => sum + t.quantity, 0) / recentTrades.length).toFixed(4)
                : '0.0000'
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const OpenOrdersComponent = () => (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Activity className="h-5 w-5 text-green-500" />
        Open Orders
        {userOrders.length > 0 && (
          <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full">
            {userOrders.length}
          </span>
        )}
      </h3>

      {userOrders.length > 0 ? (
        <div className="space-y-2">
          {/* Header */}
          <div className="flex items-center justify-between py-2 px-2 text-xs text-gray-400 border-b border-gray-700">
            <span>Side</span>
            <span>Price</span>
            <span>Size</span>
            <span>Status</span>
            <span>Action</span>
          </div>

          {/* Orders */}
          {userOrders.map(order => (
            <div
              key={order.order_id}
              className="flex items-center justify-between py-2 px-2 text-sm hover:bg-gray-700/30 rounded"
            >
              <span className={`px-2 py-1 rounded text-xs ${
                order.side === 'Bid' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
              }`}>
                {order.side}
              </span>
              <span className="font-mono text-gray-300">{formatPrice(order.price)}</span>
              <span className="font-mono text-gray-300">
                {formatQuantity(order.remaining_quantity)}
              </span>
              <span className={`text-xs px-2 py-1 rounded ${
                order.status === 'Open' ? 'bg-blue-500/20 text-blue-400' :
                order.status === 'PartiallyFilled' ? 'bg-yellow-500/20 text-yellow-400' :
                'bg-gray-500/20 text-gray-400'
              }`}>
                {order.status}
              </span>
              <button
                onClick={async () => {
                  try {
                    const response = await apiService.cancelOrder(order.order_id);
                    if (response.success) {
                      toast.success(`Order #${order.order_id} cancelled.`);
                    } else {
                      toast.error(response.error?.message || 'Failed to cancel order.');
                    }
                  } catch (error) {
                    toast.error('An error occurred while cancelling the order.');
                    console.error('Error cancelling order:', error);
                  }
                }}
                className="text-red-400 hover:text-red-300 text-xs px-2 py-1 hover:bg-red-500/20 rounded transition-colors"
              >
                Cancel
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-gray-400">No open orders</p>
          <p className="text-gray-500 text-sm mt-2">
            Place an order to see it here
          </p>
        </div>
      )}
    </div>
  );

  const OrderHistoryComponent = () => (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-4">Order History</h3>

      {orderHistory.length > 0 ? (
        <div className="space-y-2">
          {/* Header */}
          <div className="flex items-center justify-between py-2 px-2 text-xs text-gray-400 border-b border-gray-700">
            <span>Time</span>
            <span>Side</span>
            <span>Price</span>
            <span>Size</span>
            <span>Status</span>
          </div>

          {/* Orders */}
          {orderHistory.map(order => (
            <div
              key={order.order_id}
              className="flex items-center justify-between py-2 px-2 text-sm hover:bg-gray-700/30 rounded"
            >
              <span className="text-gray-400 font-mono text-xs">
                {formatTime(order.timestamp)}
              </span>
              <span className={`px-2 py-1 rounded text-xs ${
                order.side === 'Bid' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
              }`}>
                {order.side}
              </span>
              <span className="font-mono text-gray-300">{formatPrice(order.price)}</span>
              <span className="font-mono text-gray-300">
                {formatQuantity(order.quantity)}
              </span>
              <span className={`text-xs px-2 py-1 rounded ${
                order.status === 'Filled' ? 'bg-green-500/20 text-green-400' :
                order.status === 'Cancelled' ? 'bg-red-500/20 text-red-400' :
                'bg-gray-500/20 text-gray-400'
              }`}>
                {order.status}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-gray-400">No order history</p>
          <p className="text-gray-500 text-sm mt-2">
            Your completed orders will appear here
          </p>
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading trading dashboard...</p>
        </div>
      </div>
    );
  }

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
              <div className="flex items-center gap-2">
                <div className={`flex items-center gap-2 text-sm px-3 py-1 rounded-full ${
                    wsConnected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                    {wsConnected ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
                    <span>{wsConnected ? 'Live' : 'Disconnected'}</span>
                  </div>
                  <div className={`flex items-center gap-2 text-sm px-3 py-1 rounded-full ${
                    backendOnline ? 'bg-blue-500/20 text-blue-400' : 'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${backendOnline ? 'bg-blue-400' : 'bg-yellow-400'}`} />
                    <span>{backendOnline ? 'API' : 'Mock'}</span>
                  </div>
                </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowAdvancedView(!showAdvancedView)}
                className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors text-sm"
              >
                {showAdvancedView ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {showAdvancedView ? 'Simple' : 'Advanced'}
              </button>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-gray-400" />
                <span className="text-gray-400">
                  Last updated: {new Date().toLocaleTimeString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Trading Layout */}
      <div className="max-w-7xl mx-auto p-4">
        {showAdvancedView ? (
          /* Advanced 4-column layout */
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 mb-8">
            {/* Column 1: Market Data */}
            <div className="space-y-6">
              <MarketDataWidget symbol="SOL/USDC" />
            </div>

            {/* Column 2: Order Book / Trade History */}
            <div>
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

            {/* Column 3: Price Chart */}
            <div>
              <PriceChart symbol="SOL/USDC" height={600} />
            </div>

            {/* Column 4: Trading Interface & Balance */}
            <div className="space-y-6">
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
        ) : (
          /* Simplified 3-column layout */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Left: Order Book / Trades */}
            <div>
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

            {/* Middle: Price Chart */}
            <div>
              <PriceChart symbol="SOL/USDC" height={600} />
            </div>

            {/* Right: Trading & Balance */}
            <div className="space-y-6">
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
        )}

        {/* Bottom Section - Orders */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <OpenOrdersComponent />
          <OrderHistoryComponent />
        </div>
      </div>
    </div>
  );
};