import { useMemo } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useAnchorProvider } from '../contexts/AnchorProvider';
import toast from 'react-hot-toast';

export interface WalletConnectionState {
  connected: boolean;
  connecting: boolean;
  publicKey: PublicKey | null;
  balance: number | null;
  disconnect: () => Promise<void>;
  requestAirdrop: () => Promise<void>;
}

export const useWalletConnection = (): WalletConnectionState => {
  const { connection } = useConnection();
  const { 
    publicKey, 
    connected, 
    connecting, 
    disconnect: walletDisconnect 
  } = useWallet();
  const { provider } = useAnchorProvider();

  const balance = useMemo(() => {
    // This will be populated by a useEffect in a real implementation
    return null;
  }, []);

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