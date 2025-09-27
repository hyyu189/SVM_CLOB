import { useState, useEffect, useCallback } from 'react';
import { PublicKey } from '@solana/web3.js';
import toast from 'react-hot-toast';
import { useAppServices } from '../app/providers/useAppServices';
import type { TradeData, OffChainOrderResponse } from '../services/api-types';

interface RecentTrade extends TradeData {
  side: 'buy' | 'sell';
}

export const useTradingData = (publicKey: PublicKey | null) => {
  const { api, ws } = useAppServices();

  const [recentTrades, setRecentTrades] = useState<RecentTrade[]>([]);
  const [userOrders, setUserOrders] = useState<OffChainOrderResponse[]>([]);
  const [orderHistory, setOrderHistory] = useState<OffChainOrderResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [wsConnected, setWsConnected] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const tradesResponse = await api.getRecentTradesWithPagination(20);
      if (tradesResponse.success && tradesResponse.data) {
        const formattedTrades: RecentTrade[] = tradesResponse.data.map((trade: TradeData) => ({
          ...trade,
          side: trade.maker_side === 'Ask' ? 'sell' : 'buy',
        }));
        setRecentTrades(formattedTrades);
      } else {
        throw new Error(tradesResponse.error?.message || 'Failed to load recent trades');
      }

      if (publicKey) {
        const owner = publicKey.toString();
        const [openOrdersResponse, allOrdersResponse] = await Promise.all([
          api.getUserOrders(owner, { status: 'Open' }),
          api.getUserOrders(owner, { limit: 20 }),
        ]);

        if (openOrdersResponse.success && openOrdersResponse.data) {
          setUserOrders(openOrdersResponse.data);
        }

        if (allOrdersResponse.success && allOrdersResponse.data) {
          const completedOrders = allOrdersResponse.data.filter(
            (order) => order.status === 'Filled' || order.status === 'Cancelled'
          );
          setOrderHistory(completedOrders);
        }
      }
    } catch (err) {
      console.error('Error loading trading dashboard data:', err);
      const error = err instanceof Error ? err : new Error('Failed to load trading data');
      setError(error);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [api, publicKey]);

  useEffect(() => {
    fetchData();

    let tradeSubId: string | null = null;
    let userSubId: string | null = null;

    ws.connect()
      .then(() => {
        setWsConnected(true);
        tradeSubId = ws.subscribe(
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
          userSubId = ws.subscribe(
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
      if (tradeSubId) ws.unsubscribe(tradeSubId);
      if (userSubId) ws.unsubscribe(userSubId);
    };
  }, [fetchData, publicKey, ws]);

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
