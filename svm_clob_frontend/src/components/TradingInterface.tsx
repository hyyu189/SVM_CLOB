import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useSvmClobClient } from '../hooks/useSvmClobClient';
import { useTransactionHandler } from '../hooks/useTransactionHandler';
import { PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { OrderSide, OrderType, UserAccount } from '../types/svm_clob';
import { ArrowUpDown, Calculator, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { getMatchingEngine } from '../services/matching-engine';

interface TradingInterfaceProps {
  baseMint: PublicKey;
  quoteMint: PublicKey;
  selectedPrice?: number;
}

export const TradingInterface: React.FC<TradingInterfaceProps> = ({
  baseMint,
  quoteMint,
  selectedPrice,
}) => {
  const { connected, publicKey } = useWallet();
  const client = useSvmClobClient();
  const transactionHandler = useTransactionHandler();
  
  const [side, setSide] = useState<OrderSide>(OrderSide.Bid);
  const [orderType, setOrderType] = useState<OrderType>(OrderType.Limit);
  const [price, setPrice] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('');
  const [total, setTotal] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [userAccount, setUserAccount] = useState<UserAccount | null>(null);
  const [marketPrice, setMarketPrice] = useState<number>(100);

  // Fetch user account data
  useEffect(() => {
    const fetchUserAccount = async () => {
      if (connected && publicKey && client) {
        try {
          const account = await client.getUserAccount(publicKey);
          setUserAccount(account);
        } catch (error) {
          console.error('Error fetching user account:', error);
        }
      }
    };
    
    fetchUserAccount();
  }, [connected, publicKey, client]);

  // Fetch market price
  useEffect(() => {
    const matchingEngine = getMatchingEngine();
    const updateMarketPrice = () => {
      const { bestBid, bestAsk } = matchingEngine.getBestBidAsk();
      if (bestBid && bestAsk) {
        setMarketPrice((bestBid + bestAsk) / 2);
      }
    };
    
    updateMarketPrice();
    const interval = setInterval(updateMarketPrice, 5000);
    return () => clearInterval(interval);
  }, []);

  // Update price when selected from order book
  useEffect(() => {
    if (selectedPrice) {
      setPrice(selectedPrice.toString());
    }
  }, [selectedPrice]);

  // Calculate total when price or quantity changes
  useEffect(() => {
    const priceNum = parseFloat(price) || 0;
    const quantityNum = parseFloat(quantity) || 0;
    const totalNum = priceNum * quantityNum;
    setTotal(totalNum > 0 ? totalNum.toFixed(6) : '');
  }, [price, quantity]);

  const handleSideChange = (newSide: OrderSide) => {
    setSide(newSide);
  };

  const handleOrderTypeChange = (newType: OrderType) => {
    setOrderType(newType);
    if (newType === OrderType.Market) {
      setPrice('Market Price');
    } else {
      setPrice('');
    }
  };

  const handleMaxClick = () => {
    if (!userAccount) return;
    
    if (side === OrderSide.Bid) {
      // Max buy quantity based on quote token balance and price
      const quoteBalance = userAccount.quoteTokenBalance.toNumber() / 1e6;
      const priceNum = orderType === OrderType.Market ? marketPrice : (parseFloat(price) || 0);
      if (priceNum > 0) {
        const maxQuantity = quoteBalance / priceNum;
        setQuantity(maxQuantity.toFixed(6));
      }
    } else {
      // Max sell quantity based on base token balance
      const baseBalance = userAccount.baseTokenBalance.toNumber() / 1e6;
      setQuantity(baseBalance.toFixed(6));
    }
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (orderType === OrderType.Market) return;
    setPrice(value);
  };

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuantity(e.target.value);
  };

  const handleTotalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const totalValue = e.target.value;
    setTotal(totalValue);
    
    const priceNum = parseFloat(price) || 0;
    if (priceNum > 0) {
      const quantityNum = parseFloat(totalValue) / priceNum;
      setQuantity(quantityNum > 0 ? quantityNum.toFixed(6) : '');
    }
  };

  const validateOrder = (): string | null => {
    if (!connected || !publicKey) {
      return 'Please connect your wallet';
    }

    if (orderType === OrderType.Limit && (!price || parseFloat(price) <= 0)) {
      return 'Please enter a valid price';
    }

    if (!quantity || parseFloat(quantity) <= 0) {
      return 'Please enter a valid quantity';
    }

    return null;
  };

  const handleSubmitOrder = async () => {
    const error = validateOrder();
    if (error) {
      toast.error(error);
      return;
    }

    if (!client || !publicKey || !userAccount) return;

    setLoading(true);
    try {
      // Check if user account is initialized
      if (userAccount.isInitialized !== 1) {
        toast.error('Please initialize your trading account first');
        setLoading(false);
        return;
      }

      const matchingEngine = getMatchingEngine();
      const priceNum = orderType === OrderType.Market ? marketPrice : parseFloat(price);
      const quantityNum = parseFloat(quantity);

      // Validate balance
      const totalCost = priceNum * quantityNum;
      if (side === OrderSide.Bid) {
        const quoteBalance = userAccount.quoteTokenBalance.toNumber() / 1e6;
        if (totalCost > quoteBalance) {
          toast.error('Insufficient USDC balance');
          setLoading(false);
          return;
        }
      } else {
        const baseBalance = userAccount.baseTokenBalance.toNumber() / 1e6;
        if (quantityNum > baseBalance) {
          toast.error('Insufficient SOL balance');
          setLoading(false);
          return;
        }
      }

      toast.loading('Placing order...');

      // Place order in the matching engine
      const { order, trades } = await matchingEngine.placeOrder({
        owner: publicKey,
        price: new BN(priceNum * 1e6),
        quantity: new BN(quantityNum * 1e6),
        side,
        orderType,
      });

      // If trades were executed, we would settle them on-chain here
      // For this demo, we'll just simulate the settlement
      if (trades.length > 0) {
        // In a real implementation, this would call the contract's executeTrade method
        // For now, we'll just log the trades
        console.log('Trades executed:', trades);
        toast.dismiss();
        toast.success(`Order executed! ${trades.length} trades matched`);
      } else {
        toast.dismiss();
        toast.success('Order placed successfully!');
      }

      // Reset form
      setPrice('');
      setQuantity('');
      setTotal('');

      // Refresh user account data
      const updatedAccount = await client.getUserAccount(publicKey);
      setUserAccount(updatedAccount);
      
    } catch (error) {
      toast.dismiss();
      console.error('Order submission error:', error);
      toast.error('Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  const isBuy = side === OrderSide.Bid;
  const buttonColor = isBuy ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700';

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <ArrowUpDown className="h-5 w-5 text-blue-500" />
        <h3 className="text-lg font-semibold">Place Order</h3>
      </div>

      {/* Order Side Toggle */}
      <div className="flex mb-4 bg-gray-700 rounded-lg p-1">
        <button
          onClick={() => handleSideChange(OrderSide.Bid)}
          className={clsx(
            'flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors',
            side === OrderSide.Bid
              ? 'bg-green-600 text-white'
              : 'text-gray-300 hover:text-white'
          )}
        >
          Buy
        </button>
        <button
          onClick={() => handleSideChange(OrderSide.Ask)}
          className={clsx(
            'flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors',
            side === OrderSide.Ask
              ? 'bg-red-600 text-white'
              : 'text-gray-300 hover:text-white'
          )}
        >
          Sell
        </button>
      </div>

      {/* Order Type Toggle */}
      <div className="flex mb-4 bg-gray-700 rounded-lg p-1">
        <button
          onClick={() => handleOrderTypeChange(OrderType.Limit)}
          className={clsx(
            'flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors',
            orderType === OrderType.Limit
              ? 'bg-blue-600 text-white'
              : 'text-gray-300 hover:text-white'
          )}
        >
          Limit
        </button>
        <button
          onClick={() => handleOrderTypeChange(OrderType.Market)}
          className={clsx(
            'flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors',
            orderType === OrderType.Market
              ? 'bg-blue-600 text-white'
              : 'text-gray-300 hover:text-white'
          )}
        >
          Market
        </button>
      </div>

      {/* Price Input */}
      <div className="mb-4">
        <label className="block text-sm text-gray-400 mb-1">
          Price {orderType === OrderType.Limit && '(USDC)'}
        </label>
        <input
          type="text"
          value={price}
          onChange={handlePriceChange}
          placeholder={orderType === OrderType.Market ? 'Market Price' : '0.00'}
          disabled={orderType === OrderType.Market}
          className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 disabled:opacity-50"
        />
      </div>

      {/* Quantity Input */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm text-gray-400">Quantity (SOL)</label>
          <button
            onClick={handleMaxClick}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            MAX
          </button>
        </div>
        <input
          type="text"
          value={quantity}
          onChange={handleQuantityChange}
          placeholder="0.00"
          className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Total Input */}
      <div className="mb-4">
        <label className="block text-sm text-gray-400 mb-1">Total (USDC)</label>
        <input
          type="text"
          value={total}
          onChange={handleTotalChange}
          placeholder="0.00"
          className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Order Summary */}
      {price && quantity && (
        <div className="mb-4 p-3 bg-gray-700 rounded-md">
          <div className="flex items-center gap-2 mb-2">
            <Calculator className="h-4 w-4 text-blue-400" />
            <span className="text-sm text-gray-300">Order Summary</span>
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Side:</span>
              <span className={isBuy ? 'text-green-400' : 'text-red-400'}>
                {isBuy ? 'Buy' : 'Sell'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Type:</span>
              <span className="text-gray-300">{orderType}</span>
            </div>
            {orderType === OrderType.Limit && (
              <div className="flex justify-between">
                <span className="text-gray-400">Price:</span>
                <span className="text-gray-300 font-mono">${price}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-400">Quantity:</span>
              <span className="text-gray-300 font-mono">{quantity} SOL</span>
            </div>
            <div className="flex justify-between border-t border-gray-600 pt-1">
              <span className="text-gray-400">Total:</span>
              <span className="text-white font-mono">${total}</span>
            </div>
          </div>
        </div>
      )}

      {/* Submit Button */}
      <button
        onClick={handleSubmitOrder}
        disabled={!connected || loading}
        className={clsx(
          'w-full py-3 px-4 rounded-md text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
          connected ? buttonColor : 'bg-gray-600'
        )}
      >
        {loading ? (
          <div className="flex items-center justify-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            <span>Placing Order...</span>
          </div>
        ) : connected ? (
          <div className="flex items-center justify-center gap-2">
            <Zap className="h-4 w-4" />
            <span>{isBuy ? 'Buy' : 'Sell'} {orderType === OrderType.Market ? 'Market' : 'Limit'}</span>
          </div>
        ) : (
          'Connect Wallet'
        )}
      </button>

      {/* Balance Information */}
      {connected && userAccount && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          <div className="text-sm text-gray-400 mb-2">Available Balance</div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">SOL:</span>
              <span className="text-gray-300 font-mono">
                {(userAccount.baseTokenBalance.toNumber() / 1e6).toFixed(6)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">USDC:</span>
              <span className="text-gray-300 font-mono">
                {(userAccount.quoteTokenBalance.toNumber() / 1e6).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};