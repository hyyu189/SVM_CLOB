import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useSvmClobClient } from '../hooks/useSvmClobClient';
import { usePlaceOrder, PlaceOrderParams } from '../hooks/usePlaceOrder';
import { useOrderBook } from '../hooks/useOrderBook';
import { PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { UserAccount } from '../types/svm_clob';
import { OrderSide, OrderType } from '../services/api-types';
import {
  ArrowUpDown,
  Calculator,
  Zap,
  AlertTriangle,
  CheckCircle,
  X,
  TrendingUp,
  TrendingDown,
  DollarSign
} from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface TradingInterfaceProps {
  baseMint: PublicKey;
  quoteMint: PublicKey;
  selectedPrice?: number;
}

interface OrderValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

interface OrderConfirmation {
  show: boolean;
  orderDetails: {
    side: 'Bid' | 'Ask';
    orderType: 'Limit' | 'Market' | 'PostOnly';
    price: number;
    quantity: number;
    total: number;
    estimatedFees: number;
    priceImpact?: number;
    slippage?: number;
  } | null;
}

export const TradingInterface: React.FC<TradingInterfaceProps> = ({
  baseMint,
  quoteMint,
  selectedPrice,
}) => {
  const { connected, publicKey } = useWallet();
  const client = useSvmClobClient();
  
  // Use enhanced hooks for off-chain API integration
  const { orderBook, marketStats, connected: wsConnected } = useOrderBook(baseMint, quoteMint);
  const { placeOrder, isLoading: placingOrder } = usePlaceOrder(baseMint, quoteMint);
  
  const [side, setSide] = useState<OrderSide>('Bid');
  const [orderType, setOrderType] = useState<OrderType>('Limit');
  const [price, setPrice] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('');
  const [total, setTotal] = useState<string>('');
  const [userAccount, setUserAccount] = useState<UserAccount | null>(null);
  const [validation, setValidation] = useState<OrderValidation>({ isValid: false, errors: [], warnings: [] });
  const [confirmation, setConfirmation] = useState<OrderConfirmation>({ show: false, orderDetails: null });
  const [slippageTolerance, setSlippageTolerance] = useState<number>(0.5);

  // Advanced order options
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [postOnly, setPostOnly] = useState(false);
  const [reduceOnly, setReduceOnly] = useState(false);

  // Market price from order book or market stats
  const marketPrice = marketStats?.last_price || orderBook.lastPrice || 100;

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

  // Market price is now derived from order book data

  // Update price when selected from order book
  useEffect(() => {
    if (selectedPrice) {
      setPrice(selectedPrice.toString());
    }
  }, [selectedPrice]);

  // Calculate total when price or quantity changes
  useEffect(() => {
    const priceNum = orderType === 'Market' ? marketPrice : parseFloat(price) || 0;
    const quantityNum = parseFloat(quantity) || 0;
    const totalNum = priceNum * quantityNum;
    setTotal(totalNum > 0 ? totalNum.toFixed(6) : '');
  }, [price, quantity, orderType, marketPrice]);

  // Validate order in real-time
  useEffect(() => {
    const validateOrderRealTime = (): OrderValidation => {
      const errors: string[] = [];
      const warnings: string[] = [];

      if (!connected || !publicKey) {
        errors.push('Please connect your wallet');
        return { isValid: false, errors, warnings };
      }

      if (!userAccount || userAccount.isInitialized !== 1) {
        errors.push('Please initialize your trading account first');
        return { isValid: false, errors, warnings };
      }

      // Price validation for limit orders
      if (orderType === 'Limit') {
        const priceNum = parseFloat(price);
        if (!price || priceNum <= 0) {
          errors.push('Please enter a valid price');
        } else {
          // Check if price is reasonable compared to market price
          const deviation = Math.abs(priceNum - marketPrice) / marketPrice;
          if (deviation > 0.1) { // 10% deviation
            warnings.push(`Price is ${(deviation * 100).toFixed(1)}% away from market price`);
          }
        }
      }

      // Quantity validation
      const quantityNum = parseFloat(quantity);
      if (!quantity || quantityNum <= 0) {
        errors.push('Please enter a valid quantity');
      } else {
        // Check minimum order size (0.001 SOL)
        if (quantityNum < 0.001) {
          errors.push('Minimum order size is 0.001 SOL');
        }
      }

      // Balance validation
      if (price && quantity && userAccount) {
        const priceNum = orderType === 'Market' ? marketPrice : parseFloat(price);
        const totalCost = priceNum * quantityNum;

        if (side === 'Bid') {
          const quoteBalance = userAccount.quoteTokenBalance.toNumber() / 1e6;
          if (totalCost > quoteBalance) {
            errors.push('Insufficient USDC balance');
          } else if (totalCost > quoteBalance * 0.95) {
            warnings.push('Using more than 95% of available balance');
          }
        } else {
          const baseBalance = userAccount.baseTokenBalance.toNumber() / 1e6;
          if (quantityNum > baseBalance) {
            errors.push('Insufficient SOL balance');
          } else if (quantityNum > baseBalance * 0.95) {
            warnings.push('Using more than 95% of available balance');
          }
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings
      };
    };

    setValidation(validateOrderRealTime());
  }, [connected, publicKey, userAccount, orderType, price, quantity, side, marketPrice]);

  const handleSideChange = (newSide: OrderSide) => {
    setSide(newSide);
    // Clear form when switching sides
    setPrice('');
    setQuantity('');
    setTotal('');
  };

  const handleOrderTypeChange = (newType: OrderType) => {
    setOrderType(newType);
    if (newType === 'Market') {
      // Clear price for market orders
      setPrice('');
    } else {
      // Set default price for limit orders
      if (!price) {
        const bestBid = orderBook.bestBid;
        const bestAsk = orderBook.bestAsk;
        const defaultPrice = side === 'Bid' 
          ? (bestBid || marketPrice * 0.99) 
          : (bestAsk || marketPrice * 1.01);
        setPrice(defaultPrice.toFixed(2));
      }
    }
  };

  const handleMaxClick = () => {
    if (!userAccount) return;

    if (side === 'Bid') {
      // Max buy quantity based on quote token balance and price
      const quoteBalance = userAccount.quoteTokenBalance.toNumber() / 1e6;
      const priceNum = orderType === 'Market' ? marketPrice : (parseFloat(price) || marketPrice);
      if (priceNum > 0) {
        const maxQuantity = (quoteBalance * 0.99) / priceNum; // Leave 1% buffer
        setQuantity(maxQuantity.toFixed(6));
      }
    } else {
      // Max sell quantity based on base token balance
      const baseBalance = userAccount.baseTokenBalance.toNumber() / 1e6;
      setQuantity((baseBalance * 0.99).toFixed(6)); // Leave 1% buffer
    }
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (orderType === 'Market') return;

    // Allow only numbers and decimal point
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setPrice(value);
    }
  };

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Allow only numbers and decimal point
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setQuantity(value);
    }
  };

  const handleTotalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const totalValue = e.target.value;
    
    // Allow only numbers and decimal point
    if (totalValue === '' || /^\d*\.?\d*$/.test(totalValue)) {
      setTotal(totalValue);

      const priceNum = orderType === 'Market' ? marketPrice : parseFloat(price) || 0;
      if (priceNum > 0) {
        const quantityNum = parseFloat(totalValue) / priceNum;
        setQuantity(quantityNum > 0 ? quantityNum.toFixed(6) : '');
      }
    }
  };

  const calculateEstimatedFees = (total: number): number => {
    // Estimated trading fee: 0.1% for takers, 0.05% for makers
    const feeRate = orderType === 'Market' ? 0.001 : 0.0005;
    return total * feeRate;
  };

  const calculatePriceImpact = (): number => {
    if (orderType !== 'Market' || !quantity) return 0;
    
    // Simple price impact estimation based on order size
    const quantityNum = parseFloat(quantity);
    const impact = Math.min(quantityNum / 100, 0.05); // Max 5% impact
    return impact * 100; // Return as percentage
  };

  const showOrderConfirmation = () => {
    if (!validation.isValid) {
      toast.error(validation.errors[0]);
      return;
    }

    const priceNum = orderType === 'Market' ? marketPrice : parseFloat(price);
    const quantityNum = parseFloat(quantity);
    const totalNum = priceNum * quantityNum;
    const estimatedFees = calculateEstimatedFees(totalNum);
    const priceImpact = calculatePriceImpact();

    setConfirmation({
      show: true,
      orderDetails: {
        side,
        orderType,
        price: priceNum,
        quantity: quantityNum,
        total: totalNum,
        estimatedFees,
        priceImpact: orderType === 'Market' ? priceImpact : undefined,
        slippage: orderType === 'Market' ? slippageTolerance : undefined,
      }
    });
  };

  const confirmOrder = async () => {
    if (!confirmation.orderDetails || !client || !publicKey) return;

    setConfirmation({ show: false, orderDetails: null });

    try {
      const { orderDetails } = confirmation;

      // Use the enhanced placeOrder hook with off-chain API integration
      const orderParams: PlaceOrderParams = {
        side: orderDetails.side,
        orderType: orderDetails.orderType,
        price: orderDetails.price,
        quantity: orderDetails.quantity,
        selfTradeBehavior: 'DecrementAndCancel',
      };

      toast.loading('Placing order...');

      const result = await placeOrder(orderParams);

      toast.dismiss();
      
      if (result.userAccountInitialized) {
        toast.success('User account initialized and order placed!');
      } else {
        toast.success('Order placed successfully!');
      }

      console.log('Order result:', result);

      // Reset form
      setPrice('');
      setQuantity('');
      setTotal('');

      // Refresh user account data
      if (client && publicKey) {
        const updatedAccount = await client.getUserAccount(publicKey);
        setUserAccount(updatedAccount);
      }
      
    } catch (error) {
      toast.dismiss();
      console.error('Order submission error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to place order');
    }
  };

  const isBuy = side === 'Bid';
  return (
    <>
      <div className="surface-card p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'var(--color-primary)' }}>
              <ArrowUpDown className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-semibold">Place Order</h3>
              <div className="text-sm" style={{ color: 'var(--text-tertiary)' }}>SOL/USDC</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {wsConnected ? (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ background: 'var(--color-buy)' }}></div>
                <span>Live</span>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ background: 'var(--color-sell)' }}></div>
                <span>Offline</span>
              </div>
            )}
          </div>
        </div>

        {/* Order Side Toggle */}
        <div className="flex mb-6 rounded-xl p-1" style={{ background: 'var(--bg-tertiary)' }}>
          <button
            onClick={() => handleSideChange('Bid')}
            className={clsx(
              'flex-1 py-3 px-4 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2',
              side === 'Bid'
                ? 'text-white shadow-lg'
                : 'text-gray-300 hover:text-white hover:bg-white/5'
            )}
            style={side === 'Bid' ? {
              background: 'linear-gradient(135deg, var(--color-buy), #059669)',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
            } : {}}
          >
            <TrendingUp className="h-4 w-4" />
            Buy SOL
          </button>
          <button
            onClick={() => handleSideChange('Ask')}
            className={clsx(
              'flex-1 py-3 px-4 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2',
              side === 'Ask'
                ? 'text-white shadow-lg'
                : 'text-gray-300 hover:text-white hover:bg-white/5'
            )}
            style={side === 'Ask' ? {
              background: 'linear-gradient(135deg, var(--color-sell), #dc2626)',
              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
            } : {}}
          >
            <TrendingDown className="h-4 w-4" />
            Sell SOL
          </button>
        </div>

        {/* Order Type Toggle */}
        <div className="flex mb-6 rounded-xl p-1" style={{ background: 'var(--bg-tertiary)' }}>
          <button
            onClick={() => handleOrderTypeChange('Limit')}
            className={clsx(
              'flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all',
              orderType === 'Limit'
                ? 'text-white shadow-md'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            )}
            style={orderType === 'Limit' ? {
              background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))',
            } : {}}
          >
            Limit Order
          </button>
          <button
            onClick={() => handleOrderTypeChange('Market')}
            className={clsx(
              'flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all',
              orderType === 'Market'
                ? 'text-white shadow-md'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            )}
            style={orderType === 'Market' ? {
              background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))',
            } : {}}
          >
            Market Order
          </button>
        </div>

        {/* Price Input */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              Price {orderType === 'Limit' && '(USDC)'}
            </label>
            {orderType === 'Market' && (
              <span className="text-sm font-mono px-2 py-1 rounded" style={{
                color: 'var(--color-primary)',
                background: 'var(--color-primary)' + '20'
              }}>
                ~${marketPrice.toFixed(2)}
              </span>
            )}
          </div>
          <div className="relative">
            <input
              type="text"
              value={orderType === 'Market' ? `Market (~$${marketPrice.toFixed(2)})` : price}
              onChange={handlePriceChange}
              placeholder={orderType === 'Market' ? 'Market Price' : '0.00'}
              disabled={orderType === 'Market'}
              className={clsx(
                'w-full px-4 py-3 rounded-xl text-white placeholder-gray-400 font-mono text-lg transition-all focus:outline-none focus:ring-2 disabled:opacity-50',
                validation.errors.some(e => e.includes('price'))
                  ? 'focus:ring-red-500'
                  : validation.warnings.some(w => w.includes('price'))
                  ? 'focus:ring-yellow-500'
                  : 'focus:ring-blue-500'
              )}
              style={{
                background: 'var(--bg-tertiary)',
                border: validation.errors.some(e => e.includes('price'))
                  ? '1px solid var(--color-sell)'
                  : validation.warnings.some(w => w.includes('price'))
                  ? '1px solid var(--color-warning)'
                  : '1px solid var(--border-primary)'
              }}
            />
            <DollarSign className="absolute right-4 top-4 h-5 w-5" style={{ color: 'var(--text-tertiary)' }} />
          </div>
        </div>

        {/* Quantity Input */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Quantity (SOL)</label>
            <button
              onClick={handleMaxClick}
              className="px-3 py-1 rounded-lg text-xs font-semibold transition-all hover:scale-105"
              style={{
                background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))',
                color: 'white'
              }}
            >
              MAX
            </button>
          </div>
          <input
            type="text"
            value={quantity}
            onChange={handleQuantityChange}
            placeholder="0.000000"
            className={clsx(
              'w-full px-4 py-3 rounded-xl text-white placeholder-gray-400 font-mono text-lg transition-all focus:outline-none focus:ring-2',
              validation.errors.some(e => e.includes('quantity') || e.includes('balance'))
                ? 'focus:ring-red-500'
                : validation.warnings.some(w => w.includes('balance'))
                ? 'focus:ring-yellow-500'
                : 'focus:ring-blue-500'
            )}
            style={{
              background: 'var(--bg-tertiary)',
              border: validation.errors.some(e => e.includes('quantity') || e.includes('balance'))
                ? '1px solid var(--color-sell)'
                : validation.warnings.some(w => w.includes('balance'))
                ? '1px solid var(--color-warning)'
                : '1px solid var(--border-primary)'
            }}
          />
        </div>

        {/* Total Input */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Total (USDC)</label>
          <input
            type="text"
            value={total}
            onChange={handleTotalChange}
            placeholder="0.000000"
            className="w-full px-4 py-3 rounded-xl text-white placeholder-gray-400 font-mono text-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-primary)'
            }}
          />
        </div>

        {/* Advanced Options Toggle */}
        <div className="mb-4">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            {showAdvanced ? 'Hide' : 'Show'} Advanced Options
          </button>
        </div>

        {/* Advanced Options */}
        {showAdvanced && (
          <div className="mb-4 p-3 bg-gray-700/50 rounded-md space-y-3">
            {orderType === 'Market' && (
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Slippage Tolerance (%)
                </label>
                <div className="flex gap-2">
                  {[0.1, 0.5, 1.0, 3.0].map((value) => (
                    <button
                      key={value}
                      onClick={() => setSlippageTolerance(value)}
                      className={clsx(
                        'px-3 py-1 rounded text-xs transition-colors',
                        slippageTolerance === value
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                      )}
                    >
                      {value}%
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={postOnly}
                  onChange={(e) => setPostOnly(e.target.checked)}
                  className="rounded"
                />
                Post Only
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={reduceOnly}
                  onChange={(e) => setReduceOnly(e.target.checked)}
                  className="rounded"
                />
                Reduce Only
              </label>
            </div>
          </div>
        )}

        {/* Validation Messages */}
        {(validation.errors.length > 0 || validation.warnings.length > 0) && (
          <div className="mb-4 space-y-2">
            {validation.errors.map((error, index) => (
              <div key={index} className="flex items-center gap-2 text-red-400 text-sm">
                <AlertTriangle className="h-4 w-4" />
                {error}
              </div>
            ))}
            {validation.warnings.map((warning, index) => (
              <div key={index} className="flex items-center gap-2 text-yellow-400 text-sm">
                <AlertTriangle className="h-4 w-4" />
                {warning}
              </div>
            ))}
          </div>
        )}

        {/* Order Summary Preview */}
        {price && quantity && validation.isValid && (
          <div className="mb-4 p-3 bg-gray-700 rounded-md">
            <div className="flex items-center gap-2 mb-2">
              <Calculator className="h-4 w-4 text-blue-400" />
              <span className="text-sm text-gray-300">Order Preview</span>
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
              {orderType === 'Limit' && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Price:</span>
                  <span className="text-gray-300 font-mono">${price}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-400">Quantity:</span>
                <span className="text-gray-300 font-mono">{quantity} SOL</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Est. Total:</span>
                <span className="text-white font-mono">${total}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Est. Fees:</span>
                <span className="text-gray-300 font-mono">
                  ${calculateEstimatedFees(parseFloat(total) || 0).toFixed(4)}
                </span>
              </div>
              {orderType === 'Market' && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Est. Impact:</span>
                  <span className="text-yellow-400 font-mono">{calculatePriceImpact().toFixed(2)}%</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          onClick={showOrderConfirmation}
          disabled={!connected || placingOrder || !validation.isValid}
          className={clsx(
            'w-full py-4 px-6 rounded-xl text-white font-semibold text-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]',
            connected && validation.isValid
              ? 'shadow-lg hover:shadow-xl'
              : 'cursor-not-allowed'
          )}
          style={connected && validation.isValid ? {
            background: isBuy
              ? 'linear-gradient(135deg, var(--color-buy), #059669)'
              : 'linear-gradient(135deg, var(--color-sell), #dc2626)',
            boxShadow: isBuy
              ? '0 4px 20px rgba(16, 185, 129, 0.4)'
              : '0 4px 20px rgba(239, 68, 68, 0.4)'
          } : { background: 'var(--bg-accent)' }}
        >
          {placingOrder ? (
            <div className="flex items-center justify-center gap-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              <span>Processing Order...</span>
            </div>
          ) : connected ? (
            <div className="flex items-center justify-center gap-3">
              <Zap className="h-5 w-5" />
              <span>
                {isBuy ? 'Buy' : 'Sell'} {quantity || '0'} SOL
              </span>
            </div>
          ) : (
            'Connect Wallet to Trade'
          )}
        </button>

        {/* Balance Information */}
        {connected && userAccount && (
          <div className="mt-6 pt-6" style={{ borderTop: '1px solid var(--border-primary)' }}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full" style={{ background: 'var(--color-primary)' }}></div>
              <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Available Balance</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                <div className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>SOL Balance</div>
                <div className="text-lg font-mono font-semibold">
                  {(userAccount.baseTokenBalance.toNumber() / 1e6).toFixed(6)}
                </div>
              </div>
              <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                <div className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>USDC Balance</div>
                <div className="text-lg font-mono font-semibold">
                  {(userAccount.quoteTokenBalance.toNumber() / 1e6).toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Order Confirmation Modal */}
      {confirmation.show && confirmation.orderDetails && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="surface-card max-w-lg w-full mx-4 p-8 animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Confirm Order</h3>
              <button
                onClick={() => setConfirmation({ show: false, orderDetails: null })}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between">
                <span className="text-gray-400">Action:</span>
                <span className={confirmation.orderDetails.side === 'Bid' ? 'text-green-400' : 'text-red-400'}>
                  {confirmation.orderDetails.side === 'Bid' ? 'Buy' : 'Sell'} {confirmation.orderDetails.orderType}
                </span>
              </div>

              {confirmation.orderDetails.orderType === 'Limit' && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Price:</span>
                  <span className="text-white font-mono">${confirmation.orderDetails.price.toFixed(2)}</span>
                </div>
              )}
              
              <div className="flex justify-between">
                <span className="text-gray-400">Quantity:</span>
                <span className="text-white font-mono">{confirmation.orderDetails.quantity.toFixed(6)} SOL</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-400">Total:</span>
                <span className="text-white font-mono">${confirmation.orderDetails.total.toFixed(2)}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-400">Est. Fees:</span>
                <span className="text-gray-300 font-mono">${confirmation.orderDetails.estimatedFees.toFixed(4)}</span>
              </div>

              {confirmation.orderDetails.priceImpact !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Price Impact:</span>
                  <span className="text-yellow-400 font-mono">{confirmation.orderDetails.priceImpact.toFixed(2)}%</span>
                </div>
              )}

              {confirmation.orderDetails.slippage !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Slippage Tolerance:</span>
                  <span className="text-gray-300 font-mono">{confirmation.orderDetails.slippage}%</span>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setConfirmation({ show: false, orderDetails: null })}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmOrder}
                disabled={placingOrder}
                className={clsx(
                  'flex-1 py-2 px-4 rounded-md text-white font-medium transition-colors disabled:opacity-50',
                  confirmation.orderDetails.side === 'Bid'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                )}
              >
                {placingOrder ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Confirming...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    Confirm Order
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
