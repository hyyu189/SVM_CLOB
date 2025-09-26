import React from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletConnection } from '../hooks/useWalletConnection';
import { Wallet, Coins, Zap } from 'lucide-react';

export const WalletConnection: React.FC = () => {
  const { publicKey } = useWallet();
  const { connected, connecting, solBalance, requestAirdrop } = useWalletConnection();

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  return (
    <div className="flex items-center gap-4">
      {connected && publicKey && (
        <div className="flex items-center gap-3 card-glass px-4 py-2 rounded-xl" style={{ border: '1px solid var(--border-accent)' }}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'var(--color-primary)' }}>
              <Wallet className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-mono font-medium">
              {formatAddress(publicKey.toString())}
            </span>
          </div>
          {solBalance !== null && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
              <Coins className="h-4 w-4" style={{ color: '#f59e0b' }} />
              <span className="text-sm font-mono font-medium">
                {solBalance.toFixed(4)} SOL
              </span>
            </div>
          )}
          <button
            onClick={requestAirdrop}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105"
            style={{
              background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
              color: 'white',
              boxShadow: '0 2px 8px rgba(139, 92, 246, 0.3)'
            }}
            title="Request 1 SOL airdrop (devnet only)"
          >
            <Zap className="h-3 w-3" />
            Airdrop
          </button>
        </div>
      )}
      
      <div className="wallet-adapter-button-trigger">
        <WalletMultiButton
          className="!rounded-xl !px-6 !py-3 !text-sm !font-semibold !transition-all !duration-200 hover:!scale-105"
          style={{
            background: connected
              ? 'linear-gradient(135deg, #10b981, #059669) !important'
              : 'linear-gradient(135deg, #3b82f6, #2563eb) !important',
            border: 'none !important',
            boxShadow: connected
              ? '0 4px 12px rgba(16, 185, 129, 0.3) !important'
              : '0 4px 12px rgba(59, 130, 246, 0.3) !important',
            color: 'white !important'
          }}
        />
      </div>
    </div>
  );
};