import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useSvmClobClient } from '../hooks/useSvmClobClient';
import { useTransactionHandler } from '../hooks/useTransactionHandler';
import { PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { OrderSide, OrderType, UserAccount } from '../types/svm_clob';
import { 
  ArrowUpDown, 
  Calculator, 
  Zap, 
  AlertTriangle, 
  CheckCircle, 
  X,
  TrendingUp,
  TrendingDown,
  Clock,
  DollarSign
} from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { getMatchingEngine } from '../services/matching-engine';

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
    side: OrderSide;
    orderType: OrderType;
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
  const transactionHandler = useTransactionHandler();
  
  const [side, setSide] = useState<OrderSide>(OrderSide.Bid);
  const [orderType, setOrderType] = useState<OrderType>(OrderType.Limit);
  const [price, setPrice] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('');
  const [total, setTotal] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [userAccount, setUserAccount] = useState<UserAccount | null>(null);
  const [marketPrice, setMarketPrice] = useState<number>(100);
  const [validation, setValidation] = useState<OrderValidation>({ isValid: false, errors: [], warnings: [] });
  const [confirmation, setConfirmation] = useState<OrderConfirmation>({ show: false, orderDetails: null });
  const [slippageTolerance, setSlippageTolerance] = useState<number>(0.5); // 0.5% default

  // Advanced order options
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [postOnly, setPostOnly] = useState(false);
  const [reduceOnly, setReduceOnly] = useState(false);

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
    const priceNum = orderType === OrderType.Market ? marketPrice : parseFloat(price) || 0;
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
      if (orderType === OrderType.Limit) {
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
        const priceNum = orderType === OrderType.Market ? marketPrice : parseFloat(price);
        const totalCost = priceNum * quantityNum;
        
        if (side === OrderSide.Bid) {
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
    if (newType === OrderType.Market) {
      setPrice('');
    } else {
      // Set a reasonable default price for limit orders
      if (!price) {
        const matchingEngine = getMatchingEngine();
        const { bestBid, bestAsk } = matchingEngine.getBestBidAsk();
        const defaultPrice = newSide === OrderSide.Bid 
          ? (bestBid || marketPrice * 0.99) 
          : (bestAsk || marketPrice * 1.01);
        setPrice(defaultPrice.toFixed(2));
      }
    }
  };

  const handleMaxClick = () => {
    if (!userAccount) return;
    
    if (side === OrderSide.Bid) {
      // Max buy quantity based on quote token balance and price
      const quoteBalance = userAccount.quoteTokenBalance.toNumber() / 1e6;
      const priceNum = orderType === OrderType.Market ? marketPrice : (parseFloat(price) || marketPrice);
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
    if (orderType === OrderType.Market) return;
    
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
      
      const priceNum = orderType === OrderType.Market ? marketPrice : parseFloat(price) || 0;
      if (priceNum > 0) {
        const quantityNum = parseFloat(totalValue) / priceNum;
        setQuantity(quantityNum > 0 ? quantityNum.toFixed(6) : '');
      }
    }
  };

  const calculateEstimatedFees = (total: number): number => {
    // Estimated trading fee: 0.1% for takers, 0.05% for makers
    const feeRate = orderType === OrderType.Market ? 0.001 : 0.0005;
    return total * feeRate;
  };

  const calculatePriceImpact = (): number => {
    if (orderType !== OrderType.Market || !quantity) return 0;
    
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

    const priceNum = orderType === OrderType.Market ? marketPrice : parseFloat(price);
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
        priceImpact: orderType === OrderType.Market ? priceImpact : undefined,
        slippage: orderType === OrderType.Market ? slippageTolerance : undefined,
      }
    });
  };

  const confirmOrder = async () => {
    if (!confirmation.orderDetails || !client || !publicKey || !userAccount) return;

    setLoading(true);
    setConfirmation({ show: false, orderDetails: null });

    try {
      const matchingEngine = getMatchingEngine();
      const { orderDetails } = confirmation;

      toast.loading('Placing order...');

      // Place order in the matching engine
      const { order, trades } = await matchingEngine.placeOrder({
        owner: publicKey,
        price: new BN(orderDetails.price * 1e6),
        quantity: new BN(orderDetails.quantity * 1e6),
        side: orderDetails.side,
        orderType: orderDetails.orderType,
      });

      // If trades were executed, simulate settlement
      if (trades.length > 0) {
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
    <>
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
              'flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2',
              side === OrderSide.Bid
                ? 'bg-green-600 text-white'
                : 'text-gray-300 hover:text-white'
            )}
          >
            <TrendingUp className="h-4 w-4" />
            Buy
          </button>
          <button
            onClick={() => handleSideChange(OrderSide.Ask)}
            className={clsx(
              'flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2',
              side === OrderSide.Ask
                ? 'bg-red-600 text-white'
                : 'text-gray-300 hover:text-white'
            )}
          >
            <TrendingDown className="h-4 w-4" />
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
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm text-gray-400">
              Price {orderType === OrderType.Limit && '(USDC)'}
            </label>
            {orderType === OrderType.Market && (
              <span className="text-xs text-gray-400">
                ~${marketPrice.toFixed(2)}
              </span>
            )}
          </div>
          <div className="relative">
            <input
              type="text"
              value={orderType === OrderType.Market ? `Market (~$${marketPrice.toFixed(2)})` : price}
              onChange={handlePriceChange}
              placeholder={orderType === OrderType.Market ? 'Market Price' : '0.00'}
              disabled={orderType === OrderType.Market}
              className={clsx(
                'w-full bg-gray-700 border rounded-md px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 disabled:opacity-50',
                validation.errors.some(e => e.includes('price')) 
                  ? 'border-red-500' 
                  : validation.warnings.some(w => w.includes('price'))
                  ? 'border-yellow-500'
                  : 'border-gray-600'
              )}
            />
            <DollarSign className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
          </div>
        </div>

        {/* Quantity Input */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm text-gray-400">Quantity (SOL)</label>
            <button
              onClick={handleMaxClick}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium"
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
              'w-full bg-gray-700 border rounded-md px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500',
              validation.errors.some(e => e.includes('quantity') || e.includes('balance')) 
                ? 'border-red-500' 
                : validation.warnings.some(w => w.includes('balance'))
                ? 'border-yellow-500'
                : 'border-gray-600'
            )}
          />
        </div>

        {/* Total Input */}
        <div className="mb-4">
          <label className="block text-sm text-gray-400 mb-1">Total (USDC)</label>
          <input
            type="text"
            value={total}
            onChange={handleTotalChange}
            placeholder="0.000000"
            className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
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
            {orderType === OrderType.Market && (
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
              {orderType === OrderType.Market && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Est. Impact:</span>
                  <span className="text-yellow-400 font-mono">
                    {calculatePriceImpact().toFixed(2)}%
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          onClick={showOrderConfirmation}
          disabled={!connected || loading || !validation.isValid}
          className={clsx(
            'w-full py-3 px-4 rounded-md text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
            connected && validation.isValid ? buttonColor : 'bg-gray-600'
          )}
        >
          {loading ? (
            <div className="flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>Processing...</span>
            </div>
          ) : connected ? (
            <div className="flex items-center justify-center gap-2">
              <Zap className="h-4 w-4" />
              <span>
                {isBuy ? 'Buy' : 'Sell'} {quantity || '0'} SOL
              </span>
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

      {/* Order Confirmation Modal */}
      {confirmation.show && confirmation.orderDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
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
                <span className={confirmation.orderDetails.side === OrderSide.Bid ? 'text-green-400' : 'text-red-400'}>
                  {confirmation.orderDetails.side === OrderSide.Bid ? 'Buy' : 'Sell'} {confirmation.orderDetails.orderType}
                </span>
              </div>
              
              {confirmation.orderDetails.orderType === OrderType.Limit && (
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
                disabled={loading}
                className={clsx(
                  'flex-1 py-2 px-4 rounded-md text-white font-medium transition-colors disabled:opacity-50',
                  confirmation.orderDetails.side === OrderSide.Bid
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                )}
              >
                {loading ? (
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