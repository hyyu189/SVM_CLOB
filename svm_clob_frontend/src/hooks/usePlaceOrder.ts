/**
 * Hook for placing orders using both off-chain APIs and on-chain contracts
 */

import { useState, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction } from '@solana/web3.js';
import { useSvmClobClient } from './useSvmClobClient';
import { useTransactionHandler } from './useTransactionHandler';
import { OffChainOrder, OffChainOrderResponse } from '../services/api-types';
import { OffChainOrder as ClientOffChainOrder } from '../lib/svm_clob_client';
import { OrderSide, OrderType } from '../services/api-types';

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
  const { publicKey, signTransaction } = useWallet();
  const client = useSvmClobClient();
  const { executeTransaction } = useTransactionHandler();
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastOrderResult, setLastOrderResult] = useState<PlaceOrderResult | null>(null);

  const placeOrder = useCallback(async (params: PlaceOrderParams): Promise<PlaceOrderResult> => {
    if (!client || !publicKey || !signTransaction) {
      throw new Error('Wallet not connected or client not available');
    }

    if (!baseMint || !quoteMint) {
      throw new Error('Base mint and quote mint must be provided');
    }

    setIsLoading(true);
    setError(null);

    try {
      // Check if user account exists on-chain
      const userAccountExists = await client.userAccountExists(publicKey);
      let onChainTxSignature: string | undefined;
      let userAccountInitialized = false;

      // Initialize user account if it doesn't exist
      if (!userAccountExists) {
        console.log('Initializing user account on-chain...');

        const initInstruction = await client.initializeUserAccount(publicKey);

        const txSignature = await executeTransaction([initInstruction], 'Initializing user account');
        onChainTxSignature = txSignature || undefined;
        userAccountInitialized = true;

        console.log('User account initialized:', txSignature);
      }

      // Prepare off-chain order for client (with compatible type)
      const clientOrder: ClientOffChainOrder = {
        client_order_id: Date.now(), // Use timestamp as client order ID
        side: params.side,
        order_type: params.orderType,
        price: params.price,
        quantity: params.quantity,
        time_in_force: params.timeInForce || 'GoodTillCancelled',
        self_trade_behavior: (() => {
          const behavior = params.selfTradeBehavior || 'DecrementAndCancel';
          // Map 'CancelBoth' to 'DecrementAndCancel' since client doesn't support it
          return behavior === 'CancelBoth' ? 'DecrementAndCancel' : behavior;
        })(),
      };

      // Place order off-chain
      console.log('Placing order off-chain...', clientOrder);
      const offChainOrderResponse = await client.placeOrder(clientOrder);

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
  }, [client, publicKey, signTransaction, baseMint, quoteMint, executeTransaction]);

  return {
    placeOrder,
    isLoading,
    error,
    lastOrderResult,
  };
};