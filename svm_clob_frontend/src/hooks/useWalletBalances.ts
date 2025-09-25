/**
 * Hook for fetching wallet token balances
 */

import { useState, useEffect, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import { BN } from '@coral-xyz/anchor';

export interface WalletBalances {
  sol: number;
  usdc: number;
  loading: boolean;
  error: string | null;
}

// Common USDC mint addresses
const USDC_MINT_DEVNET = new PublicKey('Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr'); // Devnet USDC
const USDC_MINT_MAINNET = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'); // Mainnet USDC

export const useWalletBalances = (
  solMint: PublicKey,
  usdcMint: PublicKey
): WalletBalances & { refresh: () => Promise<void> } => {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();
  
  const [balances, setBalances] = useState<WalletBalances>({
    sol: 0,
    usdc: 0,
    loading: false,
    error: null,
  });

  const fetchBalances = useCallback(async () => {
    if (!publicKey || !connected) {
      setBalances({
        sol: 0,
        usdc: 0,
        loading: false,
        error: null,
      });
      return;
    }

    setBalances(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Fetch SOL balance
      const solBalance = await connection.getBalance(publicKey);
      const solAmount = solBalance / LAMPORTS_PER_SOL;

      // Fetch USDC balance
      let usdcAmount = 0;
      try {
        // Get the associated token account for USDC
        const usdcTokenAccount = await getAssociatedTokenAddress(
          usdcMint,
          publicKey
        );

        // Try to fetch the token account
        const tokenAccountInfo = await getAccount(
          connection,
          usdcTokenAccount
        );

        // Convert from smallest unit (6 decimals for USDC)
        usdcAmount = Number(tokenAccountInfo.amount) / 1e6;
      } catch (error) {
        // Token account might not exist, which is fine - balance is 0
        console.log('USDC token account not found, balance is 0');
      }

      setBalances({
        sol: solAmount,
        usdc: usdcAmount,
        loading: false,
        error: null,
      });
    } catch (error) {
      console.error('Error fetching wallet balances:', error);
      setBalances({
        sol: 0,
        usdc: 0,
        loading: false,
        error: 'Failed to fetch wallet balances',
      });
    }
  }, [connection, publicKey, connected, usdcMint]);

  // Fetch balances on mount and when wallet changes
  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  // Set up auto-refresh
  useEffect(() => {
    if (!connected) return;

    const interval = setInterval(() => {
      fetchBalances();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [connected, fetchBalances]);

  // Listen for balance changes (optional enhancement)
  useEffect(() => {
    if (!publicKey || !connected) return;

    // Subscribe to account changes for SOL
    const solSubscriptionId = connection.onAccountChange(
      publicKey,
      () => {
        fetchBalances();
      },
      'confirmed'
    );

    // Subscribe to USDC token account changes if it exists
    let usdcSubscriptionId: number | null = null;
    
    const subscribeToUsdcChanges = async () => {
      try {
        const usdcTokenAccount = await getAssociatedTokenAddress(
          usdcMint,
          publicKey
        );
        
        usdcSubscriptionId = connection.onAccountChange(
          usdcTokenAccount,
          () => {
            fetchBalances();
          },
          'confirmed'
        );
      } catch (error) {
        // Token account doesn't exist yet
      }
    };

    subscribeToUsdcChanges();

    return () => {
      connection.removeAccountChangeListener(solSubscriptionId);
      if (usdcSubscriptionId !== null) {
        connection.removeAccountChangeListener(usdcSubscriptionId);
      }
    };
  }, [connection, publicKey, connected, usdcMint, fetchBalances]);

  return {
    ...balances,
    refresh: fetchBalances,
  };
};