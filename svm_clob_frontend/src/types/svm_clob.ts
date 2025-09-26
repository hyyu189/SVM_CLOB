import { PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';

/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 * 
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `src/idl/svm_clob.json`.
 */
export type SvmClobIDL = {
  "version": "0.1.0",
  "name": "svm_clob",
  "constants": [
    {
      "name": "ORDERBOOK_ACCOUNT_SIZE",
      "type": "usize",
      "value": "8 + std::mem::size_of::<OrderBook>()"
    },
    {
      "name": "USER_ACCOUNT_SIZE", 
      "type": "usize",
      "value": "8 + std::mem::size_of::<UserAccount>()"
    }
  ],
  "instructions": [
    {
      "name": "initializeOrderbook",
      "discriminator": [175, 175, 109, 31, 13, 152, 155, 237],
      "accounts": [
        {
          "name": "orderbook",
          "writable": true,
          "signer": false,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [111, 114, 100, 101, 114, 98, 111, 111, 107]
              },
              {
                "kind": "account",
                "path": "base_mint"
              },
              {
                "kind": "account",
                "path": "quote_mint"
              }
            ]
          }
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "baseMint",
          "writable": false,
          "signer": false
        },
        {
          "name": "quoteMint",
          "writable": false,
          "signer": false
        },
        {
          "name": "systemProgram",
          "writable": false,
          "signer": false,
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "baseMint",
          "type": "publicKey"
        },
        {
          "name": "quoteMint",
          "type": "publicKey"
        },
        {
          "name": "tickSize",
          "type": "u64"
        },
        {
          "name": "minOrderSize",
          "type": "u64"
        },
        {
          "name": "authority",
          "type": "publicKey"
        }
      ]
    },
    {
      "name": "initializeUserAccount",
      "discriminator": [111, 17, 185, 250, 60, 122, 38, 254],
      "accounts": [
        {
          "name": "userAccount",
          "writable": true,
          "signer": false,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [117, 115, 101, 114, 95, 97, 99, 99, 111, 117, 110, 116]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "writable": false,
          "signer": false,
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "executeTrade",
      "discriminator": [134, 180, 134, 180, 134, 180, 134, 180],
      "accounts": [
        {
          "name": "orderbook",
          "writable": true,
          "signer": false
        },
        {
          "name": "takerUserAccount",
          "writable": true,
          "signer": false
        },
        {
          "name": "makerUserAccount",
          "writable": true,
          "signer": false
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        }
      ],
      "args": [
        {
          "name": "trade",
          "type": {
            "defined": "Trade"
          }
        }
      ]
    },
    {
      "name": "deposit",
      "discriminator": [242, 35, 198, 137, 82, 225, 242, 182],
      "accounts": [
        {
          "name": "orderbook",
          "writable": false,
          "signer": false
        },
        {
          "name": "userAccount",
          "writable": true,
          "signer": false
        },
        {
          "name": "userTokenAccount",
          "writable": true,
          "signer": false
        },
        {
          "name": "tokenMint",
          "writable": false,
          "signer": false
        },
        {
          "name": "clobTokenVault",
          "writable": true,
          "signer": false,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [99, 108, 111, 98, 95, 118, 97, 117, 108, 116]
              },
              {
                "kind": "account",
                "path": "token_mint"
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenProgram",
          "writable": false,
          "signer": false,
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "writable": false,
          "signer": false,
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "rent",
          "writable": false,
          "signer": false,
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "withdraw",
      "discriminator": [183, 18, 70, 156, 148, 109, 161, 34],
      "accounts": [
        {
          "name": "orderbook",
          "writable": false,
          "signer": false
        },
        {
          "name": "userAccount",
          "writable": true,
          "signer": false
        },
        {
          "name": "userTokenAccount",
          "writable": true,
          "signer": false
        },
        {
          "name": "tokenMint",
          "writable": false,
          "signer": false
        },
        {
          "name": "clobTokenVault",
          "writable": true,
          "signer": false,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [99, 108, 111, 98, 95, 118, 97, 117, 108, 116]
              },
              {
                "kind": "account",
                "path": "token_mint"
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenProgram",
          "writable": false,
          "signer": false,
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "OrderBook",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "publicKey"
          },
          {
            "name": "baseMint",
            "type": "publicKey"
          },
          {
            "name": "quoteMint",
            "type": "publicKey"
          },
          {
            "name": "tickSize",
            "type": "u64"
          },
          {
            "name": "minOrderSize",
            "type": "u64"
          },
          {
            "name": "totalVolume",
            "type": "u64"
          },
          {
            "name": "isInitialized",
            "type": "u8"
          },
          {
            "name": "isPaused",
            "type": "u8"
          },
          {
            "name": "padding",
            "type": {
              "array": [
                "u8",
                6
              ]
            }
          },
          {
            "name": "reserved",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "UserAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "publicKey"
          },
          {
            "name": "totalVolumeTraded",
            "type": "u64"
          },
          {
            "name": "baseTokenBalance",
            "type": "u64"
          },
          {
            "name": "quoteTokenBalance",
            "type": "u64"
          },
          {
            "name": "isInitialized",
            "type": "u8"
          },
          {
            "name": "padding",
            "type": {
              "array": [
                "u8",
                7
              ]
            }
          },
          {
            "name": "reserved",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    }
  ],
  "types": [
    {
      "name": "Trade",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "takerOrderId",
            "type": "u64"
          },
          {
            "name": "makerOrderId",
            "type": "u64"
          },
          {
            "name": "taker",
            "type": "publicKey"
          },
          {
            "name": "maker",
            "type": "publicKey"
          },
          {
            "name": "price",
            "type": "u64"
          },
          {
            "name": "quantity",
            "type": "u64"
          },
          {
            "name": "takerSide",
            "type": {
              "defined": "OrderSide"
            }
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "Order",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "orderId",
            "type": "u64"
          },
          {
            "name": "owner",
            "type": "publicKey"
          },
          {
            "name": "price",
            "type": "u64"
          },
          {
            "name": "quantity",
            "type": "u64"
          },
          {
            "name": "side",
            "type": {
              "defined": "OrderSide"
            }
          },
          {
            "name": "orderType",
            "type": {
              "defined": "OrderType"
            }
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "OrderBookSnapshot",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bids",
            "type": {
              "vec": {
                "array": [
                  "u64",
                  2
                ]
              }
            }
          },
          {
            "name": "asks",
            "type": {
              "vec": {
                "array": [
                  "u64",
                  2
                ]
              }
            }
          },
          {
            "name": "sequenceNumber",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "OrderSide",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Bid"
          },
          {
            "name": "Ask"
          }
        ]
      }
    },
    {
      "name": "OrderType",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Limit"
          },
          {
            "name": "Market"
          }
        ]
      }
    }
  ],
  "events": [
    {
      "name": "TradeSettled",
      "fields": [
        {
          "name": "takerOrderId",
          "type": "u64",
          "index": false
        },
        {
          "name": "makerOrderId",
          "type": "u64",
          "index": false
        },
        {
          "name": "taker",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "maker",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "price",
          "type": "u64",
          "index": false
        },
        {
          "name": "quantity",
          "type": "u64",
          "index": false
        },
        {
          "name": "timestamp",
          "type": "i64",
          "index": false
        }
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "InvalidPrice",
      "msg": "Invalid price"
    },
    {
      "code": 6001,
      "name": "InvalidQuantity",
      "msg": "Invalid quantity"
    },
    {
      "code": 6002,
      "name": "OrderSizeBelowMinimum",
      "msg": "Order size below minimum"
    },
    {
      "code": 6003,
      "name": "PriceNotAlignedToTickSize",
      "msg": "Price not aligned to tick size"
    },
    {
      "code": 6004,
      "name": "OrderbookPaused",
      "msg": "Orderbook is paused"
    },
    {
      "code": 6005,
      "name": "InsufficientBalance",
      "msg": "Insufficient balance"
    },
    {
      "code": 6006,
      "name": "Unauthorized",
      "msg": "Unauthorized"
    },
    {
      "code": 6007,
      "name": "InvalidAuthority",
      "msg": "Invalid authority"
    },
    {
      "code": 6008,
      "name": "SlippageExceeded",
      "msg": "Slippage tolerance exceeded"
    }
  ]
};

