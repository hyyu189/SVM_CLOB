/**
 * Hook for placing orders using both off-chain APIs and on-chain contracts
 */

import { useState, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction } from '@solana/web3.js';
import { useSvmClobClient } from './useSvmClobClient';
import { useTransactionHandler } from './useTransactionHandler';
import { OffChainOrder, OffChainOrderResponse } from '../lib/svm_clob_client';

export interface PlaceOrderParams {
  side: 'Bid' | 'Ask';
  orderType: 'Limit' | 'Market' | 'PostOnly';
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
      // Prepare off-chain order
      const offChainOrder: OffChainOrder = {
        client_order_id: Date.now(), // Use timestamp as client order ID
        side: params.side,
        order_type: params.orderType,
        price: params.price,
        quantity: params.quantity,
        time_in_force: params.timeInForce || 'GoodTillCancelled',
        expiry_timestamp: params.expiryTimestamp,
        self_trade_behavior: params.selfTradeBehavior || 'DecrementAndCancel',
      };

      // Check if user account exists on-chain
      const userAccountExists = await client.userAccountExists(publicKey);
      let onChainTxSignature: string | undefined;
      let userAccountInitialized = false;

      // Initialize user account if it doesn't exist
      if (!userAccountExists) {
        console.log('Initializing user account on-chain...');
        
        const initInstruction = await client.initializeUserAccount(publicKey);
        const transaction = new Transaction().add(initInstruction);
        
        const txSignature = await executeTransaction(transaction);
        onChainTxSignature = txSignature;
        userAccountInitialized = true;
        
        console.log('User account initialized:', txSignature);
      }

      // Place order off-chain
      console.log('Placing order off-chain...', offChainOrder);
      const offChainOrderResponse = await client.placeOrder(offChainOrder);

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