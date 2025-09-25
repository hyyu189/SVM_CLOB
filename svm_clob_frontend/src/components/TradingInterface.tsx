import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useSvmClobClient } from '../hooks/useSvmClobClient';
import { PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { OrderSide, OrderType } from '../types/svm_clob';
import { ArrowUpDown, Calculator, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';

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
  
  const [side, setSide] = useState<OrderSide>(OrderSide.Bid);
  const [orderType, setOrderType] = useState<OrderType>(OrderType.Limit);
  const [price, setPrice] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('');
  const [total, setTotal] = useState<string>('');
  const [loading, setLoading] = useState(false);

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
    // Mock implementation - in real app, would calculate max based on balance
    if (side === OrderSide.Bid) {
      // Max buy quantity based on quote token balance
      setQuantity('10.0'); // Mock value
    } else {
      // Max sell quantity based on base token balance
      setQuantity('5.0'); // Mock value
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

    if (!client || !publicKey) return;

    setLoading(true);
    try {
      // Mock order submission - replace with actual implementation
      toast.loading('Placing order...');
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast.dismiss();
      toast.success(`${side} order placed successfully!`);
      
      // Reset form
      setPrice('');
      setQuantity('');
      setTotal('');
      
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
      {connected && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          <div className="text-sm text-gray-400 mb-2">Available Balance</div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">SOL:</span>
              <span className="text-gray-300 font-mono">10.5000</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">USDC:</span>
              <span className="text-gray-300 font-mono">1,250.00</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};