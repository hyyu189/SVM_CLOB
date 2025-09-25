import { PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';

// IDL type definitions based on the Rust contract
export interface SvmClobIDL {
  version: '0.1.0';
  name: 'svm_clob';
  instructions: [
    {
      name: 'initializeOrderbook';
      accounts: [
        { name: 'orderbook'; isMut: true; isSigner: false },
        { name: 'authority'; isMut: true; isSigner: true },
        { name: 'baseMint'; isMut: false; isSigner: false },
        { name: 'quoteMint'; isMut: false; isSigner: false },
        { name: 'systemProgram'; isMut: false; isSigner: false }
      ];
      args: [
        { name: 'baseMint'; type: 'publicKey' },
        { name: 'quoteMint'; type: 'publicKey' },
        { name: 'tickSize'; type: 'u64' },
        { name: 'minOrderSize'; type: 'u64' },
        { name: 'authority'; type: 'publicKey' }
      ];
    },
    {
      name: 'initializeUserAccount';
      accounts: [
        { name: 'userAccount'; isMut: true; isSigner: false },
        { name: 'user'; isMut: true; isSigner: true },
        { name: 'systemProgram'; isMut: false; isSigner: false }
      ];
      args: [];
    },
    {
      name: 'executeTrade';
      accounts: [
        { name: 'orderbook'; isMut: true; isSigner: false },
        { name: 'takerUserAccount'; isMut: true; isSigner: false },
        { name: 'makerUserAccount'; isMut: true; isSigner: false },
        { name: 'authority'; isMut: true; isSigner: true }
      ];
      args: [{ name: 'trade'; type: { defined: 'Trade' } }];
    },
    {
      name: 'deposit';
      accounts: [
        { name: 'orderbook'; isMut: false; isSigner: false },
        { name: 'userAccount'; isMut: true; isSigner: false },
        { name: 'userTokenAccount'; isMut: true; isSigner: false },
        { name: 'tokenMint'; isMut: false; isSigner: false },
        { name: 'clobTokenVault'; isMut: true; isSigner: false },
        { name: 'user'; isMut: true; isSigner: true },
        { name: 'tokenProgram'; isMut: false; isSigner: false },
        { name: 'systemProgram'; isMut: false; isSigner: false },
        { name: 'rent'; isMut: false; isSigner: false }
      ];
      args: [{ name: 'amount'; type: 'u64' }];
    },
    {
      name: 'withdraw';
      accounts: [
        { name: 'orderbook'; isMut: false; isSigner: false },
        { name: 'userAccount'; isMut: true; isSigner: false },
        { name: 'userTokenAccount'; isMut: true; isSigner: false },
        { name: 'tokenMint'; isMut: false; isSigner: false },
        { name: 'clobTokenVault'; isMut: true; isSigner: false },
        { name: 'user'; isMut: true; isSigner: true },
        { name: 'tokenProgram'; isMut: false; isSigner: false }
      ];
      args: [{ name: 'amount'; type: 'u64' }];
    }
  ];
  accounts: [
    {
      name: 'OrderBook';
      type: {
        kind: 'struct';
        fields: [
          { name: 'authority'; type: 'publicKey' },
          { name: 'baseMint'; type: 'publicKey' },
          { name: 'quoteMint'; type: 'publicKey' },
          { name: 'tickSize'; type: 'u64' },
          { name: 'minOrderSize'; type: 'u64' },
          { name: 'totalVolume'; type: 'u64' },
          { name: 'isInitialized'; type: 'u8' },
          { name: 'isPaused'; type: 'u8' },
          { name: 'padding'; type: { array: ['u8', 6] } },
          { name: 'reserved'; type: { array: ['u8', 32] } }
        ];
      };
    },
    {
      name: 'UserAccount';
      type: {
        kind: 'struct';
        fields: [
          { name: 'owner'; type: 'publicKey' },
          { name: 'totalVolumeTraded'; type: 'u64' },
          { name: 'baseTokenBalance'; type: 'u64' },
          { name: 'quoteTokenBalance'; type: 'u64' },
          { name: 'isInitialized'; type: 'u8' },
          { name: 'padding'; type: { array: ['u8', 7] } },
          { name: 'reserved'; type: { array: ['u8', 32] } }
        ];
      };
    }
  ];
  types: [
    {
      name: 'Trade';
      type: {
        kind: 'struct';
        fields: [
          { name: 'takerOrderId'; type: 'u64' },
          { name: 'makerOrderId'; type: 'u64' },
          { name: 'taker'; type: 'publicKey' },
          { name: 'maker'; type: 'publicKey' },
          { name: 'price'; type: 'u64' },
          { name: 'quantity'; type: 'u64' },
          { name: 'takerSide'; type: { defined: 'OrderSide' } },
          { name: 'timestamp'; type: 'i64' }
        ];
      };
    },
    {
      name: 'Order';
      type: {
        kind: 'struct';
        fields: [
          { name: 'orderId'; type: 'u64' },
          { name: 'owner'; type: 'publicKey' },
          { name: 'price'; type: 'u64' },
          { name: 'quantity'; type: 'u64' },
          { name: 'side'; type: { defined: 'OrderSide' } },
          { name: 'orderType'; type: { defined: 'OrderType' } },
          { name: 'timestamp'; type: 'i64' }
        ];
      };
    },
    {
      name: 'OrderBookSnapshot';
      type: {
        kind: 'struct';
        fields: [
          { name: 'bids'; type: { vec: { array: ['u64', 2] } } },
          { name: 'asks'; type: { vec: { array: ['u64', 2] } } },
          { name: 'sequenceNumber'; type: 'u64' }
        ];
      };
    },
    {
      name: 'OrderSide';
      type: {
        kind: 'enum';
        variants: [{ name: 'Bid' }, { name: 'Ask' }];
      };
    },
    {
      name: 'OrderType';
      type: {
        kind: 'enum';
        variants: [{ name: 'Limit' }, { name: 'Market' }];
      };
    }
  ];
  events: [
    {
      name: 'TradeSettled';
      fields: [
        { name: 'takerOrderId'; type: 'u64'; index: false },
        { name: 'makerOrderId'; type: 'u64'; index: false },
        { name: 'taker'; type: 'publicKey'; index: false },
        { name: 'maker'; type: 'publicKey'; index: false },
        { name: 'price'; type: 'u64'; index: false },
        { name: 'quantity'; type: 'u64'; index: false },
        { name: 'timestamp'; type: 'i64'; index: false }
      ];
    }
  ];
  errors: [
    { code: 6000; name: 'InvalidPrice'; msg: 'Invalid price' },
    { code: 6001; name: 'InvalidQuantity'; msg: 'Invalid quantity' },
    { code: 6002; name: 'OrderSizeBelowMinimum'; msg: 'Order size below minimum' },
    { code: 6003; name: 'PriceNotAlignedToTickSize'; msg: 'Price not aligned to tick size' },
    { code: 6004; name: 'OrderbookPaused'; msg: 'Orderbook is paused' },
    { code: 6005; name: 'InsufficientBalance'; msg: 'Insufficient balance' },
    { code: 6006; name: 'Unauthorized'; msg: 'Unauthorized' },
    { code: 6007; name: 'InvalidAuthority'; msg: 'Invalid authority' },
    { code: 6008; name: 'SlippageExceeded'; msg: 'Slippage tolerance exceeded' }
  ];
}

// TypeScript interfaces for the contract data structures
export interface OrderBook {
  authority: PublicKey;
  baseMint: PublicKey;
  quoteMint: PublicKey;
  tickSize: BN;
  minOrderSize: BN;
  totalVolume: BN;
  isInitialized: number;
  isPaused: number;
  padding: number[];
  reserved: number[];
}

export interface UserAccount {
  owner: PublicKey;
  totalVolumeTraded: BN;
  baseTokenBalance: BN;
  quoteTokenBalance: BN;
  isInitialized: number;
  padding: number[];
  reserved: number[];
}

export interface Trade {
  takerOrderId: BN;
  makerOrderId: BN;
  taker: PublicKey;
  maker: PublicKey;
  price: BN;
  quantity: BN;
  takerSide: OrderSide;
  timestamp: BN;
}

export interface Order {
  orderId: BN;
  owner: PublicKey;
  price: BN;
  quantity: BN;
  side: OrderSide;
  orderType: OrderType;
  timestamp: BN;
}

export interface OrderBookSnapshot {
  bids: [BN, BN][];
  asks: [BN, BN][];
  sequenceNumber: BN;
}

export enum OrderSide {
  Bid = 'Bid',
  Ask = 'Ask',
}

export enum OrderType {
  Limit = 'Limit',
  Market = 'Market',
}

export interface TradeSettledEvent {
  takerOrderId: BN;
  makerOrderId: BN;
  taker: PublicKey;
  maker: PublicKey;
  price: BN;
  quantity: BN;
  timestamp: BN;
}