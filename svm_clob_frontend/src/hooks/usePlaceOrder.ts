/**
 * Hook for placing orders using both off-chain APIs and on-chain contracts
 */

import { useState, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { useSvmClobClient } from './useSvmClobClient';
import { useTransactionHandler } from './useTransactionHandler';
import { useAppServices } from '../app/providers/useAppServices';
import { OffChainOrderResponse, OrderSide, OrderType } from '../services/api-types';
import { OffChainOrder as ClientOffChainOrder } from '../lib/svm_clob_client';
import { isMockMode } from '../config/mode';

export interface PlaceOrderParams {
  side: OrderSide;
  orderType: OrderType;
  price: number;
  quantity: number;
  timeInForce?: 'GoodTillCancelled' | 'ImmediateOrCancel' | 'FillOrKill' | 'GoodTillTime';
  expiryTimestamp?: number;
  selfTradeBehavior?: 'DecrementAndCancel' | 'CancelProvide' | 'CancelTake';
}

export interface PlaceOrderResult {
  offChainOrder: OffChainOrderResponse;
  onChainTxSignature?: string;
  userAccountInitialized?: boolean;
}

export interface UsePlaceOrderReturn {
  placeOrder: (params: PlaceOrderParams) => Promise<PlaceOrderResult>;
  isLoading: boolean;
  error: string | null;
  lastOrderResult: PlaceOrderResult | null;
}

export const usePlaceOrder = (
  baseMint?: PublicKey,
  quoteMint?: PublicKey
): UsePlaceOrderReturn => {
  const { api } = useAppServices();
  const { publicKey, signTransaction } = useWallet();
  const client = useSvmClobClient();
  const { executeTransaction } = useTransactionHandler();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastOrderResult, setLastOrderResult] = useState<PlaceOrderResult | null>(null);

  const placeOrder = useCallback(async (params: PlaceOrderParams): Promise<PlaceOrderResult> => {
    const usingMock = isMockMode();

    if ((!client || !publicKey || !signTransaction) && !usingMock) {
      throw new Error('Wallet not connected or client not available');
    }

    if (!baseMint || !quoteMint) {
      throw new Error('Base mint and quote mint must be provided');
    }

    setIsLoading(true);
    setError(null);

    try {
      let onChainTxSignature: string | undefined;
      let userAccountInitialized = false;
      let offChainOrderResponse: OffChainOrderResponse;

      if (usingMock) {
        const mockOrder = {
          client_order_id: Date.now(),
          side: params.side,
          order_type: params.orderType,
          price: params.price,
          quantity: params.quantity,
          time_in_force: params.timeInForce || 'GoodTillCancelled',
          self_trade_behavior: params.selfTradeBehavior || 'DecrementAndCancel',
        };

        const response = await api.placeOrder(mockOrder, publicKey?.toString() ?? 'mock-user');
        if (!response.success || !response.data) {
          throw new Error(response.error?.message || 'Failed to place mock order');
        }

        offChainOrderResponse = response.data;
      } else {
        if (!client || !publicKey) {
          throw new Error('Client or wallet unavailable.');
        }

        const userAccountExists = await client.userAccountExists(publicKey);

        if (!userAccountExists) {
          const initInstruction = await client.initializeUserAccount(publicKey);
          const txSignature = await executeTransaction([initInstruction], 'Initializing user account');
          onChainTxSignature = txSignature || undefined;
          userAccountInitialized = true;
        }

        const clientOrder: ClientOffChainOrder = {
          client_order_id: Date.now(),
          side: params.side,
          order_type: params.orderType,
          price: params.price,
          quantity: params.quantity,
          time_in_force: params.timeInForce || 'GoodTillCancelled',
          self_trade_behavior: params.selfTradeBehavior || 'DecrementAndCancel',
        };

        offChainOrderResponse = await client.placeOrder(clientOrder);
      }

      const result: PlaceOrderResult = {
        offChainOrder: offChainOrderResponse,
        onChainTxSignature,
        userAccountInitialized,
      };

      setLastOrderResult(result);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to place order';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [api, baseMint, client, executeTransaction, publicKey, quoteMint, signTransaction]);

  return {
    placeOrder,
    isLoading,
    error,
    lastOrderResult,
  };
};
