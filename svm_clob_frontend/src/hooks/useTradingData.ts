
import { useState, useEffect, useCallback } from 'react';
import { PublicKey } from '@solana/web3.js';
import toast from 'react-hot-toast';
import { getAppApiService } from '../services/service-factory';
import { getResilientWebSocketService } from '../services/resilient-websocket-service';
import type { TradeData, OffChainOrderResponse } from '../services/api-types';

interface RecentTrade extends TradeData {
  side: 'buy' | 'sell';
}

export const useTradingData = (publicKey: PublicKey | null) => {
  const [recentTrades, setRecentTrades] = useState<RecentTrade[]>([]);
  const [userOrders, setUserOrders] = useState<OffChainOrderResponse[]>([]);
  const [orderHistory, setOrderHistory] = useState<OffChainOrderResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [wsConnected, setWsConnected] = useState(false);

  const apiService = getAppApiService();
  const wsService = getResilientWebSocketService();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Load recent trades
      const tradesResponse = await apiService.getRecentTradesWithPagination(20);
      if (tradesResponse.success && tradesResponse.data) {
        const formattedTrades: RecentTrade[] = tradesResponse.data.map((trade: TradeData) => ({
          ...trade,
          side: trade.maker_side === 'Ask' ? 'sell' : 'buy',
        }));
        setRecentTrades(formattedTrades);
      } else {
        throw new Error(tradesResponse.error?.message || 'Failed to load recent trades');
      }

      // Load user orders if connected
      if (publicKey) {
        const [openOrdersResponse, allOrdersResponse] = await Promise.all([
          apiService.getUserOrders(publicKey.toString(), { status: 'Open' }),
          apiService.getUserOrders(publicKey.toString(), { limit: 20 }),
        ]);

        if (openOrdersResponse.success && openOrdersResponse.data) {
          setUserOrders(openOrdersResponse.data);
        } else {
            throw new Error(openOrdersResponse.error?.message || 'Failed to load user orders');
        }

        if (allOrdersResponse.success && allOrdersResponse.data) {
          const completedOrders = allOrdersResponse.data.filter(
            (order) => order.status === 'Filled' || order.status === 'Cancelled'
          );
          setOrderHistory(completedOrders);
        }
      }
    } catch (err: any) {
        console.error('Error loading trading dashboard data:', err);
        setError(err);
        toast.error(err.message || 'An unexpected error occurred while loading dashboard data.');
    } finally {
      setLoading(false);
    }
  }, [publicKey, apiService]);

  useEffect(() => {
    fetchData();

    wsService.connect()
      .then(() => {
        setWsConnected(true);

        const tradeSubId = wsService.subscribe(
          { type: 'Trades', market: 'SOL/USDC' },
          (message: any) => {
            if (message.type === 'MarketData' && message.data.update_type === 'TradeExecution') {
              const trade = message.data.trade;
              const newTrade: RecentTrade = {
                ...trade,
                side: trade.maker_side === 'Bid' ? 'sell' : 'buy',
              };
              setRecentTrades((prev) => [newTrade, ...prev.slice(0, 19)]);
            } else if (message.type === 'ConnectionStatus') {
              setWsConnected(message.data.status === 'connected');
            }
          }
        );

        if (publicKey) {
          const userOrderSubId = wsService.subscribe(
            { type: 'UserOrders', user: publicKey.toString() },
            (message: any) => {
              if (message.type === 'OrderUpdate') {
                const updatedOrder = message.data.order;
                setUserOrders((prev) => {
                  const filtered = prev.filter((order) => order.order_id !== updatedOrder.order_id);
                  if (updatedOrder.status === 'Open' || updatedOrder.status === 'PartiallyFilled') {
                    return [updatedOrder, ...filtered];
                  }
                  return filtered;
                });

                if (updatedOrder.status === 'Filled' || updatedOrder.status === 'Cancelled') {
                  setOrderHistory((prev) => [updatedOrder, ...prev.slice(0, 19)]);
                }
              }
            }
          );
        }
      })
      .catch((err) => {
        console.warn('WebSocket connection failed:', err);
        setWsConnected(false);
      });

    return () => {
      wsService.disconnect();
    };
  }, [publicKey, wsService, fetchData]);

  return {
    recentTrades,
    userOrders,
    orderHistory,
    loading,
    error,
    wsConnected,
    retry: fetchData,
  };
};
