# SVM CLOB Project Workspace

This README provides a comprehensive overview of the SVM CLOB project, including its architecture, features, on-chain functions, and a history of its architectural evolution.

## Project Goal

The primary objective of this project is to build a high-performance, minimally viable central limit order book (CLOB) on the Solana Virtual Machine (SVM). The CLOB is designed to be a core financial primitive, using a hybrid on-chain/off-chain architecture to maximize performance while maintaining the security of on-chain settlement.

## Architecture Overview

The CLOB operates on a hybrid model that separates the responsibilities of order management and settlement:

-   **Off-Chain Components**:
    -   **Order Book Management**: The order book, including the placement and cancellation of orders, is managed by an off-chain authority. This allows for high-speed order processing without the overhead of on-chain transactions for every order modification.
    -   **Matching Engine**: The matching of bids and asks is also handled by the off-chain authority. This enables the use of sophisticated matching algorithms that can operate at very low latencies.

-   **On-Chain Components**:
    -   **Settlement Layer**: The on-chain program, built with the Anchor framework, is responsible for the settlement of trades that have been matched off-chain. This ensures that all fund movements are secure, transparent, and atomic.
    -   **User Account Management**: All user funds are held in on-chain accounts managed by the program. This provides users with self-custody of their assets and the assurance that their funds are secure.

This hybrid architecture provides the best of both worlds: the high performance of an off-chain order book and the security of on-chain settlement.

## Key Features

-   **High Performance**: By moving order management and matching off-chain, the CLOB can handle a high volume of orders with very low latency.
-   **On-Chain Security**: All user funds are managed by the on-chain program, and all trades are settled on-chain, providing a high level of security and transparency.
-   **SPL Token Integration**: The CLOB integrates with the SPL Token Program for all fund management, ensuring compatibility with the broader Solana ecosystem.
-   **Zero-Copy Accounts**: The on-chain program uses `zero-copy` accounts for all primary data structures, which avoids expensive serialization and deserialization overhead and improves performance.
-   **Anchor Framework**: The on-chain program is built with the Anchor framework, which simplifies Solana program development and improves security.

## On-Chain Program Functions

The on-chain program exposes the following functions:

-   `initialize_orderbook`: Initializes a new order book for a given token pair. This can only be called by the designated authority.
-   `initialize_user_account`: Initializes a new on-chain account for a user, which will be used to hold their funds.
-   `execute_trade`: This is the core settlement function. It is called by the off-chain authority after two orders have been matched. The function takes the details of the trade as input and atomically transfers the base and quote tokens between the two user accounts.
-   `deposit`: Allows a user to deposit funds into their on-chain account.
-   `withdraw`: Allows a user to withdraw funds from their on-chain account.

## Refactor History

The project initially began as a fully on-chain CLOB, where all aspects of the order book, including order placement, cancellation, and matching, were handled by the on-chain program. While this approach provided the highest level of decentralization, it was determined that the performance limitations of a fully on-chain system would not be suitable for a high-frequency trading environment.

To address these limitations, the project was refactored to the current hybrid architecture. This involved the following key changes:

-   **Removal of On-Chain Order Management**: The `place_order` and `cancel_order` functions were removed from the on-chain program.
-   **Introduction of Off-Chain API**: A new off-chain API was defined to handle order management and matching. This API is designed to be implemented by a high-performance, off-chain service.
-   **Addition of `execute_trade` Function**: A new `execute_trade` function was added to the on-chain program to handle the settlement of trades that are matched off-chain.

This refactoring has resulted in a more performant and scalable system that is better suited for a real-world trading environment.

## Deployment Information

### Solana Devnet Deployment

The SVM CLOB smart contract is currently deployed on Solana Devnet:

| Property | Value |
|----------|-------|
| **Network** | Solana Devnet |
| **Program ID** | `7YtJ5eYw1am3m73Yw2sh1QPWek3Ux17Ju1tp263h7YJB` |
| **RPC Endpoint** | `https://api.devnet.solana.com` |
| **WebSocket** | `wss://api.devnet.solana.com/` |
| **Upgrade Authority** | `8hkGuNa6k1Xk4fwwHdtDxYtx93knEZJeieFb3LgpacTF` |
| **Deploy Transaction** | `425AQUP4tG126PtC3xitR9ibt6thWZUrSZd78uL8jQVdUavyMe9ZaDi5z3JmtckEhSr5fNNGwvzUTraSVQTYcDkp` |

### Explorer Links

- **Program Account**: https://explorer.solana.com/address/7YtJ5eYw1am3m73Yw2sh1QPWek3Ux17Ju1tp263h7YJB?cluster=devnet
- **Deploy Transaction**: https://explorer.solana.com/tx/425AQUP4tG126PtC3xitR9ibt6thWZUrSZd78uL8jQVdUavyMe9ZaDi5z3JmtckEhSr5fNNGwvzUTraSVQTYcDkp?cluster=devnet

## Frontend Integration

### TypeScript/JavaScript Configuration

```typescript
import { PublicKey, Connection } from '@solana/web3.js';
import { AnchorProvider, Program, Idl } from '@coral-xyz/anchor';

// Program Configuration
export const CLOB_CONFIG = {
  PROGRAM_ID: new PublicKey("7YtJ5eYw1am3m73Uw2sh1QPWek3Ux17Ju1tp263h7YJB"),
  NETWORK: "devnet",
  RPC_URL: "https://api.devnet.solana.com",
  WS_URL: "wss://api.devnet.solana.com/"
};

// Connection Setup
export const connection = new Connection(CLOB_CONFIG.RPC_URL, 'confirmed');

// Program Instance (requires IDL)
// export const program = new Program(idl as Idl, CLOB_CONFIG.PROGRAM_ID, provider);
```

### React Environment Variables

```env
# .env.local
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_CLOB_PROGRAM_ID=7YtJ5eYw1am3m73Uw2sh1QPWek3Ux17Ju1tp263h7YJB
```

### Account Derivation Examples

```typescript
import { PublicKey } from '@solana/web3.js';

// Derive orderbook PDA
export const getOrderbookPDA = (baseMint: PublicKey, quoteMint: PublicKey) => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("orderbook"), baseMint.toBuffer(), quoteMint.toBuffer()],
    CLOB_CONFIG.PROGRAM_ID
  );
};

// Derive user account PDA
export const getUserAccountPDA = (userPubkey: PublicKey) => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("user_account"), userPubkey.toBuffer()],
    CLOB_CONFIG.PROGRAM_ID
  );
};

// Derive token vault PDA
export const getTokenVaultPDA = (mintPubkey: PublicKey) => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("clob_vault"), mintPubkey.toBuffer()],
    CLOB_CONFIG.PROGRAM_ID
  );
};
```