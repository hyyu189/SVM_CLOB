import { 
  PublicKey, 
  SystemProgram, 
  SYSVAR_RENT_PUBKEY,
  Transaction,
  TransactionInstruction,
  Connection 
} from '@solana/web3.js';
import { Program, BN, web3 } from '@coral-xyz/anchor';
import { 
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction 
} from '@solana/spl-token';
import { 
  SvmClob, 
  OrderBook, 
  UserAccount, 
  Trade, 
  Order, 
  OrderSide, 
  OrderType 
} from '../types/svm_clob';

// Off-chain API types
export interface OffChainOrder {
  client_order_id?: number;
  side: 'Bid' | 'Ask';
  order_type: 'Limit' | 'Market' | 'PostOnly';
  price: number;
  quantity: number;
  time_in_force: 'GoodTillCancelled' | 'ImmediateOrCancel' | 'FillOrKill' | 'GoodTillTime';
  expiry_timestamp?: number;
  self_trade_behavior?: 'DecrementAndCancel' | 'CancelProvide' | 'CancelTake';
}

export interface OffChainOrderResponse {
  order_id: number;
  client_order_id?: number;
  owner: string;
  side: 'Bid' | 'Ask';
  order_type: 'Limit' | 'Market' | 'PostOnly';
  price: number;
  quantity: number;
  remaining_quantity: number;
  status: 'Open' | 'PartiallyFilled' | 'Filled' | 'Cancelled';
  timestamp: number;
  expiry_timestamp: number;
}

export interface OrderBookSnapshot {
  bids: [number, number][]; // [price, quantity]
  asks: [number, number][]; // [price, quantity]
  sequence_number: number;
  timestamp: number;
}

export interface TradeData {
  maker_order_id: number;
  taker_order_id: number;
  price: number;
  quantity: number;
  timestamp: number;
  maker_side: 'Bid' | 'Ask';
}

export interface MarketStats {
  best_bid: number;
  best_ask: number;
  spread: number;
  last_price: number;
  '24h_volume': number;
  '24h_high': number;
  '24h_low': number;
  '24h_change': number;
  total_bid_orders: number;
  total_ask_orders: number;
  price_levels_count: number;
}

export interface UserAccountData {
  owner: string;
  open_orders_count: number;
  total_orders_placed: number;
  total_volume_traded: number;
  is_initialized: boolean;
}

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: number;
}

export interface ApiResponse<T> {
  jsonrpc: string;
  id: number;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export class SvmClobClient {
  private apiUrl: string;
  private wsUrl: string;
  private authToken?: string;
  private ws?: WebSocket;
  private subscriptions: Map<string, (data: any) => void> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(
    private program: Program<SvmClob>,
    private programId: PublicKey,
    private connection: Connection,
    options: {
      apiUrl: string;
      wsUrl: string;
      authToken?: string;
    }
  ) {
    this.apiUrl = options.apiUrl;
    this.wsUrl = options.wsUrl;
    this.authToken = options.authToken;
  }

  // Authentication
  setAuthToken(token: string) {
    this.authToken = token;
  }

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }
    
