/**
 * Hook for managing order book data and real-time updates
 */

import { useState, useEffect, useCallback } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useSvmClobClient } from './useSvmClobClient';
import { getMatchingEngine } from '../services/matching-engine';
import { OrderBookSnapshot } from '../types/svm_clob';

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
}

export const useOrderBook = (baseMint: PublicKey, quoteMint: PublicKey) => {
  const client = useSvmClobClient();
  const [orderBook, setOrderBook] = useState<OrderBookData>({
    bids: [],
    asks: [],
    spread: 0,
    lastPrice: 100,
    bestBid: null,
    bestAsk: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrderBook = useCallback(async () => {
    try {
      const matchingEngine = getMatchingEngine();
      
      // Get order book snapshot from matching engine
      const snapshot = await matchingEngine.getOrderBookSnapshot();
      
      // Convert bids
      const bidEntries: OrderBookLevel[] = [];
      let totalBid = 0;
      snapshot.bids.forEach(([price, quantity]) => {
        const priceNum = price.toNumber() / 1e6;
        const quantityNum = quantity.toNumber() / 1e6;
        totalBid += quantityNum;
        bidEntries.push({
          price: priceNum,
          quantity: quantityNum,
          total: totalBid
        });
      });
      
      // Convert asks
      const askEntries: OrderBookLevel[] = [];
      let totalAsk = 0;
      snapshot.asks.forEach(([price, quantity]) => {
        const priceNum = price.toNumber() / 1e6;
        const quantityNum = quantity.toNumber() / 1e6;
        totalAsk += quantityNum;
        askEntries.push({
          price: priceNum,
          quantity: quantityNum,
          total: totalAsk
        });
      });
      
      // Calculate best bid/ask and spread
      const bestBid = bidEntries[0]?.price || null;
      const bestAsk = askEntries[0]?.price || null;
      const spread = bestBid && bestAsk ? bestAsk - bestBid : 0;
      
      // Get recent trades to determine last price
      const recentTrades = await matchingEngine.getRecentTrades(1);
      const lastPrice = recentTrades.length > 0 
        ? recentTrades[0].price.toNumber() / 1e6
        : (bestBid && bestAsk ? (bestBid + bestAsk) / 2 : 100);
      
      setOrderBook({
        bids: bidEntries,
        asks: askEntries,
        spread,
        lastPrice,
        bestBid,
        bestAsk,
      });
      
      setLoading(false);
      setError(null);
    } catch (err) {
      console.error('Error fetching order book:', err);
      setError('Failed to fetch order book data');
      setLoading(false);
    }
  }, [baseMint, quoteMint]);

  // Fetch initial data and set up polling
  useEffect(() => {
    fetchOrderBook();
    
    // Set up interval to refresh order book
    const interval = setInterval(fetchOrderBook, 2000); // Refresh every 2 seconds
    
    return () => clearInterval(interval);
  }, [fetchOrderBook]);

  // Subscribe to trade events for real-time updates (if available)
  useEffect(() => {
    if (!client) return;

    // In a real implementation, you would subscribe to on-chain events here
    // For now, we're using polling instead
    
    // Example of how to subscribe to events (when implemented):
    // const listenerId = client.addEventListener('TradeSettled', (event) => {
    //   // Update order book based on trade event
    //   fetchOrderBook();
    // });
    
    // return () => {
    //   client.removeEventListener(listenerId);
    // };
  }, [client, fetchOrderBook]);

  const refresh = useCallback(() => {
    setLoading(true);
    fetchOrderBook();
  }, [fetchOrderBook]);

  return {
    orderBook,
    loading,
    error,
    refresh,
  };
};