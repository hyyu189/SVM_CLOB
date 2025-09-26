import React, { useState, useEffect } from 'react';
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
  Minus,
  AlertCircle
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

  useEffect(() => {
    if (connected && publicKey && client) {
      fetchUserAccount();
    }
  }, [connected, publicKey, client]);

  const fetchUserAccount = async () => {
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
  };

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
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <Wallet className="h-5 w-5 text-blue-500" />
          <h3 className="text-lg font-semibold">Balance Manager</h3>
        </div>
        <div className="text-center py-8">
          <p className="text-gray-400">Connect your wallet to manage balances</p>
        </div>
      </div>
    );
  }

  if (!userAccount && !loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <Wallet className="h-5 w-5 text-blue-500" />
          <h3 className="text-lg font-semibold">Balance Manager</h3>
        </div>
        <div className="text-center py-8">
          <p className="text-gray-400 mb-4">Initialize your trading account to start</p>
          <button
            onClick={initializeUserAccount}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md transition-colors"
          >
            Initialize Account
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-blue-500" />
          <h3 className="text-lg font-semibold">Balance Manager</h3>
        </div>
        <button
          onClick={fetchUserAccount}
          disabled={refreshing}
          className="p-2 text-gray-400 hover:text-white transition-colors"
        >
          <RefreshCw className={clsx('h-4 w-4', refreshing && 'animate-spin')} />
        </button>
      </div>

      {/* Account Balances */}
      <div className="mb-6">
        <h4 className="text-sm text-gray-400 mb-3">Trading Account</h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-700 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">SOL Balance</div>
            <div className="text-lg font-mono text-white">
              {userAccount ? formatBalance(userAccount.baseTokenBalance) : '0.000000'}
            </div>
          </div>
          <div className="bg-gray-700 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">USDC Balance</div>
            <div className="text-lg font-mono text-white">
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
      <div className="flex mb-4 bg-gray-700 rounded-lg p-1">
        <button
          onClick={() => setActiveTab('deposit')}
          className={clsx(
            'flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2',
            activeTab === 'deposit'
              ? 'bg-green-600 text-white'
              : 'text-gray-300 hover:text-white'
          )}
        >
          <ArrowUpCircle className="h-4 w-4" />
          Deposit
        </button>
        <button
          onClick={() => setActiveTab('withdraw')}
          className={clsx(
            'flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2',
            activeTab === 'withdraw'
              ? 'bg-red-600 text-white'
              : 'text-gray-300 hover:text-white'
          )}
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
          'w-full py-3 px-4 rounded-md text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
          activeTab === 'deposit' 
            ? 'bg-green-600 hover:bg-green-700' 
            : 'bg-red-600 hover:bg-red-700'
        )}
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