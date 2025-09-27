import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useSvmClobClient } from '../hooks/useSvmClobClient';
import { useTransactionHandler } from '../hooks/useTransactionHandler';
import { useWalletBalances } from '../hooks/useWalletBalances';
import { PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { UserAccount } from '../types/svm_clob';
import {
  Wallet,
  ArrowUpCircle,
  ArrowDownCircle,
  RefreshCw,
  Plus,
  Minus
} from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface BalanceManagerProps {
  baseMint: PublicKey;
  quoteMint: PublicKey;
}

export const BalanceManager: React.FC<BalanceManagerProps> = ({
  baseMint,
  quoteMint,
}) => {
  const { connected, publicKey } = useWallet();
  const client = useSvmClobClient();
  const transactionHandler = useTransactionHandler();
  
  const [userAccount, setUserAccount] = useState<UserAccount | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [selectedToken, setSelectedToken] = useState<'base' | 'quote'>('base');

  // Fetch real wallet balances
  const walletBalances = useWalletBalances(baseMint, quoteMint);

  const fetchUserAccount = useCallback(async () => {
    if (!client || !publicKey) return;

    setRefreshing(true);
    try {
      const account = await client.getUserAccount(publicKey);
      setUserAccount(account);
      
      if (!account) {
        // User account doesn't exist yet
        console.log('User account not found - needs initialization');
      }
    } catch (error) {
      console.error('Error fetching user account:', error);
      toast.error('Failed to fetch account data');
    } finally {
      setRefreshing(false);
    }
  }, [client, publicKey]);

  useEffect(() => {
    if (connected && publicKey && client) {
      void fetchUserAccount();
    }
  }, [connected, publicKey, client, fetchUserAccount]);

  const initializeUserAccount = async () => {
    if (!transactionHandler || !publicKey) return;

    setLoading(true);
    try {
      await transactionHandler.initializeUserAccount();
      // Refresh account data after successful initialization
      await fetchUserAccount();
    } catch (error) {
      console.error('Error initializing account:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeposit = async () => {
    if (!transactionHandler || !publicKey || !depositAmount) return;

    const amount = parseFloat(depositAmount);
    if (amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setLoading(true);
    try {
      const tokenMint = selectedToken === 'base' ? baseMint : quoteMint;
      const amountBN = new BN(amount * Math.pow(10, 6)); // Convert to lamports/micro units
      
      const signature = await transactionHandler.deposit({
        tokenMint,
        baseMint,
        quoteMint,
        amount: amountBN,
      });

      if (signature) {
        setDepositAmount('');
        await fetchUserAccount();
        // Refresh wallet balances
        await walletBalances.refresh();
      }
    } catch (error) {
      console.error('Error depositing:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!transactionHandler || !publicKey || !withdrawAmount) return;

    const amount = parseFloat(withdrawAmount);
    if (amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setLoading(true);
    try {
      const tokenMint = selectedToken === 'base' ? baseMint : quoteMint;
      const amountBN = new BN(amount * Math.pow(10, 6)); // Convert to lamports/micro units
      
      const signature = await transactionHandler.withdraw({
        tokenMint,
        baseMint,
        quoteMint,
        amount: amountBN,
      });

      if (signature) {
        setWithdrawAmount('');
        await fetchUserAccount();
        // Refresh wallet balances
        await walletBalances.refresh();
      }
    } catch (error) {
      console.error('Error withdrawing:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatBalance = (balance: BN | number, decimals = 6): string => {
    if (typeof balance === 'number') {
      return balance.toFixed(decimals);
    }
    return (balance.toNumber() / Math.pow(10, decimals)).toFixed(decimals);
  };

  const getMaxAmount = () => {
    if (activeTab === 'deposit') {
      return selectedToken === 'base' ? walletBalances.sol : walletBalances.usdc;
    } else {
      if (!userAccount) return 0;
      return selectedToken === 'base' 
        ? formatBalance(userAccount.baseTokenBalance) 
        : formatBalance(userAccount.quoteTokenBalance);
    }
  };

  if (!connected) {
    return (
      <div className="surface-card p-6 space-y-6 text-slate-100">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/15 text-blue-200">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-xl font-semibold">Balance manager</h3>
            <p className="text-sm text-slate-400">Manage your trading funds</p>
          </div>
        </div>
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/50 p-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-800/60 text-slate-300">
            <Wallet className="h-8 w-8" />
          </div>
          <p className="text-lg font-medium">Wallet not connected</p>
          <p className="mt-1 text-sm text-slate-400">Connect your wallet to manage trading balances.</p>
        </div>
      </div>
    );
  }

  if (!userAccount && !loading) {
    return (
      <div className="surface-card p-6 space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/15 text-blue-200">
          <Wallet className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Balance manager</h3>
          <p className="text-sm text-slate-400 mt-1">Initialize your trading account to start depositing assets.</p>
        </div>
        <button
          onClick={initializeUserAccount}
          className="inline-flex items-center justify-center rounded-lg bg-blue-500 px-6 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-600"
        >
          Initialize account
        </button>
      </div>
    );
  }

  return (
    <div className="surface-card p-6 space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'var(--color-primary)' }}>
            <Wallet className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-semibold">Balance Manager</h3>
            <div className="text-sm flex items-center gap-2">
              <div className="w-1 h-1 rounded-full" style={{ background: 'var(--color-buy)' }}></div>
              <span style={{ color: 'var(--text-tertiary)' }}>Active</span>
            </div>
          </div>
        </div>
        <button
          onClick={fetchUserAccount}
          disabled={refreshing}
          className="p-2 rounded-lg transition-all hover:scale-110"
          style={{ color: 'var(--text-tertiary)', background: 'var(--bg-tertiary)' }}
        >
          <RefreshCw className={clsx('h-5 w-5', refreshing && 'animate-spin')} />
        </button>
      </div>

      {/* Account Balances */}
      <div className="mb-8">
        <h4 className="text-sm font-medium mb-4" style={{ color: 'var(--text-secondary)' }}>Trading Account</h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: '#f97316', color: 'white' }}>S</div>
              <div className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>SOL Balance</div>
            </div>
            <div className="text-2xl font-mono font-bold" style={{ color: '#f97316' }}>
              {userAccount ? formatBalance(userAccount.baseTokenBalance) : '0.000000'}
            </div>
          </div>
          <div className="p-4 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: '#2563eb', color: 'white' }}>U</div>
              <div className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>USDC Balance</div>
            </div>
            <div className="text-2xl font-mono font-bold" style={{ color: '#2563eb' }}>
              {userAccount ? formatBalance(userAccount.quoteTokenBalance) : '0.000000'}
            </div>
          </div>
        </div>
      </div>

      {/* Wallet Balances */}
      <div className="mb-6">
        <h4 className="text-sm text-gray-400 mb-3">Wallet Balance</h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-700 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">SOL</div>
            <div className="text-lg font-mono text-white">
              {walletBalances.sol.toFixed(6)}
            </div>
          </div>
          <div className="bg-gray-700 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">USDC</div>
            <div className="text-lg font-mono text-white">
              {walletBalances.usdc.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Deposit/Withdraw Tabs */}
      <div className="flex mb-6 rounded-xl p-1" style={{ background: 'var(--bg-tertiary)' }}>
        <button
          onClick={() => setActiveTab('deposit')}
          className={clsx(
            'flex-1 py-3 px-4 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2',
            activeTab === 'deposit'
              ? 'text-white shadow-lg'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          )}
          style={activeTab === 'deposit' ? {
            background: 'linear-gradient(135deg, var(--color-buy), #059669)',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
          } : {}}
        >
          <ArrowUpCircle className="h-4 w-4" />
          Deposit
        </button>
        <button
          onClick={() => setActiveTab('withdraw')}
          className={clsx(
            'flex-1 py-3 px-4 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2',
            activeTab === 'withdraw'
              ? 'text-white shadow-lg'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          )}
          style={activeTab === 'withdraw' ? {
            background: 'linear-gradient(135deg, var(--color-sell), #dc2626)',
            boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
          } : {}}
        >
          <ArrowDownCircle className="h-4 w-4" />
          Withdraw
        </button>
      </div>

      {/* Token Selection */}
      <div className="flex mb-4 bg-gray-700 rounded-lg p-1">
        <button
          onClick={() => setSelectedToken('base')}
          className={clsx(
            'flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors',
            selectedToken === 'base'
              ? 'bg-blue-600 text-white'
              : 'text-gray-300 hover:text-white'
          )}
        >
          SOL
        </button>
        <button
          onClick={() => setSelectedToken('quote')}
          className={clsx(
            'flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors',
            selectedToken === 'quote'
              ? 'bg-blue-600 text-white'
              : 'text-gray-300 hover:text-white'
          )}
        >
          USDC
        </button>
      </div>

      {/* Amount Input */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm text-gray-400">
            Amount ({selectedToken === 'base' ? 'SOL' : 'USDC'})
          </label>
          <button
            onClick={() => {
              const max = getMaxAmount();
              if (activeTab === 'deposit') {
                setDepositAmount(max.toString());
              } else {
                setWithdrawAmount(max.toString());
              }
            }}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            MAX: {getMaxAmount()}
          </button>
        </div>
        <input
          type="text"
          value={activeTab === 'deposit' ? depositAmount : withdrawAmount}
          onChange={(e) => {
            if (activeTab === 'deposit') {
              setDepositAmount(e.target.value);
            } else {
              setWithdrawAmount(e.target.value);
            }
          }}
          placeholder="0.00"
          className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Action Button */}
      <button
        onClick={activeTab === 'deposit' ? handleDeposit : handleWithdraw}
        disabled={loading || (!depositAmount && !withdrawAmount)}
        className={clsx(
          'w-full py-4 px-6 rounded-xl text-white font-semibold text-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]',
          activeTab === 'deposit'
            ? 'shadow-lg hover:shadow-xl'
            : 'shadow-lg hover:shadow-xl'
        )}
        style={!loading && (depositAmount || withdrawAmount) ? {
          background: activeTab === 'deposit'
            ? 'linear-gradient(135deg, var(--color-buy), #059669)'
            : 'linear-gradient(135deg, var(--color-sell), #dc2626)',
          boxShadow: activeTab === 'deposit'
            ? '0 4px 20px rgba(16, 185, 129, 0.4)'
            : '0 4px 20px rgba(239, 68, 68, 0.4)'
        } : { background: 'var(--bg-accent)' }}
      >
        {loading ? (
          <div className="flex items-center justify-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            <span>Processing...</span>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2">
            {activeTab === 'deposit' ? (
              <Plus className="h-4 w-4" />
            ) : (
              <Minus className="h-4 w-4" />
            )}
            <span>
              {activeTab === 'deposit' ? 'Deposit' : 'Withdraw'} {selectedToken === 'base' ? 'SOL' : 'USDC'}
            </span>
          </div>
        )}
      </button>

      {/* Account Stats */}
      {userAccount && (
        <div className="mt-6 pt-4 border-t border-gray-700">
          <div className="text-sm text-gray-400 mb-2">Account Statistics</div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Total Volume Traded:</span>
              <span className="text-gray-300 font-mono">
                {formatBalance(userAccount.totalVolumeTraded)} SOL
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Account Status:</span>
              <span className="text-green-400">Active</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
