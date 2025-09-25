/**
 * Mock Matching Engine Service
 * 
 * In a production environment, this would connect to a real off-chain matching engine
 * via REST API or WebSocket. For this MVP demo, we'll simulate the matching engine
 * behavior locally.
 */

import { PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { Order, OrderSide, OrderType, OrderBookSnapshot, Trade } from '../types/svm_clob';

interface OrderBookLevel {
  price: number;
  quantity: number;
  orders: Order[];
}

class MockMatchingEngine {
  private orderIdCounter = 1;
  private orders: Map<number, Order> = new Map();
  private orderBook: {
    bids: OrderBookLevel[];
    asks: OrderBookLevel[];
  } = {
    bids: [],
    asks: []
  };
  private trades: Trade[] = [];
  private sequenceNumber = 0;

  constructor() {
    // Initialize with some mock orders
    this.initializeMockOrderBook();
  }

  private initializeMockOrderBook() {
    // Add some initial mock orders
    const mockBids = [
      { price: 100.00, quantity: 2.5 },
      { price: 99.50, quantity: 5.0 },
      { price: 99.00, quantity: 10.0 },
      { price: 98.50, quantity: 7.5 },
      { price: 98.00, quantity: 15.0 },
    ];

    const mockAsks = [
      { price: 101.00, quantity: 3.0 },
      { price: 101.50, quantity: 6.0 },
      { price: 102.00, quantity: 8.0 },
      { price: 102.50, quantity: 12.0 },
      { price: 103.00, quantity: 20.0 },
    ];

    // Create mock maker addresses
    const mockMaker = new PublicKey('11111111111111111111111111111111');

    mockBids.forEach(({ price, quantity }) => {
      const order: Order = {
        orderId: new BN(this.orderIdCounter++),
        owner: mockMaker,
        price: new BN(price * 1e6), // Convert to micro units
        quantity: new BN(quantity * 1e6),
        side: OrderSide.Bid,
        orderType: OrderType.Limit,
        timestamp: new BN(Date.now()),
      };
      this.addOrderToBook(order);
    });

    mockAsks.forEach(({ price, quantity }) => {
      const order: Order = {
        orderId: new BN(this.orderIdCounter++),
        owner: mockMaker,
        price: new BN(price * 1e6), // Convert to micro units
        quantity: new BN(quantity * 1e6),
        side: OrderSide.Ask,
        orderType: OrderType.Limit,
        timestamp: new BN(Date.now()),
      };
      this.addOrderToBook(order);
    });
  }

  private addOrderToBook(order: Order) {
    this.orders.set(order.orderId.toNumber(), order);
    
    const side = order.side === OrderSide.Bid ? 'bids' : 'asks';
    const price = order.price.toNumber() / 1e6;
    
    let level = this.orderBook[side].find(l => l.price === price);
    if (!level) {
      level = {
        price,
        quantity: 0,
        orders: []
      };
      this.orderBook[side].push(level);
    }
    
    level.orders.push(order);
    level.quantity += order.quantity.toNumber() / 1e6;
    
    // Sort order book
    if (side === 'bids') {
      this.orderBook.bids.sort((a, b) => b.price - a.price);
    } else {
      this.orderBook.asks.sort((a, b) => a.price - b.price);
    }
  }

  async placeOrder(order: Omit<Order, 'orderId' | 'timestamp'>): Promise<{ order: Order; trades: Trade[] }> {
    const newOrder: Order = {
      ...order,
      orderId: new BN(this.orderIdCounter++),
      timestamp: new BN(Date.now()),
    };

    const trades: Trade[] = [];

    // For market orders or aggressive limit orders, try to match immediately
    if (order.orderType === OrderType.Market || this.canMatchImmediately(newOrder)) {
      const matchedTrades = this.matchOrder(newOrder);
      trades.push(...matchedTrades);
      
      // If the order is not fully filled and it's a limit order, add remainder to book
      if (newOrder.quantity.gt(new BN(0)) && order.orderType === OrderType.Limit) {
        this.addOrderToBook(newOrder);
      }
    } else {
      // Add limit order to book
      this.addOrderToBook(newOrder);
    }

    this.sequenceNumber++;
    return { order: newOrder, trades };
  }

  private canMatchImmediately(order: Order): boolean {
    const oppositeBook = order.side === OrderSide.Bid ? this.orderBook.asks : this.orderBook.bids;
    if (oppositeBook.length === 0) return false;

    const bestPrice = oppositeBook[0].price;
    if (order.side === OrderSide.Bid) {
      return order.price.gte(new BN(bestPrice * 1e6));
    } else {
      return order.price.lte(new BN(bestPrice * 1e6));
    }
  }

  private matchOrder(takerOrder: Order): Trade[] {
    const trades: Trade[] = [];
    const oppositeBook = takerOrder.side === OrderSide.Bid ? this.orderBook.asks : this.orderBook.bids;
    
    let remainingQuantity = takerOrder.quantity.clone();
    
    for (const level of oppositeBook) {
      if (remainingQuantity.eq(new BN(0))) break;
      
      // Check if price is acceptable
      if (takerOrder.orderType === OrderType.Limit) {
        if (takerOrder.side === OrderSide.Bid && takerOrder.price.lt(new BN(level.price * 1e6))) break;
        if (takerOrder.side === OrderSide.Ask && takerOrder.price.gt(new BN(level.price * 1e6))) break;
      }
      
      const ordersToRemove: number[] = [];
      
      for (const makerOrder of level.orders) {
        if (remainingQuantity.eq(new BN(0))) break;
        
        const tradeQuantity = BN.min(remainingQuantity, makerOrder.quantity);
        
        const trade: Trade = {
          takerOrderId: takerOrder.orderId,
          makerOrderId: makerOrder.orderId,
          taker: takerOrder.owner,
          maker: makerOrder.owner,
          price: makerOrder.price,
          quantity: tradeQuantity,
          takerSide: takerOrder.side,
          timestamp: new BN(Date.now()),
        };
        
        trades.push(trade);
        this.trades.push(trade);
        
        // Update quantities
        remainingQuantity = remainingQuantity.sub(tradeQuantity);
        makerOrder.quantity = makerOrder.quantity.sub(tradeQuantity);
        
        if (makerOrder.quantity.eq(new BN(0))) {
          ordersToRemove.push(makerOrder.orderId.toNumber());
        }
      }
      
      // Remove filled orders
      level.orders = level.orders.filter(o => !ordersToRemove.includes(o.orderId.toNumber()));
      ordersToRemove.forEach(id => this.orders.delete(id));
      
      // Update level quantity
      level.quantity = level.orders.reduce((sum, o) => sum + o.quantity.toNumber() / 1e6, 0);
    }
    
    // Update taker order quantity
    takerOrder.quantity = remainingQuantity;
    
    // Clean up empty levels
    this.orderBook.bids = this.orderBook.bids.filter(l => l.orders.length > 0);
    this.orderBook.asks = this.orderBook.asks.filter(l => l.orders.length > 0);
    
    return trades;
  }

  async cancelOrder(orderId: number): Promise<boolean> {
    const order = this.orders.get(orderId);
    if (!order) return false;

    this.orders.delete(orderId);
    
    const side = order.side === OrderSide.Bid ? 'bids' : 'asks';
    const price = order.price.toNumber() / 1e6;
    
    const levelIndex = this.orderBook[side].findIndex(l => l.price === price);
    if (levelIndex !== -1) {
      const level = this.orderBook[side][levelIndex];
      level.orders = level.orders.filter(o => o.orderId.toNumber() !== orderId);
      level.quantity = level.orders.reduce((sum, o) => sum + o.quantity.toNumber() / 1e6, 0);
      
      if (level.orders.length === 0) {
        this.orderBook[side].splice(levelIndex, 1);
      }
    }
    
    this.sequenceNumber++;
    return true;
  }

  async getOrderBookSnapshot(): Promise<OrderBookSnapshot> {
    const bids: [BN, BN][] = this.orderBook.bids.map(level => [
      new BN(level.price * 1e6),
      new BN(level.quantity * 1e6)
    ]);
    
    const asks: [BN, BN][] = this.orderBook.asks.map(level => [
      new BN(level.price * 1e6),
      new BN(level.quantity * 1e6)
    ]);
    
    return {
      bids,
      asks,
      sequenceNumber: new BN(this.sequenceNumber),
    };
  }

  async getUserOrders(owner: PublicKey): Promise<Order[]> {
    return Array.from(this.orders.values()).filter(order => 
      order.owner.equals(owner)
    );
  }

  async getRecentTrades(limit = 50): Promise<Trade[]> {
    return this.trades.slice(-limit).reverse();
  }

  // Get best bid and ask prices
  getBestBidAsk(): { bestBid: number | null; bestAsk: number | null } {
    const bestBid = this.orderBook.bids.length > 0 ? this.orderBook.bids[0].price : null;
    const bestAsk = this.orderBook.asks.length > 0 ? this.orderBook.asks[0].price : null;
    return { bestBid, bestAsk };
  }

  // Get market depth
  getMarketDepth(levels = 5): { bids: OrderBookLevel[]; asks: OrderBookLevel[] } {
    return {
      bids: this.orderBook.bids.slice(0, levels),
      asks: this.orderBook.asks.slice(0, levels),
    };
  }
}

// Singleton instance
let matchingEngineInstance: MockMatchingEngine | null = null;

export const getMatchingEngine = (): MockMatchingEngine => {
  if (!matchingEngineInstance) {
    matchingEngineInstance = new MockMatchingEngine();
  }
  return matchingEngineInstance;
};

// Export types for use in components
export type { OrderBookLevel };