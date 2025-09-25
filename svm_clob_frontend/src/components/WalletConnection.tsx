import React from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletConnection } from '../hooks/useWalletConnection';
import { Wallet, Coins, Zap } from 'lucide-react';

export const WalletConnection: React.FC = () => {
  const { publicKey } = useWallet();
  const { connected, connecting, balance, requestAirdrop } = useWalletConnection();

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  return (
    <div className="flex items-center gap-4">
      {connected && publicKey && (
        <div className="flex items-center gap-3 bg-gray-800 rounded-lg px-4 py-2">
          <Wallet className="h-4 w-4 text-blue-400" />
          <span className="text-sm font-mono text-gray-300">
            {formatAddress(publicKey.toString())}
          </span>
          {balance !== null && (
            <div className="flex items-center gap-1">
              <Coins className="h-4 w-4 text-yellow-400" />
              <span className="text-sm text-gray-300">
                {balance.toFixed(4)} SOL
              </span>
            </div>
          )}
          <button
            onClick={requestAirdrop}
            className="flex items-center gap-1 bg-purple-600 hover:bg-purple-700 px-2 py-1 rounded text-xs transition-colors"
            title="Request 1 SOL airdrop (devnet only)"
          >
            <Zap className="h-3 w-3" />
            Airdrop
          </button>
        </div>
      )}
      
      <div className="wallet-adapter-button-trigger">
        <WalletMultiButton className="!bg-blue-600 hover:!bg-blue-700 !rounded-lg !px-4 !py-2 !text-sm !font-medium !transition-colors" />
      </div>
    </div>
  );
};