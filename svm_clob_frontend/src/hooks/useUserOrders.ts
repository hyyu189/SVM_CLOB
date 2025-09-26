/**
 * Hook for managing user orders and trades with real-time updates
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useSvmClobClient } from './useSvmClobClient';
import { OffChainOrderResponse, TradeData, UserAccountData } from '../services/api-types';

export interface UseUserOrdersReturn {
  orders: OffChainOrderResponse[];
  trades: TradeData[];
  userAccount: UserAccountData | null;
  loading: boolean;
  error: string | null;
  connected: boolean;
  refresh: () => void;
  cancelOrder: (orderId: number) => Promise<void>;
  modifyOrder: (orderId: number, updates: { new_price?: number; new_quantity?: number }) => Promise<void>;
}

export const useUserOrders = (): UseUserOrdersReturn => {
  const { publicKey } = useWallet();
  const client = useSvmClobClient();
  const [orders, setOrders] = useState<OffChainOrderResponse[]>([]);
  const [trades, setTrades] = useState<TradeData[]>([]);
  const [userAccount, setUserAccount] = useState<UserAccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const wsSubscribedRef = useRef(false);

  const userId = publicKey?.toString();

  // Fetch user data from off-chain API
  const fetchUserData = useCallback(async () => {
    if (!client || !userId) return;

    try {
      setLoading(true);
      
      // Fetch user orders, trades, and account data
      const [ordersData, tradesData, accountData] = await Promise.all([
        client.getUserOrders(userId, { status: 'Open', limit: 100 }),
        client.getUserTrades(userId, { limit: 50 }),
        client.getUserAccountData(userId).catch(() => null) // Account may not exist yet
      ]);

      setOrders(ordersData);
      setTrades(tradesData);
      if (accountData) {
        setUserAccount(accountData);
      }
      
      setError(null);
    } catch (err) {
      console.error('Error fetching user data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch user data');
    } finally {
      setLoading(false);
    }
  }, [client, userId]);

  // Subscribe to real-time user order updates
  const subscribeToUserUpdates = useCallback(async () => {
    if (!client || !userId || wsSubscribedRef.current) return;

    try {
      // Connect to WebSocket if not already connected
      if (!connected) {
        await client.connectWebSocket();
        setConnected(true);
      }

      // Subscribe to user order updates
      client.subscribeUserOrders(userId, (updatedOrder: OffChainOrderResponse) => {
        setOrders(prevOrders => {
          const { order_id, status } = updatedOrder;
          const existingOrderIndex = prevOrders.findIndex(order => order.order_id === order_id);

          // If the order is 'Filled' or 'Cancelled', remove it from the list.
          if (status === 'Filled' || status === 'Cancelled') {
            return existingOrderIndex >= 0
              ? prevOrders.filter(order => order.order_id !== order_id)
              : prevOrders;
          }

          // If the order already exists, update it.
          if (existingOrderIndex >= 0) {
            const newOrders = [...prevOrders];
            newOrders[existingOrderIndex] = updatedOrder;
            return newOrders;
          }
          
          // If it's a new 'Open' or 'PartiallyFilled' order, add it.
          if (status === 'Open' || status === 'PartiallyFilled') {
            return [updatedOrder, ...prevOrders];
          }

          // In all other cases, return the existing state.
          return prevOrders;
        });

        // Refresh user account data when orders change
        if (client && userId) {
          client.getUserAccountData(userId).then(setUserAccount).catch(console.error);
        }
      });

      wsSubscribedRef.current = true;
    } catch (err) {
      console.error('Failed to connect to real-time updates:', err);
      setConnected(false);
    }
  }, [client, userId, connected]);

  // Unsubscribe from user updates
  const unsubscribeFromUserUpdates = useCallback(() => {
    if (!client || !wsSubscribedRef.current) return;

    client.unsubscribe('user_orders');
    wsSubscribedRef.current = false;
  }, [client]);

  // Cancel an order
  const cancelOrder = useCallback(async (orderId: number) => {
    if (!client) throw new Error('Client not available');

    try {
      await client.cancelOrder(orderId);
      
      // Optimistically update local state
      setOrders(prevOrders => prevOrders.filter(order => order.order_id !== orderId));
      
      // Refresh data to ensure consistency
      await fetchUserData();
    } catch (err) {
      console.error('Error cancelling order:', err);
      throw err;
    }
  }, [client, fetchUserData]);

  // Modify an order
  const modifyOrder = useCallback(async (
    orderId: number, 
    updates: { new_price?: number; new_quantity?: number }
  ) => {
    if (!client) throw new Error('Client not available');

    try {
      const updatedOrder = await client.modifyOrder(orderId, updates);
      
      // Update local state
      setOrders(prevOrders => {
        const orderIndex = prevOrders.findIndex(order => order.order_id === orderId);
        if (orderIndex >= 0) {
          const newOrders = [...prevOrders];
          newOrders[orderIndex] = updatedOrder;
          return newOrders;
        }
        return prevOrders;
      });
      
      // Refresh data to ensure consistency
      await fetchUserData();
    } catch (err) {
      console.error('Error modifying order:', err);
      throw err;
    }
  }, [client, fetchUserData]);

  // Fetch initial data
  useEffect(() => {
    if (client && userId) {
      fetchUserData();
    } else {
      // Clear data when wallet disconnected
      setOrders([]);
      setTrades([]);
      setUserAccount(null);
      setLoading(false);
    }
  }, [fetchUserData, client, userId]);

  // Set up WebSocket subscription
  useEffect(() => {
    if (client && userId && !wsSubscribedRef.current) {
      subscribeToUserUpdates();
    }

    return () => {
      if (wsSubscribedRef.current) {
        unsubscribeFromUserUpdates();
      }
    };
  }, [client, userId, subscribeToUserUpdates, unsubscribeFromUserUpdates]);

  // Fallback polling when WebSocket is not connected
  useEffect(() => {
    if (!connected && client && userId) {
      const interval = setInterval(() => {
        fetchUserData();
      }, 10000); // Poll every 10 seconds when not connected to WebSocket

      return () => clearInterval(interval);
    }
  }, [connected, client, userId, fetchUserData]);

  // Manual refresh function
  const refresh = useCallback(() => {
    setLoading(true);
    fetchUserData();
  }, [fetchUserData]);

  return {
    orders,
    trades,
    userAccount,
    loading,
    error,
    connected,
    refresh,
    cancelOrder,
    modifyOrder,
  };
};