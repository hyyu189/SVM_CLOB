/**
 * Hook for managing order book data and real-time updates
 * Enhanced to work with both on-chain contracts and off-chain APIs
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useAppServices } from '../app/providers/useAppServices';
import { useMarketDataStore } from '../stores/marketDataStore';
import type { OrderBookSnapshot, MarketStats, TradeData } from '../services/api-types';

export interface OrderBookLevel {
  price: number;
  quantity: number;
  total: number;
}

export interface OrderBookData {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  spread: number;
  lastPrice: number;
  bestBid: number | null;
  bestAsk: number | null;
  sequenceNumber: number;
  timestamp: number;
}

export interface UseOrderBookReturn {
  orderBook: OrderBookData;
  marketStats: MarketStats | null;
  loading: boolean;
  error: string | null;
  connected: boolean;
  refresh: () => void;
}

const DEFAULT_ORDER_BOOK: OrderBookData = {
  bids: [],
  asks: [],
  spread: 0,
  lastPrice: 0,
  bestBid: null,
  bestAsk: null,
  sequenceNumber: 0,
  timestamp: 0,
};

export const useOrderBook = (
  _baseMint?: PublicKey,
  _quoteMint?: PublicKey,
  market = 'SOL/USDC'
): UseOrderBookReturn => {
  const { api, ws } = useAppServices();
  const setOrderBookSnapshot = useMarketDataStore((state) => state.setOrderBook);
  const prependTrade = useMarketDataStore((state) => state.prependTrade);

  const [orderBook, setOrderBook] = useState<OrderBookData>(DEFAULT_ORDER_BOOK);
  const [marketStats, setMarketStats] = useState<MarketStats | null>(null);
  const marketStatsRef = useRef<MarketStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(ws.isConnected());
  const subscriptionIds = useRef<string[]>([]);

  const processOrderBookSnapshot = useCallback((snapshot: OrderBookSnapshot, stats?: MarketStats | null) => {
    const effectiveStats = stats ?? marketStatsRef.current;

    const bids: OrderBookLevel[] = [];
    let bidTotal = 0;
    snapshot.bids.forEach(([price, quantity]) => {
      bidTotal += quantity;
      bids.push({ price, quantity, total: bidTotal });
    });

    const asks: OrderBookLevel[] = [];
    let askTotal = 0;
    snapshot.asks.forEach(([price, quantity]) => {
      askTotal += quantity;
      asks.push({ price, quantity, total: askTotal });
    });

    const bestBid = bids[0]?.price ?? null;
    const bestAsk = asks[0]?.price ?? null;
    const spread = bestBid && bestAsk ? bestAsk - bestBid : 0;
    const lastPrice = effectiveStats?.last_price ?? (bestBid && bestAsk ? (bestBid + bestAsk) / 2 : orderBook.lastPrice);

    const processed: OrderBookData = {
      bids,
      asks,
      spread,
      lastPrice,
      bestBid,
      bestAsk,
      sequenceNumber: snapshot.sequence_number,
      timestamp: snapshot.timestamp,
    };

    setOrderBook(processed);
    setOrderBookSnapshot(snapshot);
  }, [orderBook.lastPrice, setOrderBookSnapshot]);

  const applyMarketStats = useCallback((stats: MarketStats) => {
    marketStatsRef.current = stats;
    setMarketStats(stats);
    setOrderBook((prev) => ({
      ...prev,
      lastPrice: stats.last_price ?? prev.lastPrice,
      bestBid: stats.best_bid ?? prev.bestBid,
      bestAsk: stats.best_ask ?? prev.bestAsk,
      spread: stats.best_bid && stats.best_ask ? stats.best_ask - stats.best_bid : prev.spread,
    }));
  }, []);

  const fetchOrderBook = useCallback(async () => {
    try {
      setLoading(true);
      const [orderBookResponse, statsResponse] = await Promise.all([
        api.getOrderBookSnapshot(20),
        api.getMarketStats().catch(() => null),
      ]);

      if (statsResponse?.success && statsResponse.data) {
        applyMarketStats(statsResponse.data);
      }

      if (orderBookResponse.success && orderBookResponse.data) {
        processOrderBookSnapshot(orderBookResponse.data, statsResponse?.data ?? undefined);
        setError(null);
      } else {
        setOrderBook(DEFAULT_ORDER_BOOK);
        setError(orderBookResponse.error?.message ?? 'Failed to fetch order book');
      }
    } catch (err) {
      console.error('Error fetching order book:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch order book data');
      setOrderBook(DEFAULT_ORDER_BOOK);
    } finally {
      setLoading(false);
    }
  }, [api, applyMarketStats, processOrderBookSnapshot]);

  const handleTradeUpdate = useCallback((trade: TradeData) => {
    prependTrade(trade);
    api.getMarketStats()
      .then((response) => {
        if (response.success && response.data) {
          applyMarketStats(response.data);
        }
      })
      .catch((err) => console.debug('Failed to refresh market stats after trade', err));
  }, [api, applyMarketStats, prependTrade]);

  useEffect(() => {
    fetchOrderBook();
  }, [fetchOrderBook]);

  useEffect(() => {
    const ids: string[] = [];

    const ensureConnection = async () => {
      try {
        await ws.connect();
        setConnected(true);
      } catch (err) {
        console.debug('WebSocket connect failed, will rely on polling', err);
        setConnected(false);
      }
    };

    ensureConnection();

    try {
      const orderBookSubscription = ws.subscribe(
        { type: 'OrderBook', market },
        (message) => {
          if (message.type === 'MarketData' && message.data.update_type === 'OrderBookUpdate') {
            processOrderBookSnapshot(message.data.order_book);
            setConnected(true);
          }
        }
      );
      ids.push(orderBookSubscription);

      const tradesSubscription = ws.subscribe(
        { type: 'Trades', market },
        (message) => {
          if (message.type === 'MarketData' && message.data.update_type === 'TradeExecution') {
            handleTradeUpdate(message.data.trade);
          }
        }
      );
      ids.push(tradesSubscription);

      subscriptionIds.current = ids;
    } catch (err) {
      console.error('Error subscribing to WebSocket updates:', err);
      setConnected(false);
    }

    return () => {
      subscriptionIds.current.forEach((id) => ws.unsubscribe(id));
      subscriptionIds.current = [];
    };
  }, [handleTradeUpdate, market, processOrderBookSnapshot, ws]);

  useEffect(() => {
    if (!connected) {
      const interval = setInterval(fetchOrderBook, 5_000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [connected, fetchOrderBook]);

  const refresh = useCallback(() => {
    setLoading(true);
    fetchOrderBook();
  }, [fetchOrderBook]);

  return {
    orderBook,
    marketStats,
    loading,
    error,
    connected,
    refresh,
  };
};
