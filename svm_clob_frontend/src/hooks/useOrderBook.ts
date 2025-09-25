/**
 * Hook for managing order book data and real-time updates
 * Enhanced to work with both on-chain contracts and off-chain APIs
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useSvmClobClient } from './useSvmClobClient';
import { OrderBookSnapshot, MarketStats } from '../lib/svm_clob_client';

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
  subscribeToUpdates: () => void;
  unsubscribeFromUpdates: () => void;
}

export const useOrderBook = (
  baseMint?: PublicKey, 
  quoteMint?: PublicKey,
  market = 'SOL/USDC'
): UseOrderBookReturn => {
  const client = useSvmClobClient();
  const [orderBook, setOrderBook] = useState<OrderBookData>({
    bids: [],
    asks: [],
    spread: 0,
    lastPrice: 100,
    bestBid: null,
    bestAsk: null,
    sequenceNumber: 0,
    timestamp: 0,
  });
  const [marketStats, setMarketStats] = useState<MarketStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const wsSubscribedRef = useRef(false);

  // Process order book snapshot into display format
  const processOrderBookSnapshot = useCallback((snapshot: OrderBookSnapshot): OrderBookData => {
    // Convert bids (sorted highest to lowest)
    const bidEntries: OrderBookLevel[] = [];
    let totalBid = 0;
    snapshot.bids.forEach(([price, quantity]) => {
      totalBid += quantity;
      bidEntries.push({
        price,
        quantity,
        total: totalBid
      });
    });

    // Convert asks (sorted lowest to highest)
    const askEntries: OrderBookLevel[] = [];
    let totalAsk = 0;
    snapshot.asks.forEach(([price, quantity]) => {
      totalAsk += quantity;
      askEntries.push({
        price,
        quantity,
        total: totalAsk
      });
    });

    // Calculate best bid/ask and spread
    const bestBid = bidEntries[0]?.price || null;
    const bestAsk = askEntries[0]?.price || null;
    const spread = bestBid && bestAsk ? bestAsk - bestBid : 0;

    // Determine last price from market stats or mid-price
    const lastPrice = marketStats?.last_price || 
      (bestBid && bestAsk ? (bestBid + bestAsk) / 2 : 100);

    return {
      bids: bidEntries,
      asks: askEntries,
      spread,
      lastPrice,
      bestBid,
      bestAsk,
      sequenceNumber: snapshot.sequence_number,
      timestamp: snapshot.timestamp,
    };
  }, [marketStats]);

  // Fetch order book data from off-chain API
  const fetchOrderBook = useCallback(async () => {
    if (!client) return;

    try {
      setLoading(true);
      
      // Fetch both order book snapshot and market stats
      const [orderBookSnapshot, stats] = await Promise.all([
        client.getOrderBookSnapshot(20), // Get top 20 levels
        client.getMarketStats().catch(() => null) // Market stats may not be available
      ]);

      if (stats) {
        setMarketStats(stats);
      }

      const processedOrderBook = processOrderBookSnapshot(orderBookSnapshot);
      setOrderBook(processedOrderBook);
      
      setError(null);
    } catch (err) {
      console.error('Error fetching order book:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch order book data');
    } finally {
      setLoading(false);
    }
  }, [client, processOrderBookSnapshot]);

  // Subscribe to real-time WebSocket updates
  const subscribeToUpdates = useCallback(async () => {
    if (!client || wsSubscribedRef.current) return;

    try {
      // Connect to WebSocket
      await client.connectWebSocket();
      setConnected(true);

      // Subscribe to order book updates
      client.subscribeOrderBook(market, (orderBookSnapshot: OrderBookSnapshot) => {
        const processedOrderBook = processOrderBookSnapshot(orderBookSnapshot);
        setOrderBook(processedOrderBook);
      });

      // Subscribe to trade updates to get market stats
      client.subscribeTrades(market, () => {
        // Refresh market stats when new trades occur
        client.getMarketStats().then(setMarketStats).catch(console.error);
      });

      wsSubscribedRef.current = true;
    } catch (err) {
      console.error('Error connecting to WebSocket:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect to real-time updates');
      setConnected(false);
    }
  }, [client, market, processOrderBookSnapshot]);

  // Unsubscribe from WebSocket updates
  const unsubscribeFromUpdates = useCallback(() => {
    if (!client || !wsSubscribedRef.current) return;

    client.unsubscribe('orderbook');
    client.unsubscribe('trades');
    client.disconnectWebSocket();
    setConnected(false);
    wsSubscribedRef.current = false;
  }, [client]);

  // Fetch initial data
  useEffect(() => {
    if (client) {
      fetchOrderBook();
    }
  }, [fetchOrderBook]);

  // Set up WebSocket subscription
  useEffect(() => {
    if (client && !wsSubscribedRef.current) {
      subscribeToUpdates();
    }

    return () => {
      if (wsSubscribedRef.current) {
        unsubscribeFromUpdates();
      }
    };
  }, [client, subscribeToUpdates, unsubscribeFromUpdates]);

  // Fallback polling when WebSocket is not connected
  useEffect(() => {
    if (!connected && client) {
      const interval = setInterval(() => {
        fetchOrderBook();
      }, 5000); // Poll every 5 seconds when not connected to WebSocket

      return () => clearInterval(interval);
    }
  }, [connected, client, fetchOrderBook]);

  // Manual refresh function
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
    subscribeToUpdates,
    unsubscribeFromUpdates,
  };
};