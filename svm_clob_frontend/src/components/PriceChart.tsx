import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { getMockApiService } from '../services/mock-api-service';

interface PriceDataPoint {
  timestamp: number;
  price: number;
  volume: number;
}

interface PriceChartProps {
  symbol: string;
  height?: number;
}

export const PriceChart: React.FC<PriceChartProps> = ({ symbol, height = 400 }) => {
  const [priceData, setPriceData] = useState<PriceDataPoint[]>([]);
  const [timeframe, setTimeframe] = useState<string>('1h');
  const [loading, setLoading] = useState(true);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [priceChange, setPriceChange] = useState<number>(0);
  const [priceChangePercent, setPriceChangePercent] = useState<number>(0);

  const apiService = getMockApiService();

  const timeframes = [
    { key: '1m', label: '1m', hours: 0.25 },
    { key: '5m', label: '5m', hours: 1 },
    { key: '15m', label: '15m', hours: 4 },
    { key: '1h', label: '1h', hours: 24 },
    { key: '4h', label: '4h', hours: 96 },
    { key: '1d', label: '1d', hours: 168 }
  ];

  useEffect(() => {
    const loadPriceHistory = async () => {
      setLoading(true);
      try {
        const selectedTimeframe = timeframes.find(t => t.key === timeframe);
        const hours = selectedTimeframe?.hours || 24;

        const response = await apiService.getPriceHistory(hours);
        if (response.success && response.data) {
          setPriceData(response.data);

          // Calculate price change
          const firstPrice = response.data[0]?.price || 0;
          const lastPrice = response.data[response.data.length - 1]?.price || 0;

          setCurrentPrice(lastPrice);
          setPriceChange(lastPrice - firstPrice);
          setPriceChangePercent(firstPrice > 0 ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0);
        }
      } catch (error) {
        console.error('Error loading price history:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPriceHistory();

    // Set up periodic updates
    const interval = setInterval(loadPriceHistory, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, [timeframe, apiService]);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    switch (timeframe) {
      case '1m':
      case '5m':
      case '15m':
        return date.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
      case '1h':
      case '4h':
        return date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit'
        });
      case '1d':
        return date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        });
      default:
        return date.toLocaleTimeString();
    }
  };

  const formatPrice = (price: number) => `$${price.toFixed(2)}`;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-lg">
          <p className="text-gray-400 text-sm mb-1">{formatTime(label)}</p>
          <div className="space-y-1">
            <p className="text-white font-mono">
              Price: {formatPrice(data.price)}
            </p>
            <p className="text-blue-400 text-sm">
              Volume: {data.volume.toFixed(2)}
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6" style={{ height }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Price Chart</h3>
          <div className="flex items-center gap-2">
            {timeframes.map(({ key, label }) => (
              <button
                key={key}
                className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-sm transition-colors"
                disabled
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="h-full flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="text-sm text-gray-400">Loading price data...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6" style={{ height }}>
      {/* Header with timeframe selector */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold">Price Chart</h3>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-500" />
            <span className="text-white font-mono text-lg">
              {formatPrice(currentPrice)}
            </span>
            <div className={`flex items-center gap-1 ${
              priceChange >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {priceChange >= 0 ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
              <span className="text-sm">
                {priceChange >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm">
          {timeframes.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTimeframe(key)}
              className={`px-3 py-1 rounded transition-colors ${
                timeframe === key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="h-full">
        <ResponsiveContainer width="100%" height="90%">
          <LineChart data={priceData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="timestamp"
              tickFormatter={formatTime}
              stroke="#9ca3af"
              fontSize={12}
              tickCount={6}
            />
            <YAxis
              domain={['dataMin - 1', 'dataMax + 1']}
              tickFormatter={(value) => `$${value.toFixed(2)}`}
              stroke="#9ca3af"
              fontSize={12}
              width={60}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="price"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, stroke: '#3b82f6', strokeWidth: 2, fill: '#1f2937' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart info */}
      <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
        <div>
          {priceData.length} data points • Updated {new Date().toLocaleTimeString()}
        </div>
        <div>
          High: {Math.max(...priceData.map(d => d.price)).toFixed(2)} •
          Low: {Math.min(...priceData.map(d => d.price)).toFixed(2)}
        </div>
      </div>
    </div>
  );
};