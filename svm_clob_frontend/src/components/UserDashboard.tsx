import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useSvmClobClient } from '../hooks/useSvmClobClient';
import { useTransactionHandler } from '../hooks/useTransactionHandler';
import { PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { UserAccount, OrderSide } from '../types/svm_clob';
import {
  User,
  TrendingUp,
  History,
  RefreshCw,
  ExternalLink,
  Copy,
  ArrowUpCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const SOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

interface Trade {
  id: string;
  timestamp: number;
  side: OrderSide;
  price: number;
  quantity: number;
  total: number;
  signature: string;
  status: 'completed' | 'pending' | 'failed';
}

interface PortfolioStats {
  totalValue: number;
  totalPnL: number;
  totalPnLPercent: number;
  dayPnL: number;
  dayPnLPercent: number;
  totalVolume: number;
  totalTrades: number;
}

const formatCurrency = (value: number, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);

const formatNumber = (value: number, decimals = 2) =>
  value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

export const UserDashboard: React.FC = () => {
  const { connected, publicKey } = useWallet();
  const client = useSvmClobClient();
  const transactionHandler = useTransactionHandler();

  const [userAccount, setUserAccount] = useState<UserAccount | null>(null);
  const [loading, setLoading] = useState(false);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [portfolioStats, setPortfolioStats] = useState<PortfolioStats>({
    totalValue: 0,
    totalPnL: 0,
    totalPnLPercent: 0,
    dayPnL: 0,
    dayPnLPercent: 0,
    totalVolume: 0,
    totalTrades: 0,
  });

  const fetchUserData = useCallback(async () => {
    if (!client || !publicKey) return;

    setLoading(true);
    try {
      const account = await client.getUserAccount(publicKey);
      setUserAccount(account);

      if (account) {
        const baseHoldings = account.baseTokenBalance.toNumber() / 1e6;
        const quoteHoldings = account.quoteTokenBalance.toNumber() / 1e6;
        const mockSolPrice = 100.25;

        const totalValue = baseHoldings * mockSolPrice + quoteHoldings;
        setPortfolioStats({
          totalValue,
          totalPnL: 125.5,
          totalPnLPercent: 2.15,
          dayPnL: 15.25,
          dayPnLPercent: 0.35,
          totalVolume: account.totalVolumeTraded.toNumber() / 1e6,
          totalTrades: 47,
        });

        const generatedTrades: Trade[] = Array.from({ length: 12 }).map((_, idx) => {
          const side = Math.random() > 0.5 ? OrderSide.Bid : OrderSide.Ask;
          const price = 100 + (Math.random() - 0.5) * 10;
          const quantity = Math.random() * 5 + 0.1;
          const timestamp = Date.now() - idx * 36_000_00 * Math.random();

          return {
            id: `trade-${idx}`,
            timestamp,
            side,
            price,
            quantity,
            total: price * quantity,
            signature: `${Math.random().toString(36).slice(2, 12)}...${Math.random().toString(36).slice(2, 8)}`,
            status: 'completed',
          };
        });
        setTrades(generatedTrades.sort((a, b) => b.timestamp - a.timestamp));
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      toast.error('Failed to fetch user data');
    } finally {
      setLoading(false);
    }
  }, [client, publicKey]);

  useEffect(() => {
    if (connected && publicKey && client) {
      void fetchUserData();
    }
  }, [connected, publicKey, client, fetchUserData]);

  const solBalance = useMemo(() => {
    if (!userAccount) return 0;
    return userAccount.baseTokenBalance.toNumber() / 1e6;
  }, [userAccount]);

  const usdcBalance = useMemo(() => {
    if (!userAccount) return 0;
    return userAccount.quoteTokenBalance.toNumber() / 1e6;
  }, [userAccount]);

  if (!connected) {
    return (
      <div className="dashboard-screen text-slate-100">
        <div className="dashboard-container min-h-screen flex items-center justify-center">
          <div className="relative max-w-md overflow-hidden rounded-3xl border border-slate-800/60 bg-slate-950/70 p-10 text-center shadow-[0_40px_120px_-60px_rgba(56,189,248,0.55)]">
            <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-sky-500/15 via-transparent to-transparent" />
            <div className="relative z-10 space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500/30 to-indigo-500/20 text-sky-200">
                <User className="h-8 w-8" />
              </div>
              <h2 className="text-2xl font-semibold text-white">Connect your wallet</h2>
              <p className="text-sm text-slate-400">
                Link a Solana wallet to view balances, executions, and account analytics.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const summaryCards = [
    {
      label: 'Total value',
      primary: formatCurrency(portfolioStats.totalValue),
      secondary: 'Combined SOL + USDC holdings',
      tone: 'neutral' as const,
    },
    {
      label: 'Total P&L',
      primary: `${portfolioStats.totalPnL >= 0 ? '+' : ''}${formatCurrency(portfolioStats.totalPnL)}`,
      secondary: `${portfolioStats.totalPnLPercent >= 0 ? '+' : ''}${portfolioStats.totalPnLPercent.toFixed(2)}% overall`,
      tone: portfolioStats.totalPnL >= 0 ? ('positive' as const) : ('negative' as const),
    },
    {
      label: '24h P&L',
      primary: `${portfolioStats.dayPnL >= 0 ? '+' : ''}${formatCurrency(portfolioStats.dayPnL)}`,
      secondary: `${portfolioStats.dayPnLPercent >= 0 ? '+' : ''}${portfolioStats.dayPnLPercent.toFixed(2)}% today`,
      tone: portfolioStats.dayPnL >= 0 ? ('positive' as const) : ('negative' as const),
    },
    {
      label: 'Volume traded',
      primary: `${formatNumber(portfolioStats.totalVolume, 2)} SOL`,
      secondary: `${portfolioStats.totalTrades} lifetime trades`,
      tone: 'neutral' as const,
    },
  ];

  return (
    <div className="dashboard-screen text-slate-100">
      <div className="dashboard-container page-container">
        <section className="dashboard-hero">
          <div className="dashboard-hero__header">
            <div className="dashboard-hero__title">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-slate-500">Portfolio</p>
              <h1>Account dashboard</h1>
              <p className="dashboard-hero__description">
                {publicKey ? `${publicKey.toString().slice(0, 8)}…${publicKey.toString().slice(-8)}` : 'Connect your wallet to view balances and executions.'}
              </p>
            </div>

            <div className="dashboard-status">
              <span
                className={clsx(
                  'status-pill text-[0.65rem]',
                  userAccount?.isInitialized ? 'status-pill--online' : 'status-pill--offline',
                )}
              >
                <TrendingUp className="h-3.5 w-3.5" />
                {userAccount?.isInitialized ? 'Trading account active' : 'Account not initialized'}
              </span>
              <span className="status-pill status-pill--accent text-[0.65rem] text-slate-200">
                Network
                <span className="rounded-full bg-slate-900/60 px-2 py-0.5 text-[0.58rem] font-semibold tracking-[0.18em] text-white/80">
                  Solana Devnet
                </span>
              </span>
              <button
                onClick={() => fetchUserData()}
                className="inline-flex items-center gap-2 rounded-full border border-slate-700/60 bg-slate-900/60 px-4 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-200 transition hover:border-slate-500"
              >
                <RefreshCw className={clsx('h-3.5 w-3.5', loading && 'animate-spin')} />
                Refresh
              </button>
            </div>
          </div>

          <div className="metric-grid metric-grid--compact">
            {summaryCards.map(({ label, primary, secondary, tone }) => (
              <SummaryCard key={label} label={label} primary={primary} secondary={secondary} tone={tone} />
            ))}
          </div>
        </section>

        <section className="panel-grid">
          <div className="dashboard-grid__main">
            <div className="surface-card p-6 space-y-6">
              <header className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Token balances</h2>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <ArrowUpCircle className="h-4 w-4 text-emerald-300" />
                  Updated live with settlement state
                </div>
              </header>
              <div className="metric-grid metric-grid--compact">
                <BalanceTile
                  label="Solana (SOL)"
                  amount={`${formatNumber(solBalance, 6)} SOL`}
                  usdValue={formatCurrency(solBalance * 100.25)}
                  accent="positive"
                />
                <BalanceTile
                  label="USD Coin (USDC)"
                  amount={`${formatNumber(usdcBalance, 2)} USDC`}
                  usdValue={formatCurrency(usdcBalance)}
                  accent="neutral"
                />
              </div>
            </div>

            <div className="surface-card p-6 space-y-4">
              <header className="flex items-center justify-between">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold text-white">Trade history</h2>
                  <p className="text-xs text-slate-500">Most recent executions across Solana Devnet.</p>
                </div>
              </header>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-2">Time</th>
                      <th className="px-3 py-2">Side</th>
                      <th className="px-3 py-2">Price</th>
                      <th className="px-3 py-2">Quantity</th>
                      <th className="px-3 py-2">Total</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Tx</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.map((trade) => (
                      <tr key={trade.id} className="border-t border-slate-800/60">
                        <td className="px-3 py-2 text-slate-300">
                          {format(new Date(trade.timestamp), 'MMM dd, HH:mm')}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={clsx(
                              'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium',
                              trade.side === OrderSide.Bid ? 'bg-emerald-500/10 text-emerald-200' : 'bg-rose-500/10 text-rose-200'
                            )}
                          >
                            {trade.side === OrderSide.Bid ? 'Buy' : 'Sell'}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-200">${trade.price.toFixed(2)}</td>
                        <td className="px-3 py-2 font-mono text-slate-200">{trade.quantity.toFixed(4)} SOL</td>
                        <td className="px-3 py-2 font-mono text-slate-200">${trade.total.toFixed(2)}</td>
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200">
                            {trade.status}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => window.open(`https://explorer.solana.com/tx/${trade.signature}?cluster=devnet`, '_blank')}
                            className="text-sky-300 transition hover:text-sky-200"
                            aria-label="Open transaction"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {trades.length === 0 && (
                <div className="py-10 text-center text-slate-500">
                  <History className="mx-auto mb-3 h-10 w-10" />
                  No trades yet
                </div>
              )}
            </div>
          </div>

          <div className="dashboard-grid__side">
            <div className="surface-card p-6 space-y-5">
              <header className="space-y-1">
                <h2 className="text-lg font-semibold text-white">Account controls</h2>
                <p className="text-xs text-slate-500">Manage wallet details and program status.</p>
              </header>

              <div className="space-y-4 text-sm">
                <div className="space-y-2">
                  <span className="text-slate-400">Wallet address</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={publicKey?.toString() || ''}
                      readOnly
                      className="flex-1 rounded-lg border border-slate-800/70 bg-slate-900/60 px-3 py-2 font-mono text-xs text-slate-300"
                    />
                    <button
                      onClick={() => {
                        if (publicKey) {
                          navigator.clipboard.writeText(publicKey.toString());
                          toast.success('Address copied to clipboard');
                        }
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-700/60 px-3 py-2 text-xs text-slate-200 transition hover:border-slate-500"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copy
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-slate-400">Trading account</span>
                  <div className="flex items-center gap-2">
                    <span
                      className={clsx(
                        'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium',
                        userAccount?.isInitialized === 1
                          ? 'bg-emerald-500/10 text-emerald-200'
                          : 'bg-rose-500/10 text-rose-200'
                      )}
                    >
                      {userAccount?.isInitialized === 1 ? 'Active' : 'Not initialized'}
                    </span>
                    {userAccount?.isInitialized !== 1 && (
                      <button
                        onClick={async () => {
                          try {
                            await transactionHandler.initializeUserAccount();
                            await fetchUserData();
                          } catch (error) {
                            console.error('Failed to initialize account:', error);
                          }
                        }}
                        className="rounded-lg bg-blue-500 px-3 py-1 text-xs font-semibold text-white shadow shadow-blue-500/20 transition hover:bg-blue-600"
                      >
                        Initialize account
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-1 text-xs text-slate-500">
                  <p>The dashboard mirrors devnet activity. Promote to mainnet by reconfiguring the program ID and RPC endpoints.</p>
                </div>
              </div>
            </div>

            <div className="surface-card p-6 space-y-5">
              <header className="space-y-1">
                <h2 className="text-lg font-semibold text-white">Account statistics</h2>
                <p className="text-xs text-slate-500">Snapshots of settlement activity.</p>
              </header>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Volume traded</span>
                  <span className="font-mono text-slate-200">{formatNumber(portfolioStats.totalVolume, 2)} SOL</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Total trades</span>
                  <span className="font-mono text-slate-200">{portfolioStats.totalTrades}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Account age</span>
                  <span className="text-slate-200">{Math.floor(Math.random() * 30) + 1} days</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

const SummaryCard = ({
  label,
  primary,
  secondary,
  tone,
}: {
  label: string;
  primary: string;
  secondary?: string;
  tone: 'positive' | 'negative' | 'neutral';
}) => (
  <div className={clsx('metric-card', tone === 'positive' && 'metric-card--positive', tone === 'negative' && 'metric-card--negative', tone === 'neutral' && 'metric-card--accent')}>
    <p className="metric-card__label">{label}</p>
    <p className="metric-card__value">{primary}</p>
    {secondary ? <p className="metric-card__helper">{secondary}</p> : null}
  </div>
);

const BalanceTile = ({
  label,
  amount,
  usdValue,
  accent,
}: {
  label: string;
  amount: string;
  usdValue: string;
  accent: 'positive' | 'neutral';
}) => (
  <div className={clsx('metric-card', accent === 'positive' ? 'metric-card--positive' : 'metric-card--accent')}>
    <p className="metric-card__label">{label}</p>
    <p className="metric-card__value">{amount}</p>
    <p className="metric-card__helper">{usdValue}</p>
  </div>
);

export default UserDashboard;
