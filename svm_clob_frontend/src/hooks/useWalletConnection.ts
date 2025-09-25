import { useState, useEffect, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { 
  getAssociatedTokenAddress, 
  getAccount,
  TokenAccountNotFoundError,
  TokenInvalidAccountOwnerError,
} from '@solana/spl-token';
import { useAnchorProvider } from '../contexts/AnchorProvider';
import toast from 'react-hot-toast';

export interface TokenBalance {
  mint: string;
  symbol: string;
  balance: number;
  decimals: number;
  uiAmount: number;
}

export interface WalletConnectionState {
  connected: boolean;
  connecting: boolean;
  publicKey: PublicKey | null;
  solBalance: number | null;
  tokenBalances: TokenBalance[];
  isLoadingBalances: boolean;
  refreshBalances: () => Promise<void>;
  disconnect: () => Promise<void>;
  requestAirdrop: () => Promise<void>;
}

// Known token mints for devnet
const KNOWN_TOKENS = {
  'So11111111111111111111111111111111111111112': { symbol: 'SOL', decimals: 9 },
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': { symbol: 'USDC', decimals: 6 },
  '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU': { symbol: 'USDC', decimals: 6 }, // Devnet USDC
};

export const useWalletConnection = (): WalletConnectionState => {
  const { connection } = useConnection();
  const { 
    publicKey, 
    connected, 
    connecting, 
    disconnect: walletDisconnect 
  } = useWallet();
  const { provider } = useAnchorProvider();

  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [tokenBalances, setTokenBalances] = useState<TokenBalance[]>([]);
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);

  // Fetch SOL balance
  const fetchSolBalance = useCallback(async (): Promise<number> => {
    if (!publicKey || !connection) return 0;

    try {
      const balance = await connection.getBalance(publicKey);
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      console.error('Error fetching SOL balance:', error);
      return 0;
    }
  }, [connection, publicKey]);

  // Fetch token balance for a specific mint
  const fetchTokenBalance = useCallback(async (
    mint: PublicKey,
    symbol: string,
    decimals: number
  ): Promise<TokenBalance | null> => {
    if (!publicKey || !connection) return null;

    try {
      const associatedTokenAddress = await getAssociatedTokenAddress(mint, publicKey);
      const tokenAccount = await getAccount(connection, associatedTokenAddress);
      
      const balance = Number(tokenAccount.amount);
      const uiAmount = balance / Math.pow(10, decimals);

      return {
        mint: mint.toString(),
        symbol,
        balance,
        decimals,
        uiAmount,
      };
    } catch (error) {
      if (error instanceof TokenAccountNotFoundError || error instanceof TokenInvalidAccountOwnerError) {
        // Token account doesn't exist, return zero balance
        return {
          mint: mint.toString(),
          symbol,
          balance: 0,
          decimals,
          uiAmount: 0,
        };
      }
      console.error(`Error fetching ${symbol} balance:`, error);
      return null;
    }
  }, [connection, publicKey]);

  // Refresh all balances
  const refreshBalances = useCallback(async (): Promise<void> => {
    if (!publicKey || !connected) {
      setSolBalance(null);
      setTokenBalances([]);
      return;
    }

    setIsLoadingBalances(true);
    try {
      // Fetch SOL balance
      const solBal = await fetchSolBalance();
      setSolBalance(solBal);

      // Fetch token balances for known tokens
      const tokenBalancePromises = Object.entries(KNOWN_TOKENS)
        .filter(([mintAddress]) => mintAddress !== 'So11111111111111111111111111111111111111112') // Skip SOL
        .map(async ([mintAddress, tokenInfo]) => {
          const mint = new PublicKey(mintAddress);
          return await fetchTokenBalance(mint, tokenInfo.symbol, tokenInfo.decimals);
        });

      const tokenBalanceResults = await Promise.all(tokenBalancePromises);
      const validTokenBalances = tokenBalanceResults.filter((balance): balance is TokenBalance => balance !== null);
      
      setTokenBalances(validTokenBalances);
    } catch (error) {
      console.error('Error refreshing balances:', error);
      toast.error('Failed to refresh wallet balances');
    } finally {
      setIsLoadingBalances(false);
    }
  }, [publicKey, connected, fetchSolBalance, fetchTokenBalance]);

  // Auto-refresh balances when wallet connects
  useEffect(() => {
    if (connected && publicKey) {
      refreshBalances();
      
      // Set up periodic refresh every 30 seconds
      const interval = setInterval(refreshBalances, 30000);
      return () => clearInterval(interval);
    } else {
      setSolBalance(null);
      setTokenBalances([]);
    }
  }, [connected, publicKey, refreshBalances]);

  const disconnect = async () => {
    try {
      await walletDisconnect();
      toast.success('Wallet disconnected');
    } catch (error) {
      console.error('Disconnect error:', error);
      toast.error('Failed to disconnect wallet');
    }
  };

  const requestAirdrop = async () => {
    if (!publicKey || !connection) {
      toast.error('Wallet not connected');
      return;
    }

    try {
      toast.loading('Requesting airdrop...');
      const signature = await connection.requestAirdrop(
        publicKey,
        LAMPORTS_PER_SOL
      );
      
      await connection.confirmTransaction(signature, 'confirmed');
      toast.dismiss();
      toast.success('Airdrop successful! 1 SOL added to your wallet');
    } catch (error) {
      toast.dismiss();
      console.error('Airdrop error:', error);
      toast.error('Airdrop failed. You may have reached the rate limit.');
    }
  };

  return {
    connected,
    connecting,
    publicKey,
    balance,
    disconnect,
    requestAirdrop,
  };
};