import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { OrderBook } from './OrderBook';
import { TradingInterface } from './TradingInterface';
import { BalanceManager } from './BalanceManager';
import { MarketDataWidget } from './MarketDataWidget';
import { PriceChart } from './PriceChart';
import {
  Clock,
  History,
  Activity,
  AlertTriangle,
  RefreshCw,
  Eye,
  EyeOff,
  Wifi,
  WifiOff
} from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { useAppServices } from '../app/providers/useAppServices';
import { useSessionStore } from '../stores/sessionStore';

import type { TradeData, OffChainOrderResponse, MarketStats } from '../services/api-types';
import { CLOB_CONFIG } from '../config/solana';

// Use actual token mints from configuration
const SOL_MINT = CLOB_CONFIG.TOKENS.SOL;
const USDC_MINT = CLOB_CONFIG.TOKENS.USDC;

interface RecentTrade extends TradeData {
  side: 'buy' | 'sell';
}

export const EnhancedTradingDashboard: React.FC = () => {
  const { publicKey } = useWallet();
  const selectedMarket = useSessionStore((state) => state.selectedMarket);
  const [selectedPrice, setSelectedPrice] = useState<number | undefined>();
  const [activeTab, setActiveTab] = useState<'orderbook' | 'history'>('orderbook');
  const [recentTrades, setRecentTrades] = useState<RecentTrade[]>([]);
  const [userOrders, setUserOrders] = useState<OffChainOrderResponse[]>([]);
  const [orderHistory, setOrderHistory] = useState<OffChainOrderResponse[]>([]);
  const [showAdvancedView, setShowAdvancedView] = useState(false);
  const [loading, setLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const [backendOnline, setBackendOnline] = useState(true);
  const [realtimeError, setRealtimeError] = useState<string | null>(null);
  const [marketSummary, setMarketSummary] = useState<MarketStats | null>(null);
  const [marketSummaryLoading, setMarketSummaryLoading] = useState(true);
  const [marketSummaryError, setMarketSummaryError] = useState<string | null>(null);

  const { api: apiService, ws: wsService } = useAppServices();

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

          if (tradesResponse.error?.code === 'BACKEND_OFFLINE' || tradesResponse.error?.code === 'NETWORK_ERROR') {
            setBackendOnline(false);
            setRecentTrades([]);
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

    let tradesSubscription: string | null = null;
    let userSubscription: string | null = null;

    wsService.connect()
      .then(() => {
        setWsConnected(true);
        setRealtimeError(null);

        try {
        tradesSubscription = wsService.subscribe(
          { type: 'Trades', market: selectedMarket },
          (message) => {
              if (message.type === 'MarketData' && message.data.update_type === 'TradeExecution') {
                const trade = message.data.trade;
                const newTrade: RecentTrade = {
                  ...trade,
                  side: trade.maker_side === 'Bid' ? 'sell' : 'buy'
                };

                setRecentTrades(prev => [newTrade, ...prev.slice(0, 19)]);
              } else if (message.type === 'ConnectionStatus') {
                setWsConnected(message.data.status === 'connected');
              }
            }
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Real-time updates unavailable';
          setRealtimeError(message);
          setWsConnected(false);
        }

        if (publicKey) {
          try {
            userSubscription = wsService.subscribe(
              { type: 'UserOrders', user: publicKey.toString() },
              (message) => {
                if (message.type === 'OrderUpdate') {
                  const updatedOrder = message.data.order;

                  setUserOrders(prev => {
                    const filtered = prev.filter(order => order.order_id !== updatedOrder.order_id);
                    if (updatedOrder.status === 'Open' || updatedOrder.status === 'PartiallyFilled') {
                      return [updatedOrder, ...filtered];
                    }
                    return filtered;
                  });

                  if (updatedOrder.status === 'Filled' || updatedOrder.status === 'Cancelled') {
                    setOrderHistory(prev => [updatedOrder, ...prev.slice(0, 19)]);
                  }
                }
              }
            );
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to receive order updates';
            setRealtimeError(message);
          }
        }
      })
      .catch((error) => {
        console.warn('WebSocket connection failed:', error);
        setWsConnected(false);
        setRealtimeError('Real-time infrastructure is offline');
        toast.error('Real-time updates are currently unavailable. Falling back to polling.');
      });

    return () => {
      if (tradesSubscription) wsService.unsubscribe(tradesSubscription);
      if (userSubscription) wsService.unsubscribe(userSubscription);
    };
  }, [publicKey, apiService, wsService, selectedMarket]);

  useEffect(() => {
    let cancelled = false;

    const fetchMarketStats = async () => {
      try {
        if (!cancelled) {
          setMarketSummaryLoading(true);
        }

        const response = await apiService.getMarketStats();
        if (cancelled) {
          return;
        }

        if (response.success && response.data) {
          setMarketSummary(response.data);
          setMarketSummaryError(null);
        } else {
          setMarketSummary(null);
          setMarketSummaryError(response.error?.message || 'Market stats unavailable');
        }
      } catch (err) {
        console.warn('Failed to refresh market stats', err);
        if (!cancelled) {
          setMarketSummary(null);
          setMarketSummaryError('Market stats unavailable');
        }
      } finally {
        if (!cancelled) {
          setMarketSummaryLoading(false);
        }
      }
    };

    fetchMarketStats();
    const interval = setInterval(fetchMarketStats, 30_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [apiService]);

  const handlePriceClick = (price: number) => {
    setSelectedPrice(price);
  };

  const formatNumber = (value: number, decimals = 2) =>
    value.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });

  const formatPercent = (value?: number | null) => {
    if (value === undefined || value === null) return '—';
    return `${value >= 0 ? '+' : ''}${formatNumber(value, 2)}%`;
  };

  const summaryCards = [
    {
      label: 'Last Price',
      primary: marketSummary ? `$${formatNumber(marketSummary.last_price, 2)}` : '—',
      secondary: marketSummary ? formatPercent(marketSummary['24h_change']) : marketSummaryLoading ? 'Refreshing…' : 'Awaiting data',
      tone: marketSummary ? (marketSummary['24h_change'] >= 0 ? 'positive' : 'negative') : 'neutral',
    },
    {
      label: '24h Volume',
      primary: marketSummary ? `${formatNumber(marketSummary['24h_volume'], 2)} SOL` : '—',
      secondary: 'Traded in the last 24h',
      tone: 'neutral' as const,
    },
    {
      label: 'Best Bid',
      primary: marketSummary?.best_bid ? `$${formatNumber(marketSummary.best_bid, 2)}` : '—',
      secondary: marketSummary?.spread ? `Spread ${formatNumber(marketSummary.spread, 2)} USDC` : 'Spread unavailable',
      tone: 'positive' as const,
    },
    {
      label: 'Best Ask',
      primary: marketSummary?.best_ask ? `$${formatNumber(marketSummary.best_ask, 2)}` : '—',
      secondary: marketSummaryError ?? 'Order book depth',
      tone: 'negative' as const,
    },
  ];

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
    <div className="panel-card space-y-4 h-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-200">
          <History className="h-4 w-4 text-blue-300" />
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em]">Recent trades</h3>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="rounded-full p-2 text-slate-400 transition hover:bg-slate-800/70 hover:text-slate-200"
          aria-label="Refresh trade tape"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-900/50 px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.16em] text-slate-400">
        <span>Time</span>
        <span>Price</span>
        <span>Size</span>
        <span>Side</span>
      </div>

      {/* Trade entries */}
      <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
        {recentTrades.map((trade, index) => (
          <div
            key={`${trade.maker_order_id}-${trade.taker_order_id}-${index}`}
            className="flex items-center justify-between rounded-lg px-3 py-1.5 text-xs transition-colors hover:bg-slate-800/60"
          >
            <span className="font-mono text-slate-400">
              {formatTime(trade.timestamp)}
            </span>
            <span className={`font-mono ${
              trade.side === 'buy' ? 'text-green-400' : 'text-red-400'
            }`}>
              {formatPrice(trade.price)}
            </span>
            <span className="font-mono text-slate-200">
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
          <div className="py-6 text-center text-slate-400">
            <Activity className="mx-auto mb-2 h-7 w-7 opacity-60" />
            <p>No recent trades</p>
          </div>
        )}
      </div>

      {/* Trade summary */}
      <div className="grid grid-cols-2 gap-3 rounded-lg border border-slate-800/60 bg-slate-900/40 px-4 py-3 text-xs">
        <div>
          <div className="text-slate-400">Total trades</div>
          <div className="font-mono text-slate-100">{recentTrades.length}</div>
        </div>
        <div>
          <div className="text-slate-400">Avg size</div>
          <div className="font-mono text-slate-100">
            {recentTrades.length > 0
              ? (recentTrades.reduce((sum, t) => sum + t.quantity, 0) / recentTrades.length).toFixed(4)
              : '0.0000'}
          </div>
        </div>
      </div>
    </div>
  );

  const OpenOrdersComponent = () => (
    <div className="panel-card space-y-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-slate-100">
        <Activity className="h-4 w-4 text-emerald-300" />
        Open orders
        {userOrders.length > 0 && (
          <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-xs text-emerald-200">
            {userOrders.length}
          </span>
        )}
      </h3>

      {userOrders.length > 0 ? (
        <div className="space-y-2">
          {/* Header */}
          <div className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-900/50 px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.16em] text-slate-400">
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
              className="flex items-center justify-between rounded-lg px-3 py-2 text-xs transition-colors hover:bg-slate-800/60"
            >
              <span className={`px-2 py-1 rounded text-xs ${
                order.side === 'Bid' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
              }`}>
                {order.side}
              </span>
              <span className="font-mono text-slate-200">{formatPrice(order.price)}</span>
              <span className="font-mono text-slate-200">
                {formatQuantity(order.remaining_quantity)}
              </span>
              <span className={`rounded px-2 py-1 text-xs ${
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
                className="rounded px-2 py-1 text-xs text-rose-300 transition-colors hover:bg-rose-500/15 hover:text-rose-200"
              >
                Cancel
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-6 text-center text-slate-400">
          <p>No open orders</p>
          <p className="mt-2 text-xs text-slate-500">
            Place an order to see it here
          </p>
        </div>
      )}
    </div>
  );

  const OrderHistoryComponent = () => (
    <div className="panel-card space-y-4">
      <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-100">Order history</h3>

      {orderHistory.length > 0 ? (
        <div className="space-y-2 text-xs">
          {/* Header */}
          <div className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-900/50 px-3 py-1.5 uppercase tracking-[0.16em] text-slate-400">
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
              className="flex items-center justify-between rounded-lg px-3 py-2 text-xs transition-colors hover:bg-slate-800/60"
            >
              <span className="font-mono text-xs text-slate-400">
                {formatTime(order.timestamp)}
              </span>
              <span className={`px-2 py-1 rounded text-xs ${
                order.side === 'Bid' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
              }`}>
                {order.side}
              </span>
              <span className="font-mono text-slate-200">{formatPrice(order.price)}</span>
              <span className="font-mono text-slate-200">
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
        <div className="py-6 text-center text-slate-400">
          <p>No order history</p>
          <p className="mt-2 text-xs text-slate-500">
            Your completed orders will appear here
          </p>
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="trade-screen flex min-h-[70vh] items-center justify-center text-slate-100">
        <div className="space-y-3 text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-sky-500/30 border-t-sky-400" />
          <p className="text-sm text-slate-400">Loading trading dashboard…</p>
        </div>
      </div>
    );
  }

  const lastUpdated = new Date().toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div className="trade-screen text-slate-100">
      <div className="trade-screen__container page-container">
        <section className="dashboard-hero">
          <div className="relative overflow-hidden rounded-3xl border border-slate-800/60 bg-slate-950/60 p-8 shadow-[0_40px_120px_-65px_rgba(56,189,248,0.6)]">
            <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-sky-500/10 via-transparent to-transparent" />
            <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="dashboard-hero__header">
            <div className="dashboard-hero__title">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">Sol/USDC trading</p>
              <h1>Trading control room</h1>
              <p className="dashboard-hero__description">
                Monitor the live order book, price action, and balances while submitting orders against the Solana-backed settlement program.
              </p>
            </div>
            <div className="dashboard-status">
              <StatusPill label="REST" live={backendOnline} />
              <StatusPill label="WebSocket" live={wsConnected} />
              <span className="status-pill text-[0.65rem] text-slate-200">
                <Clock className="h-3.5 w-3.5 text-slate-300" />
                Updated {lastUpdated}
              </span>
              <button
                onClick={() => setShowAdvancedView(!showAdvancedView)}
                className="inline-flex items-center gap-2 rounded-full border border-slate-700/60 bg-slate-900/60 px-4 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-200 transition hover:border-slate-500/60"
              >
                {showAdvancedView ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {showAdvancedView ? 'Compact view' : 'Detailed view'}
              </button>
            </div>
          </div>
            </div>
          </div>

          <div className="metric-grid metric-grid--compact">
            {marketSummaryLoading && !marketSummary
              ? [...Array(4)].map((_, idx) => (
                  <div key={`summary-skeleton-${idx}`} className="metric-card animate-pulse">
                    <div className="metric-card__label h-4 w-24 rounded bg-slate-800" />
                    <div className="metric-card__value mt-2 h-6 w-32 rounded bg-slate-800" />
                  </div>
                ))
              : summaryCards.map(({ label, primary, secondary, tone }) => (
                  <SummaryCard key={label} label={label} primary={primary} secondary={secondary} tone={tone} />
                ))}
          </div>

          {(!backendOnline || marketSummaryError || realtimeError) && (
            <div className="panel-stack">
              {!backendOnline && (
                <AlertInline
                  tone="error"
                  title="Backend API unreachable"
                  message="Start the Rust infrastructure services or update VITE_API_BASE_URL / VITE_WS_BASE_URL to point at a reachable deployment."
                />
              )}
              {realtimeError && (
                <AlertInline
                  tone="warning"
                  title="Real-time data unavailable"
                  message={`${realtimeError}. The dashboard continues polling REST endpoints when available.`}
                />
              )}
            </div>
          )}
        </section>

        <section className="panel-grid panel-grid--triple">
          <div className="panel-stack">
            <MarketDataWidget symbol={selectedMarket} />
            <TabSwitcher
              activeTab={activeTab}
              onChange={setActiveTab}
              labels={{ orderbook: 'Order book', history: 'Recent trades' }}
            />
            {activeTab === 'orderbook' ? (
              <OrderBook baseMint={SOL_MINT} quoteMint={USDC_MINT} onPriceClick={handlePriceClick} />
            ) : (
              <TradeHistoryComponent />
            )}
          </div>

          <div className="panel-stack">
            <PriceChart symbol={selectedMarket} height={showAdvancedView ? 420 : 360} />
            <OpenOrdersComponent />
            <OrderHistoryComponent />
          </div>

          <div className="panel-stack sticky-panel" style={{ top: '120px' }}>
            <TradingInterface baseMint={SOL_MINT} quoteMint={USDC_MINT} selectedPrice={selectedPrice} />
            <BalanceManager baseMint={SOL_MINT} quoteMint={USDC_MINT} />
          </div>
        </section>
      </div>
    </div>
  );
};

interface SummaryCardProps {
  label: string;
  primary: string;
  secondary?: string;
  tone: 'positive' | 'negative' | 'neutral';
}

const SummaryCard: React.FC<SummaryCardProps> = ({ label, primary, secondary, tone }) => (
  <div className={clsx('metric-card', tone === 'positive' && 'metric-card--positive', tone === 'negative' && 'metric-card--negative', tone === 'neutral' && 'metric-card--accent')}>
    <p className="metric-card__label">{label}</p>
    <p className="metric-card__value">{primary}</p>
    {secondary ? <p className="metric-card__helper">{secondary}</p> : null}
  </div>
);

interface AlertInlineProps {
  tone: 'error' | 'warning';
  title: string;
  message: string;
}

const AlertInline: React.FC<AlertInlineProps> = ({ tone, title, message }) => (
  <div
    className={clsx(
      'relative overflow-hidden rounded-3xl border px-5 py-4 text-sm',
      tone === 'error' && 'border-rose-500/35 bg-rose-500/8 text-rose-50',
      tone === 'warning' && 'border-amber-400/35 bg-amber-400/8 text-amber-50'
    )}
  >
    <span
      className={clsx(
        'pointer-events-none absolute inset-0 bg-gradient-to-br opacity-60',
        tone === 'error' && 'from-rose-500/30 via-transparent to-transparent',
        tone === 'warning' && 'from-amber-400/25 via-transparent to-transparent'
      )}
    />
    <div className="flex items-start gap-3">
      <AlertTriangle className="mt-0.5 h-4 w-4" />
      <div>
        <p className="font-medium">{title}</p>
        <p className="mt-1 text-xs opacity-80">{message}</p>
      </div>
    </div>
  </div>
);

const StatusPill = ({ label, live }: { label: string; live: boolean }) => (
  <span
    className={clsx(
      'status-pill text-[0.65rem]',
      live ? 'status-pill--online' : 'status-pill--offline',
    )}
  >
    {live ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
    {label}
    <span className="rounded-full bg-slate-900/60 px-2 py-0.5 text-[0.58rem] font-semibold tracking-[0.18em] text-white/80">
      {live ? 'Live' : 'Offline'}
    </span>
  </span>
);

interface TabSwitcherProps {
  activeTab: 'orderbook' | 'history';
  onChange: (tab: 'orderbook' | 'history') => void;
  labels: Record<'orderbook' | 'history', string>;
}

const TabSwitcher: React.FC<TabSwitcherProps> = ({ activeTab, onChange, labels }) => (
  <div className="inline-flex w-full items-center rounded-full border border-slate-800/60 bg-slate-900/60 p-1 shadow-[0_20px_50px_-38px_rgba(99,102,241,0.65)]">
    {(['orderbook', 'history'] as const).map((tab) => (
      <button
        key={tab}
        onClick={() => onChange(tab)}
        className={clsx(
          'flex-1 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition-all duration-200',
          activeTab === tab
            ? 'bg-gradient-to-r from-sky-500 via-indigo-500 to-blue-500 text-white shadow-[0_18px_40px_-28px_rgba(59,130,246,0.8)]'
            : 'text-slate-300 hover:bg-slate-800/70'
        )}
      >
        {labels[tab]}
      </button>
    ))}
  </div>
);
