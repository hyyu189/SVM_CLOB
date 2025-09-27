import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import { TrendingUp, Activity, AlertTriangle } from 'lucide-react';
import { useAppServices } from '../app/providers/useAppServices';
import type { MarketStats } from '../services/api-types';
import { CONFIG } from '../config/config';

interface MarketDataWidgetProps {
  symbol: string;
  className?: string;
}

export const MarketDataWidget: React.FC<MarketDataWidgetProps> = ({ symbol, className }) => {
  const { api, ws } = useAppServices();
  const [marketStats, setMarketStats] = useState<MarketStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    const loadInitialData = async () => {
      try {
        const response = await api.getMarketStats();
        if (!ignore) {
          if (response.success && response.data) {
            setMarketStats(response.data);
            setError(null);
          } else {
            setMarketStats(null);
            setError(response.error?.message || 'Unable to load market data');
          }
        }
      } catch (err) {
        console.error('Error loading market data:', err);
        if (!ignore) {
          setMarketStats(null);
          setError('Unable to load market data');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    loadInitialData();

    return () => {
      ignore = true;
    };
  }, [api]);

  useEffect(() => {
    let subscriptionId: string | null = null;
    let cancelled = false;

    const connect = async () => {
      try {
        await ws.connect();
        if (cancelled) {
          return;
        }

        subscriptionId = ws.subscribe(
          { type: 'AllMarkets' },
          (message) => {
            if (message.type === 'AllMarketsUpdate') {
              const marketData = message.data.markets[symbol];
              if (marketData) {
                setMarketStats(marketData.stats);
                setError(null);
              }
            } else if (message.type === 'ConnectionStatus' && message.data.status === 'disconnected') {
              setError('Real-time updates unavailable');
            }
          }
        );
      } catch (err) {
        console.debug('Market data WebSocket unavailable', err);
        setError((prev) => prev ?? 'Real-time updates unavailable');
      }
    };

    connect();

    return () => {
      cancelled = true;
      if (subscriptionId) {
        ws.unsubscribe(subscriptionId);
      }
    };
  }, [symbol, ws]);

  const isLoadingSkeleton = loading && !marketStats;
  const isUnavailable = !loading && !marketStats;

  const formatNumber = (num: number, decimals = 2) =>
    num.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });

  const formatVolume = (volume: number) => {
    if (volume >= 1_000_000) {
      return `${(volume / 1_000_000).toFixed(1)}M`;
    }
    if (volume >= 1_000) {
      return `${(volume / 1_000).toFixed(1)}K`;
    }
    return volume.toFixed(1);
  };

  const isPositiveChange = (marketStats?.['24h_change'] ?? 0) >= 0;

  return (
    <div className={clsx('surface-card p-6 space-y-6', className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/15 text-blue-200">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Market Overview</p>
            <h2 className="text-2xl font-semibold text-white">{symbol}</h2>
          </div>
        </div>
        <span
          className={clsx(
            'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium',
            isUnavailable
              ? 'border-amber-400/40 bg-amber-400/10 text-amber-200'
              : 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200'
          )}
        >
          {isUnavailable ? <AlertTriangle className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
          {isUnavailable ? 'Data unavailable' : 'Live feed'}
        </span>
      </div>

      {isLoadingSkeleton && (
        <div className="grid gap-4 sm:grid-cols-2">
          {[...Array(4)].map((_, idx) => (
            <div
              key={`metric-skeleton-${idx}`}
              className="rounded-xl border border-slate-800/40 bg-slate-900/60 p-4 animate-pulse"
            >
              <div className="h-4 w-24 rounded bg-slate-800" />
              <div className="mt-3 h-6 w-32 rounded bg-slate-800" />
            </div>
          ))}
        </div>
      )}

      {isUnavailable && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-4 text-sm text-amber-100">
          <p className="font-medium">Market data unavailable</p>
          <p className="mt-1 text-xs text-amber-200/80">
            Ensure the REST API at
            {' '}
            <code className="font-mono text-amber-100">{CONFIG.API_BASE_URL}</code>
            {' '}
            is reachable. The widget will refresh automatically when data resumes.
          </p>
        </div>
      )}

      {marketStats && !isUnavailable && (
        <>
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline gap-3 text-3xl font-semibold text-white">
              <span>${formatNumber(marketStats.last_price, 2)}</span>
              <span
                className={clsx(
                  'text-sm font-medium px-2 py-0.5 rounded-full',
                  isPositiveChange ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'
                )}
              >
                {isPositiveChange ? '+' : ''}
                {formatNumber(marketStats['24h_change'], 2)}%
              </span>
            </div>
            <p className="text-xs text-slate-400">Last traded price with daily performance</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="24h Volume" value={`${formatVolume(marketStats['24h_volume'])} ${symbol.split('/')[0]}`} />
            <Metric label="24h High" value={`$${formatNumber(marketStats['24h_high'], 2)}`} />
            <Metric label="24h Low" value={`$${formatNumber(marketStats['24h_low'], 2)}`} />
            <Metric label="Spread" value={marketStats.spread ? `${formatNumber(marketStats.spread, 2)} USDC` : '—'} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Metric label="Best Bid" value={marketStats.best_bid ? `$${formatNumber(marketStats.best_bid, 2)}` : '—'} tone="positive" />
            <Metric label="Best Ask" value={marketStats.best_ask ? `$${formatNumber(marketStats.best_ask, 2)}` : '—'} tone="negative" />
          </div>
        </>
      )}
    </div>
  );
};

interface MetricProps {
  label: string;
  value: string;
  tone?: 'positive' | 'negative' | 'neutral';
}

const Metric: React.FC<MetricProps> = ({ label, value, tone = 'neutral' }) => (
  <div className="rounded-xl border border-slate-800/50 bg-slate-900/60 px-4 py-3">
    <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
    <p
      className={clsx(
        'mt-2 text-lg font-semibold',
        tone === 'positive' && 'text-emerald-300',
        tone === 'negative' && 'text-rose-300',
        tone === 'neutral' && 'text-slate-100'
      )}
    >
      {value}
    </p>
  </div>
);