// Export types derived from IDL
export type SvmClob = SvmClobIDL;

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

// Enums matching the Rust contract
export enum OrderSide {
  Bid = "Bid",
  Ask = "Ask",
}

export enum OrderType {
  Limit = "Limit",
  Market = "Market",
  PostOnly = "PostOnly",
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

// Helper types for the frontend
export interface OrderBookLevel {
  price: number;
  quantity: number;
  total?: number;
}

export interface PlaceOrderParams {
  side: OrderSide;
  orderType: OrderType;
  price: number;
  quantity: number;
}

export interface DepositParams {
  tokenMint: PublicKey;
  amount: BN;
}

export interface WithdrawParams {
  tokenMint: PublicKey;
  amount: BN;
}

// Program constants
export const PROGRAM_ID = new PublicKey('7YtJ5eYw1am3m73Yw2sh1QPWek3Ux17Ju1tp263h7YJB');

// Seeds for PDA derivation
export const ORDERBOOK_SEED = 'orderbook';
export const USER_ACCOUNT_SEED = 'user_account';
export const CLOB_VAULT_SEED = 'clob_vault';

// Error codes from the contract
export enum ClobErrorCode {
  InvalidPrice = 6000,
  InvalidQuantity = 6001,
  OrderSizeBelowMinimum = 6002,
  PriceNotAlignedToTickSize = 6003,
  OrderbookPaused = 6004,
  InsufficientBalance = 6005,
  Unauthorized = 6006,
  InvalidAuthority = 6007,
  SlippageExceeded = 6008,
}