import React from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletConnection } from '../hooks/useWalletConnection';
import { Wallet, Coins, Zap } from 'lucide-react';

interface WalletConnectionProps {
  className?: string;
}

export const WalletConnection: React.FC<WalletConnectionProps> = ({ className }) => {
  const { publicKey } = useWallet();
  const { connected, connecting, solBalance, requestAirdrop } = useWalletConnection();

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const containerClassName = ['wallet-toolbar', className].filter(Boolean).join(' ');

  return (
    <div className={containerClassName}>
      {connected && publicKey ? (
        <div className="hidden items-center gap-3 rounded-2xl border border-slate-800/60 bg-slate-900/60 px-4 py-2 text-xs text-slate-200 shadow-[0_14px_30px_-24px_rgba(15,23,42,0.75)] sm:flex">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500/40 to-indigo-500/30">
              <Wallet className="h-4 w-4 text-white" />
            </span>
            <span className="text-sm font-mono font-medium text-white">
              {formatAddress(publicKey.toString())}
            </span>
          </div>
          {typeof solBalance === 'number' && (
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-amber-200">
              <Coins className="h-3.5 w-3.5" />
              {solBalance.toFixed(4)} SOL
            </span>
          )}
          <button
            onClick={requestAirdrop}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 px-3 py-1.5 text-[0.7rem] font-semibold uppercase tracking-wide text-white transition hover:shadow-[0_16px_30px_-18px_rgba(99,102,241,0.65)] focus:outline-none"
            title="Request 1 SOL airdrop (Devnet only)"
          >
            <Zap className="h-3 w-3" />
            Airdrop
          </button>
        </div>
      ) : null}

      <div className="wallet-adapter-button-trigger">
        <WalletMultiButton
          className="!text-sm !font-semibold !transition-all !duration-200 hover:!scale-[1.02]"
          style={{
            background: connected
              ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.95), rgba(6, 95, 70, 0.95)) !important'
              : 'linear-gradient(135deg, rgba(59, 130, 246, 0.95), rgba(99, 102, 241, 0.95)) !important',
            border: '1px solid rgba(148, 163, 184, 0.24) !important',
            boxShadow: connected
              ? '0 16px 35px -18px rgba(16, 185, 129, 0.45) !important'
              : '0 16px 35px -18px rgba(99, 102, 241, 0.45) !important',
            color: '#f8fafc !important'
          }}
        />
      </div>
      {connecting && (
        <span className="hidden text-[0.65rem] font-medium uppercase tracking-[0.18em] text-slate-400 sm:flex">
          Connecting…
        </span>
      )}
    </div>
  );
};
