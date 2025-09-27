import React, { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { TooltipProps } from 'recharts';
import { TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { useAppServices } from '../app/providers/useAppServices';

interface PriceDataPoint {
  timestamp: number;
  price: number;
  volume: number;
}

interface PriceChartProps {
  symbol: string;
  height?: number;
  className?: string;
}

const TIMEFRAMES = [
  { key: '1m', label: '1m', hours: 0.25 },
  { key: '5m', label: '5m', hours: 1 },
  { key: '15m', label: '15m', hours: 4 },
  { key: '1h', label: '1h', hours: 24 },
  { key: '4h', label: '4h', hours: 96 },
  { key: '1d', label: '1d', hours: 168 },
] as const;

export const PriceChart: React.FC<PriceChartProps> = ({ symbol, height = 400, className }) => {
  const { api } = useAppServices();
  const [priceData, setPriceData] = useState<PriceDataPoint[]>([]);
  const [timeframe, setTimeframe] = useState<string>('1h');
  const [loading, setLoading] = useState(true);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [priceChange, setPriceChange] = useState<number>(0);
  const [priceChangePercent, setPriceChangePercent] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const timeframeConfig = useMemo(
    () => TIMEFRAMES.find((t) => t.key === timeframe) ?? TIMEFRAMES[3],
    [timeframe]
  );

  useEffect(() => {
    let cancel = false;

    const loadPriceHistory = async () => {
      setLoading(true);
      try {
        const response = await api.getPriceHistory(timeframeConfig.hours);
        if (!cancel) {
          if (response.success && response.data) {
            setPriceData(response.data);

            const firstPrice = response.data[0]?.price ?? 0;
            const lastPricePoint = response.data[response.data.length - 1]?.price ?? 0;

            setCurrentPrice(lastPricePoint);
            setPriceChange(lastPricePoint - firstPrice);
            setPriceChangePercent(firstPrice > 0 ? ((lastPricePoint - firstPrice) / firstPrice) * 100 : 0);
            setError(null);
          } else {
            setPriceData([]);
            setCurrentPrice(0);
            setPriceChange(0);
            setPriceChangePercent(0);
            setError(response.error?.message || 'Price history unavailable');
          }
        }
      } catch (error) {
        console.error('Error loading price history:', error);
        if (!cancel) {
          setPriceData([]);
          setCurrentPrice(0);
          setPriceChange(0);
          setPriceChangePercent(0);
          setError('Price history unavailable');
        }
      } finally {
        if (!cancel) {
          setLoading(false);
        }
      }
    };

    loadPriceHistory();
    const interval = setInterval(loadPriceHistory, 30_000);

    return () => {
      cancel = true;
      clearInterval(interval);
    };
  }, [api, timeframeConfig.hours]);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    switch (timeframe) {
      case '1m':
      case '5m':
      case '15m':
        return date.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });
      case '1h':
      case '4h':
        return date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
        });
      case '1d':
        return date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        });
      default:
        return date.toLocaleTimeString();
    }
  };

  const formatPrice = (price: number) => `$${price.toFixed(2)}`;

const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  if (active && payload && payload.length) {
    const dataPoint = payload[0]?.payload as PriceDataPoint | undefined;
    if (!dataPoint) return null;
    return (
      <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-lg">
        <p className="text-gray-400 text-sm mb-1">{formatTime(label)}</p>
        <div className="space-y-1">
          <p className="text-white font-mono">Price: {formatPrice(dataPoint.price)}</p>
          <p className="text-blue-400 text-sm">Volume: {dataPoint.volume.toFixed(2)}</p>
        </div>
      </div>
    );
  }
  return null;
  };

  if (loading) {
    return (
      <div className={clsx('surface-card p-6', className)} style={{ height }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Price Chart</h3>
          <div className="flex items-center gap-2">
            {TIMEFRAMES.map(({ key, label }) => (
              <button key={key} className="bg-gray-700 px-3 py-1 rounded text-sm" disabled>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="h-full flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            <span className="text-sm text-gray-400">Loading price data…</span>
          </div>
        </div>
      </div>
    );
  }

  if (priceData.length === 0) {
    return (
      <div className={clsx('surface-card p-6 space-y-4', className)} style={{ height }}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Price Chart</h3>
          <div className="flex items-center gap-2 text-sm text-amber-200">
            <TrendingDown className="h-4 w-4" />
            {error || 'No price data available'}
          </div>
        </div>
        <div className="flex justify-between gap-2 text-sm">
          {TIMEFRAMES.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTimeframe(key)}
              className={`flex-1 px-3 py-1 rounded transition-colors ${
                timeframe === key ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex-1 flex items-center justify-center rounded border border-dashed border-gray-600 text-sm text-gray-400">
          Connect to a running backend to display SOL/USDC price history.
        </div>
      </div>
    );
  }

  return (
    <div className={clsx('surface-card p-6', className)} style={{ height }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Price chart</h3>
            <p className="text-xs uppercase tracking-wide text-slate-500">{symbol}</p>
          </div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-500" />
            <span className="text-white font-mono text-lg">{formatPrice(currentPrice)}</span>
            <div className={`flex items-center gap-1 ${priceChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {priceChange >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              <span className="text-sm">
                {priceChange >= 0 ? '+' : ''}
                {priceChangePercent.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm">
          {TIMEFRAMES.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTimeframe(key)}
              className={`px-3 py-1 rounded transition-colors ${
                timeframe === key ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-full">
        <ResponsiveContainer width="100%" height="90%">
          <LineChart data={priceData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="timestamp" tickFormatter={formatTime} stroke="#9ca3af" fontSize={12} tickCount={6} />
            <YAxis stroke="#9ca3af" fontSize={12} domain={['auto', 'auto']} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="price" stroke="#3b82f6" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