    return headers;
  }

  // API request helper
  private async apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.apiUrl}${endpoint}`;
    const headers = { ...this.getAuthHeaders(), ...options.headers };
    
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data: ApiResponse<T> = await response.json();
    
    if (data.error) {
      throw new Error(`API error: ${data.error.message} (code: ${data.error.code})`);
    }

    return data.result!;
  }

  // Generate PDA addresses
  async getOrderbookAddress(
    baseMint: PublicKey, 
    quoteMint: PublicKey
  ): Promise<[PublicKey, number]> {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from('orderbook'),
        baseMint.toBuffer(),
        quoteMint.toBuffer()
      ],
      this.programId
    );
  }

  async getUserAccountAddress(user: PublicKey): Promise<[PublicKey, number]> {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from('user_account'),
        user.toBuffer()
      ],
      this.programId
    );
  }

  async getClobTokenVaultAddress(tokenMint: PublicKey): Promise<[PublicKey, number]> {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from('clob_vault'),
        tokenMint.toBuffer()
      ],
      this.programId
    );
  }

  // Initialize orderbook
  async initializeOrderbook(
    authority: PublicKey,
    baseMint: PublicKey,
    quoteMint: PublicKey,
    tickSize: BN,
    minOrderSize: BN
  ): Promise<TransactionInstruction> {
    const [orderbookPda] = await this.getOrderbookAddress(baseMint, quoteMint);

    return this.program.methods
      .initializeOrderbook(baseMint, quoteMint, tickSize, minOrderSize, authority)
      .accounts({
        orderbook: orderbookPda,
        authority,
        baseMint,
        quoteMint,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
  }

  // Initialize user account
  async initializeUserAccount(user: PublicKey): Promise<TransactionInstruction> {
    const [userAccountPda] = await this.getUserAccountAddress(user);

    return this.program.methods
      .initializeUserAccount()
      .accounts({
        userAccount: userAccountPda,
        user,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
  }

  // Deposit tokens
  async deposit(
    user: PublicKey,
    tokenMint: PublicKey,
    baseMint: PublicKey,
    quoteMint: PublicKey,
    amount: BN
  ): Promise<TransactionInstruction[]> {
    const [orderbookPda] = await this.getOrderbookAddress(baseMint, quoteMint);
    const [userAccountPda] = await this.getUserAccountAddress(user);
    const [clobTokenVaultPda] = await this.getClobTokenVaultAddress(tokenMint);
    
    const userTokenAccount = await getAssociatedTokenAddress(tokenMint, user);

    const instructions: TransactionInstruction[] = [];

    // Create CLOB token vault if needed (handled by init_if_needed in Anchor)
    const depositInstruction = await this.program.methods
      .deposit(amount)
      .accounts({
        orderbook: orderbookPda,
        userAccount: userAccountPda,
        userTokenAccount,
        tokenMint,
        clobTokenVault: clobTokenVaultPda,
        user,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .instruction();

    instructions.push(depositInstruction);
    return instructions;
  }

  // Withdraw tokens
  async withdraw(
    user: PublicKey,
    tokenMint: PublicKey,
    baseMint: PublicKey,
    quoteMint: PublicKey,
    amount: BN
  ): Promise<TransactionInstruction> {
    const [orderbookPda] = await this.getOrderbookAddress(baseMint, quoteMint);
    const [userAccountPda] = await this.getUserAccountAddress(user);
    const [clobTokenVaultPda] = await this.getClobTokenVaultAddress(tokenMint);
    
    const userTokenAccount = await getAssociatedTokenAddress(tokenMint, user);

    return this.program.methods
      .withdraw(amount)
      .accounts({
        orderbook: orderbookPda,
        userAccount: userAccountPda,
        userTokenAccount,
        tokenMint,
        clobTokenVault: clobTokenVaultPda,
        user,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
  }

  // Execute trade (admin only)
  async executeTrade(
    authority: PublicKey,
    baseMint: PublicKey,
    quoteMint: PublicKey,
    trade: Trade
  ): Promise<TransactionInstruction> {
    const [orderbookPda] = await this.getOrderbookAddress(baseMint, quoteMint);
    const [takerUserAccountPda] = await this.getUserAccountAddress(trade.taker);
    const [makerUserAccountPda] = await this.getUserAccountAddress(trade.maker);

    return this.program.methods
      .executeTrade(trade)
      .accounts({
        orderbook: orderbookPda,
        takerUserAccount: takerUserAccountPda,
        makerUserAccount: makerUserAccountPda,
        authority,
      })
      .instruction();
  }

  // Fetch orderbook data
  async getOrderbook(
    baseMint: PublicKey,
    quoteMint: PublicKey
  ): Promise<OrderBook | null> {
    try {
      const [orderbookPda] = await this.getOrderbookAddress(baseMint, quoteMint);
      return await this.program.account.orderBook.fetch(orderbookPda);
    } catch (error) {
      console.error('Error fetching orderbook:', error);
      return null;
    }
  }

  // Fetch user account data
  async getUserAccount(user: PublicKey): Promise<UserAccount | null> {
    try {
      const [userAccountPda] = await this.getUserAccountAddress(user);
      return await this.program.account.userAccount.fetch(userAccountPda);
    } catch (error) {
      console.error('Error fetching user account:', error);
      return null;
    }
  }

  // Check if user account exists
  async userAccountExists(user: PublicKey): Promise<boolean> {
    const userAccount = await this.getUserAccount(user);
    return userAccount !== null && userAccount.isInitialized === 1;
  }

  // Check if orderbook exists
  async orderbookExists(
    baseMint: PublicKey,
    quoteMint: PublicKey
  ): Promise<boolean> {
    const orderbook = await this.getOrderbook(baseMint, quoteMint);
    return orderbook !== null && orderbook.isInitialized === 1;
  }

  // Listen to trade events
  addEventListener(
    eventName: 'TradeSettled',
    callback: (event: any, slot: number, signature: string) => void
  ) {
    return this.program.addEventListener(eventName, callback);
  }

  removeEventListener(listenerId: number) {
    return this.program.removeEventListener(listenerId);
  }

  // Utility functions
  formatPrice(price: BN, decimals = 6): number {
    return price.toNumber() / Math.pow(10, decimals);
  }

  formatQuantity(quantity: BN, decimals = 6): number {
    return quantity.toNumber() / Math.pow(10, decimals);
  }

  parsePrice(price: number, decimals = 6): BN {
    return new BN(price * Math.pow(10, decimals));
  }

  parseQuantity(quantity: number, decimals = 6): BN {
    return new BN(quantity * Math.pow(10, decimals));
  }

  // ===== OFF-CHAIN API METHODS =====

  // Order Management
  async placeOrder(order: OffChainOrder): Promise<OffChainOrderResponse> {
    return this.apiRequest<OffChainOrderResponse>('/api/v1/orders', {
      method: 'POST',
      body: JSON.stringify(order),
    });
  }

  async cancelOrder(orderId: number): Promise<{ order_id: number; status: string; cancelled_at: number }> {
    return this.apiRequest(`/api/v1/orders/${orderId}`, {
      method: 'DELETE',
    });
  }

  async getOrder(orderId: number): Promise<OffChainOrderResponse> {
    return this.apiRequest<OffChainOrderResponse>(`/api/v1/orders/${orderId}`);
  }

  async modifyOrder(
    orderId: number,
    updates: { new_price?: number; new_quantity?: number }
  ): Promise<OffChainOrderResponse> {
    return this.apiRequest<OffChainOrderResponse>(`/api/v1/orders/${orderId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  // Market Data
  async getOrderBookSnapshot(levels = 10): Promise<OrderBookSnapshot> {
    return this.apiRequest<OrderBookSnapshot>(`/api/v1/orderbook?levels=${levels}`);
  }

  async getRecentTrades(limit = 50, since?: number): Promise<TradeData[]> {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (since) params.append('since', since.toString());
    
    return this.apiRequest<TradeData[]>(`/api/v1/trades?${params.toString()}`);
  }

  async getMarketStats(): Promise<MarketStats> {
    return this.apiRequest<MarketStats>('/api/v1/market/stats');
  }

  // User Operations
  async getUserOrders(
    userId: string,
    options: { status?: string; limit?: number } = {}
  ): Promise<OffChainOrderResponse[]> {
    const params = new URLSearchParams();
    if (options.status) params.append('status', options.status);
    if (options.limit) params.append('limit', options.limit.toString());
    
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.apiRequest<OffChainOrderResponse[]>(`/api/v1/users/${userId}/orders${query}`);
  }

  async getUserTrades(
    userId: string,
    options: { limit?: number; since?: number } = {}
  ): Promise<TradeData[]> {
    const params = new URLSearchParams();
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.since) params.append('since', options.since.toString());
    
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.apiRequest<TradeData[]>(`/api/v1/users/${userId}/trades${query}`);
  }

  async getUserAccountData(userId: string): Promise<UserAccountData> {
    return this.apiRequest<UserAccountData>(`/api/v1/users/${userId}/account`);
  }

  // ===== WEBSOCKET METHODS =====

  connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.wsUrl);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.handleWebSocketMessage(message);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        this.ws.onclose = () => {
          console.log('WebSocket disconnected');
          this.handleWebSocketReconnect();
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  private handleWebSocketMessage(message: WebSocketMessage) {
    const { type, data } = message;
    
    switch (type) {
      case 'MarketData':
        this.handleMarketDataUpdate(data);
        break;
      case 'OrderUpdate':
        this.handleOrderUpdate(data);
        break;
      case 'TradeExecution':
        this.handleTradeExecution(data);
        break;
      default:
        console.log('Unknown message type:', type);
    }
  }

  private handleMarketDataUpdate(data: any) {
    const { update_type } = data;
    
    switch (update_type) {
      case 'OrderBookUpdate':
        const callback = this.subscriptions.get('orderbook');
        if (callback) callback(data.order_book);
        break;
      case 'TradeExecution':
        const tradeCallback = this.subscriptions.get('trades');
        if (tradeCallback) tradeCallback(data.trade);
        break;
    }
  }

  private handleOrderUpdate(data: any) {
    const callback = this.subscriptions.get('user_orders');
    if (callback) callback(data.order);
  }

  private handleTradeExecution(data: any) {
    const callback = this.subscriptions.get('trade_executions');
    if (callback) callback(data);
  }

  private handleWebSocketReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.pow(2, this.reconnectAttempts) * 1000; // Exponential backoff
      
      console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
      
      setTimeout(() => {
        this.connectWebSocket().catch((error) => {
          console.error('Reconnection failed:', error);
        });
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  disconnectWebSocket() {
    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }
    this.subscriptions.clear();
  }

  // WebSocket Subscriptions
  subscribeOrderBook(market: string, callback: (orderBook: OrderBookSnapshot) => void) {
    this.subscriptions.set('orderbook', callback);
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'Subscribe',
        subscription: {
          type: 'OrderBook',
          market
        }
      }));
    }
  }

  subscribeTrades(market: string, callback: (trade: TradeData) => void) {
    this.subscriptions.set('trades', callback);
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'Subscribe',
        subscription: {
          type: 'Trades',
          market
        }
      }));
    }
  }

  subscribeUserOrders(userId: string, callback: (order: OffChainOrderResponse) => void) {
    this.subscriptions.set('user_orders', callback);
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'Subscribe',
        subscription: {
          type: 'UserOrders',
          user: userId
        }
      }));
    }
  }

  subscribeAllMarkets(callback: (data: any) => void) {
    this.subscriptions.set('all_markets', callback);
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'Subscribe',
        subscription: {
          type: 'AllMarkets'
        }
      }));
    }
  }

  unsubscribe(subscriptionType: string) {
    this.subscriptions.delete(subscriptionType);
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'Unsubscribe',
        subscription_type: subscriptionType
      }));
    }
  }

  // ===== HYBRID METHODS (On-chain + Off-chain) =====

  // Place order off-chain and handle potential on-chain settlement
  async placeOrderHybrid(
    user: PublicKey,
    baseMint: PublicKey,
    quoteMint: PublicKey,
    order: OffChainOrder
  ): Promise<{
    offChainOrder: OffChainOrderResponse;
    onChainTx?: string;
  }> {
    // 1. Place order off-chain
    const offChainOrder = await this.placeOrder(order);
    
    // 2. Check if user account exists on-chain, if not initialize it
    const userAccountExists = await this.userAccountExists(user);
    let onChainTx: string | undefined;
    
    if (!userAccountExists) {
      console.log('Initializing user account on-chain...');
      const initInstruction = await this.initializeUserAccount(user);
      const transaction = new Transaction().add(initInstruction);
      
      // Note: In a real implementation, you'd need to sign and send this transaction
      // This is just preparing the instruction
      onChainTx = 'pending_initialization';
    }
    
    return {
      offChainOrder,
      onChainTx
    };
  }

  // Get comprehensive market data (on-chain + off-chain)
  async getMarketDataComplete(
    baseMint: PublicKey,
    quoteMint: PublicKey
  ): Promise<{
    onChain: {
      orderbook: OrderBook | null;
      exists: boolean;
    };
    offChain: {
      orderBook: OrderBookSnapshot;
      stats: MarketStats;
      recentTrades: TradeData[];
    };
  }> {
    // Fetch on-chain data
    const onChainOrderbook = await this.getOrderbook(baseMint, quoteMint);
    const orderbookExists = await this.orderbookExists(baseMint, quoteMint);
    
    // Fetch off-chain data
    const [orderBook, stats, recentTrades] = await Promise.all([
      this.getOrderBookSnapshot(),
      this.getMarketStats(),
      this.getRecentTrades(20)
    ]);
    
    return {
      onChain: {
        orderbook: onChainOrderbook,
        exists: orderbookExists
      },
      offChain: {
        orderBook,
        stats,
        recentTrades
      }
    };
  }

  // Get comprehensive user data (on-chain + off-chain)
  async getUserDataComplete(
    user: PublicKey
  ): Promise<{
    onChain: {
      userAccount: UserAccount | null;
      exists: boolean;
    };
    offChain: {
      account: UserAccountData;
      orders: OffChainOrderResponse[];
      trades: TradeData[];
    };
  }> {
    const userId = user.toString();
    
    // Fetch on-chain data
    const onChainUserAccount = await this.getUserAccount(user);
    const userAccountExists = await this.userAccountExists(user);
    
    // Fetch off-chain data
    const [account, orders, trades] = await Promise.all([
      this.getUserAccountData(userId),
      this.getUserOrders(userId, { status: 'Open' }),
      this.getUserTrades(userId, { limit: 50 })
    ]);
    
    return {
      onChain: {
        userAccount: onChainUserAccount,
        exists: userAccountExists
      },
      offChain: {
        account,
        orders,
        trades
      }
    };
  }

  // Health check
  async getHealth(): Promise<any> {
    return this.apiRequest('/health');
  }

  // Get API metrics
  async getMetrics(): Promise<any> {
    return this.apiRequest('/metrics');
  }
}