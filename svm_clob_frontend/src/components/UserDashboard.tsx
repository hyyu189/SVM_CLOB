import React, { useState, useEffect } from 'react';
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
  Wallet,
  Activity,
  BarChart3,
  Settings,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import clsx from 'clsx';

// Mock mint addresses
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

export const UserDashboard: React.FC = () => {
  const { connected, publicKey } = useWallet();
  const client = useSvmClobClient();
  const transactionHandler = useTransactionHandler();
  
  const [userAccount, setUserAccount] = useState<UserAccount | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'portfolio' | 'history' | 'settings'>('portfolio');
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

  useEffect(() => {
    if (connected && publicKey && client) {
      fetchUserData();
    }
  }, [connected, publicKey, client]);

  const fetchUserData = async () => {
    if (!client || !publicKey) return;

    setLoading(true);
    try {
      const account = await client.getUserAccount(publicKey);
      setUserAccount(account);
      
      if (account) {
        // Calculate portfolio stats
        const baseValue = account.baseTokenBalance.toNumber() / Math.pow(10, 6) * 100.25; // Mock SOL price
        const quoteValue = account.quoteTokenBalance.toNumber() / Math.pow(10, 6);
        const totalValue = baseValue + quoteValue;
        
        setPortfolioStats({
          totalValue,
          totalPnL: 125.50, // Mock data
          totalPnLPercent: 2.15,
          dayPnL: 15.25,
          dayPnLPercent: 0.35,
          totalVolume: account.totalVolumeTraded.toNumber() / Math.pow(10, 6),
          totalTrades: 47, // Mock data
        });

        // Generate mock trade history
        generateMockTrades();
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      toast.error('Failed to fetch user data');
    } finally {
      setLoading(false);
    }
  };

  const generateMockTrades = () => {
    const mockTrades: Trade[] = [];
    for (let i = 0; i < 10; i++) {
      const side = Math.random() > 0.5 ? OrderSide.Bid : OrderSide.Ask;
      const price = 100 + (Math.random() - 0.5) * 10;
      const quantity = Math.random() * 5 + 0.1;
      const timestamp = Date.now() - i * 1000 * 60 * 60 * Math.random() * 24;
      
      mockTrades.push({
        id: `trade-${i}`,
        timestamp,
        side,
        price,
        quantity,
        total: price * quantity,
        signature: `${Math.random().toString(36).substring(2, 15)}...${Math.random().toString(36).substring(2, 8)}`,
        status: 'completed',
      });
    }
    setTrades(mockTrades.sort((a, b) => b.timestamp - a.timestamp));
  };

  const formatBalance = (balance: BN, decimals = 6): string => {
    return (balance.toNumber() / Math.pow(10, decimals)).toFixed(decimals);
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const PortfolioView = () => (
    <div className="space-y-6">
      {/* Portfolio Overview */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold">Portfolio Overview</h3>
          <button
            onClick={fetchUserData}
            disabled={loading}
            className="p-2 text-gray-400 hover:text-white transition-colors"
          >
            <RefreshCw className={clsx('h-5 w-5', loading && 'animate-spin')} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Total Value</div>
            <div className="text-2xl font-bold text-white">
              {formatCurrency(portfolioStats.totalValue)}
            </div>
          </div>
          
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Total P&L</div>
            <div className={clsx(
              'text-2xl font-bold',
              portfolioStats.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'
            )}>
              {portfolioStats.totalPnL >= 0 ? '+' : ''}{formatCurrency(portfolioStats.totalPnL)}
            </div>
            <div className={clsx(
              'text-sm',
              portfolioStats.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'
            )}>
              {portfolioStats.totalPnLPercent >= 0 ? '+' : ''}{portfolioStats.totalPnLPercent.toFixed(2)}%
            </div>
          </div>
          
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">24h P&L</div>
            <div className={clsx(
              'text-2xl font-bold',
              portfolioStats.dayPnL >= 0 ? 'text-green-400' : 'text-red-400'
            )}>
              {portfolioStats.dayPnL >= 0 ? '+' : ''}{formatCurrency(portfolioStats.dayPnL)}
            </div>
            <div className={clsx(
              'text-sm',
              portfolioStats.dayPnL >= 0 ? 'text-green-400' : 'text-red-400'
            )}>
              {portfolioStats.dayPnLPercent >= 0 ? '+' : ''}{portfolioStats.dayPnLPercent.toFixed(2)}%
            </div>
          </div>
          
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Total Volume</div>
            <div className="text-2xl font-bold text-white">
              {portfolioStats.totalVolume.toFixed(2)} SOL
            </div>
            <div className="text-sm text-gray-400">
              {portfolioStats.totalTrades} trades
            </div>
          </div>
        </div>

        {/* Token Balances */}
        {userAccount && (
          <div>
            <h4 className="text-lg font-semibold mb-4">Token Balances</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400">Solana (SOL)</span>
                  <span className="text-sm text-gray-400">$100.25</span>
                </div>
                <div className="text-xl font-bold text-white">
                  {formatBalance(userAccount.baseTokenBalance)} SOL
                </div>
                <div className="text-sm text-gray-400">
                  ≈ {formatCurrency(parseFloat(formatBalance(userAccount.baseTokenBalance)) * 100.25)}
                </div>
              </div>
              
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400">USD Coin (USDC)</span>
                  <span className="text-sm text-gray-400">$1.00</span>
                </div>
                <div className="text-xl font-bold text-white">
                  {formatBalance(userAccount.quoteTokenBalance)} USDC
                </div>
                <div className="text-sm text-gray-400">
                  ≈ {formatCurrency(parseFloat(formatBalance(userAccount.quoteTokenBalance)))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Performance Chart Placeholder */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Performance Chart</h3>
        <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-600 rounded-lg">
          <div className="text-center">
            <BarChart3 className="h-12 w-12 text-gray-500 mx-auto mb-2" />
            <p className="text-gray-400">Portfolio Performance Chart</p>
            <p className="text-gray-500 text-sm">Integrate with charting library</p>
          </div>
        </div>
      </div>
    </div>
  );

  const TradeHistoryView = () => (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold">Trade History</h3>
        <div className="flex items-center gap-2">
          <select className="bg-gray-700 border border-gray-600 rounded-md px-3 py-1 text-white text-sm">
            <option>All Trades</option>
            <option>Buy Orders</option>
            <option>Sell Orders</option>
          </select>
          <select className="bg-gray-700 border border-gray-600 rounded-md px-3 py-1 text-white text-sm">
            <option>Last 30 days</option>
            <option>Last 7 days</option>
            <option>Last 24 hours</option>
          </select>
        </div>
      </div>

      {/* Trade History Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-3 px-4 text-gray-400 font-medium">Time</th>
              <th className="text-left py-3 px-4 text-gray-400 font-medium">Side</th>
              <th className="text-left py-3 px-4 text-gray-400 font-medium">Price</th>
              <th className="text-left py-3 px-4 text-gray-400 font-medium">Quantity</th>
              <th className="text-left py-3 px-4 text-gray-400 font-medium">Total</th>
              <th className="text-left py-3 px-4 text-gray-400 font-medium">Status</th>
              <th className="text-left py-3 px-4 text-gray-400 font-medium">Tx</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((trade) => (
              <tr key={trade.id} className="border-b border-gray-700/50 hover:bg-gray-700/50">
                <td className="py-3 px-4 text-sm text-gray-300">
                  {format(new Date(trade.timestamp), 'MMM dd, HH:mm')}
                </td>
                <td className="py-3 px-4">
                  <span className={clsx(
                    'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
                    trade.side === OrderSide.Bid
                      ? 'bg-green-900 text-green-200'
                      : 'bg-red-900 text-red-200'
                  )}>
                    {trade.side === OrderSide.Bid ? 'Buy' : 'Sell'}
                  </span>
                </td>
                <td className="py-3 px-4 text-sm font-mono text-white">
                  ${trade.price.toFixed(2)}
                </td>
                <td className="py-3 px-4 text-sm font-mono text-gray-300">
                  {trade.quantity.toFixed(4)} SOL
                </td>
                <td className="py-3 px-4 text-sm font-mono text-white">
                  ${trade.total.toFixed(2)}
                </td>
                <td className="py-3 px-4">
                  <span className={clsx(
                    'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
                    trade.status === 'completed' ? 'bg-green-900 text-green-200' :
                    trade.status === 'pending' ? 'bg-yellow-900 text-yellow-200' :
                    'bg-red-900 text-red-200'
                  )}>
                    {trade.status}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <button
                    className="text-blue-400 hover:text-blue-300 transition-colors"
                    onClick={() => window.open(`https://explorer.solana.com/tx/${trade.signature}?cluster=devnet`, '_blank')}
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
        <div className="text-center py-12">
          <History className="h-12 w-12 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">No trades yet</p>
          <p className="text-gray-500">Your trade history will appear here</p>
        </div>
      )}
    </div>
  );

  const SettingsView = () => (
    <div className="space-y-6">
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-xl font-semibold mb-4">Account Settings</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Wallet Address
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={publicKey?.toString() || ''}
                disabled
                className="flex-1 bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white font-mono text-sm"
              />
              <button
                onClick={() => {
                  if (publicKey) {
                    navigator.clipboard.writeText(publicKey.toString());
                    toast.success('Address copied to clipboard');
                  }
                }}
                className="bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-md text-white text-sm transition-colors"
              >
                Copy
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Trading Account Status
            </label>
            <div className="flex items-center gap-2">
              <span className={clsx(
                'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium',
                userAccount?.isInitialized === 1 
                  ? 'bg-green-900 text-green-200'
                  : 'bg-red-900 text-red-200'
              )}>
                {userAccount?.isInitialized === 1 ? 'Active' : 'Not Initialized'}
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
                  className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded-md text-white text-sm transition-colors"
                >
                  Initialize Account
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Network
            </label>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-900 text-purple-200">
              Solana Devnet
            </span>
          </div>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-xl font-semibold mb-4">Account Statistics</h3>
        
        {userAccount && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-400 mb-1">Total Volume Traded</div>
              <div className="text-lg font-mono text-white">
                {formatBalance(userAccount.totalVolumeTraded)} SOL
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-400 mb-1">Account Age</div>
              <div className="text-lg text-white">
                {Math.floor(Math.random() * 30) + 1} days
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-400 mb-1">Total Trades</div>
              <div className="text-lg text-white">
                {portfolioStats.totalTrades}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-400 mb-1">Win Rate</div>
              <div className="text-lg text-green-400">
                {(Math.random() * 20 + 60).toFixed(1)}%
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (!connected) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <User className="h-16 w-16 text-gray-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
          <p className="text-gray-400">Please connect your wallet to view your dashboard</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <User className="h-8 w-8 text-blue-500" />
              <div>
                <h1 className="text-2xl font-bold">User Dashboard</h1>
                <p className="text-gray-400 text-sm">
                  {publicKey && `${publicKey.toString().slice(0, 8)}...${publicKey.toString().slice(-8)}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Network:</span>
              <span className="bg-purple-600 px-2 py-1 rounded text-xs">DEVNET</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4">
          <nav className="flex space-x-8">
            {[
              { id: 'portfolio', label: 'Portfolio', icon: TrendingUp },
              { id: 'history', label: 'Trade History', icon: History },
              { id: 'settings', label: 'Settings', icon: Settings },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id as any)}
                className={clsx(
                  'flex items-center gap-2 py-4 px-2 border-b-2 font-medium text-sm transition-colors',
                  activeTab === id
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-gray-400 hover:text-gray-300'
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-4">
        {activeTab === 'portfolio' && <PortfolioView />}
        {activeTab === 'history' && <TradeHistoryView />}
        {activeTab === 'settings' && <SettingsView />}
      </div>
    </div>
  );
};