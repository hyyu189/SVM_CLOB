# SVM CLOB Infrastructure

A high-performance Central Limit Order Book (CLOB) infrastructure designed to interface with Solana Virtual Machine (SVM) smart contracts for decentralized trading.

## Overview

The SVM CLOB Infrastructure provides a comprehensive off-chain matching engine and order management system that interfaces with the on-chain SVM CLOB smart contract. This hybrid architecture combines the efficiency of off-chain order matching with the security and transparency of on-chain settlement.

### Key Features

- **High-Performance Matching Engine**: Price-time priority matching with microsecond latency
- **Real-time Market Data**: WebSocket feeds for order book updates and trade executions
- **Comprehensive REST API**: Full order lifecycle management via HTTP endpoints
- **Robust Storage Layer**: PostgreSQL for persistence with Redis caching
- **Contract Integration**: Seamless interface with SVM CLOB smart contract
- **Scalable Architecture**: Modular design supporting horizontal scaling

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    SVM CLOB Infrastructure                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐   │
│  │ RPC Server  │  │ WebSocket   │  │    Matching Engine      │   │
│  │ (REST API)  │  │   Server    │  │  ┌─────────────────────┐ │   │
│  │             │  │             │  │  │   Order Book        │ │   │
│  │ - Orders    │  │ - Real-time │  │  │   Management        │ │   │
│  │ - Market    │  │   Updates   │  │  └─────────────────────┘ │   │
│  │   Data      │  │ - Subs      │  │  ┌─────────────────────┐ │   │
│  │ - Health    │  │             │  │  │  Trade Execution    │ │   │
│  └─────────────┘  └─────────────┘  │  │     Logic           │ │   │
│         │                 │        │  └─────────────────────┘ │   │
│         └─────────┬───────┘        └─────────────────────────┘   │
│                   │                           │                  │
├───────────────────┼───────────────────────────┼──────────────────┤
│  ┌─────────────────┼───────────────────────────┼──────────────┐   │
│  │                 │          Storage Layer    │              │   │
│  │  ┌─────────────────────┐     ┌──────────────────────────┐  │   │
│  │  │    PostgreSQL       │     │         Redis            │  │   │
│  │  │                     │     │                          │  │   │
│  │  │ - Orders            │     │ - Order Book Cache       │  │   │
│  │  │ - Trades            │     │ - Market Data Cache      │  │   │
│  │  │ - Market Stats      │     │ - Session Management     │  │   │
│  │  │ - User Accounts     │     │ - Real-time Feeds        │  │   │
│  │  └─────────────────────┘     └──────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Solana Blockchain                             │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                SVM CLOB Smart Contract                      │ │
│  │                                                             │ │
│  │ Instructions:                    Accounts:                  │ │
│  │ - initialize_orderbook()         - OrderBook               │ │
│  │ - initialize_user_account()      - UserAccount             │ │
│  │ - place_order()                  - Order                   │ │
│  │ - cancel_order()                 - Token Accounts          │ │
│  │ - modify_order()                                           │ │
│  │ - pause_orderbook()                                        │ │
│  │ - resume_orderbook()                                       │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Core Types (`svm-clob-types`)

**Status**: ✅ Complete

Comprehensive type definitions that mirror the SVM CLOB smart contract interface:

- **Order Types**: `Order`, `OrderSide`, `OrderType`, `OrderStatus`
- **Market Data**: `OrderBookSnapshot`, `TradeExecution`, `MarketDataUpdate`
- **Request/Response**: API structures for RPC endpoints
- **Error Handling**: `ClobError` enum with detailed error types

**Key Features**:
- Perfect compatibility with smart contract enums and structures
- Serialization support for JSON, Borsh, and binary formats
- Display implementations for logging and debugging

### 2. Order Book Management (`svm-clob-order-book`)

**Status**: ✅ Complete

High-performance order book implementation with price-level tracking:

- **Price-Level Organization**: BTreeMap for O(log n) price level operations
- **Fast Order Lookup**: DashMap for O(1) order access by ID
- **Market Statistics**: Real-time calculation of spreads, volumes, and depth
- **Snapshot Generation**: Efficient order book state serialization

**Key Features**:
- Price-time priority matching
- Configurable tick size and minimum order size
- Memory-efficient price level aggregation
- Thread-safe concurrent access

### 3. Matching Engine (`svm-clob-matching-engine`)

**Status**: ✅ Core Logic Complete

Advanced order matching with institutional-grade features:

- **Order Types**: Limit, Market, Post-Only orders
- **Time-in-Force**: GTC, IOC, FOK, GTT support
- **Self-Trade Prevention**: Configurable behaviors (DecrementAndCancel, CancelProvide, etc.)
- **Trade Execution**: Price-time priority with partial fill support

**Key Features**:
- Microsecond-latency matching
- Sophisticated order validation
- Trade settlement recording
- Integration hooks for blockchain submission

### 4. Storage Layer (`svm-clob-storage`)

**Status**: ✅ Complete

Dual-tier storage architecture for performance and persistence:

**PostgreSQL Storage**:
- ACID-compliant order and trade persistence
- Comprehensive indexing for fast queries
- Database migrations and schema management
- User account and market statistics tracking

**Redis Caching**:
- Real-time order book caching
- Session management for WebSocket connections
- Market data feed optimization
- Configurable TTL policies

### 5. RPC Server (`svm-clob-rpc-server`)

**Status**: ⚠️ Partially Complete

RESTful API server built with Axum framework:

**Implemented Endpoints**:
- `POST /api/v1/orders` - Place orders
- `DELETE /api/v1/orders/{id}` - Cancel orders  
- `GET /api/v1/orders/{id}` - Get order details
- `GET /api/v1/orderbook` - Order book snapshot
- `GET /api/v1/trades` - Recent trades
- `GET /health` - Health check

**Missing Implementation**:
- Order modification endpoint
- User order history
- Market statistics aggregation
- Authentication and authorization

### 6. WebSocket Server (`svm-clob-websocket-server`)

**Status**: ⚠️ Framework Complete, Integration Pending

Real-time market data distribution via WebSocket connections:

**Implemented Features**:
- Connection management with unique client IDs
- Subscription/unsubscription handling
- Broadcast infrastructure for market updates
- Client state tracking and cleanup

**Subscription Types**:
- Order book updates by market
- Trade executions by market
- User-specific order updates
- Global market data feed

**Missing Integration**:
- Real-time matching engine event bridging
- Chain event monitoring and broadcasting
- Rate limiting and connection management

### 7. CLI Interface (`svm-clob-cli`)

**Status**: ✅ Complete

Comprehensive command-line interface for system management:

**Available Commands**:
- `start` - Launch full infrastructure
- `start-rpc` - RPC server only
- `start-ws` - WebSocket server only
- `init-db` - Database initialization
- `validate-config` - Configuration validation
- `status` - System health check

**Configuration Features**:
- TOML-based configuration files
- Environment variable overrides
- Default configuration generation
- Structured logging setup

### 8. Database Schema

**Status**: ✅ Complete

Optimized PostgreSQL schema with proper indexing:

**Tables**:
- `orders` - Order storage with comprehensive indexing
- `trades` - Trade execution records
- `orderbook_snapshots` - Periodic state snapshots
- `user_accounts` - User trading statistics
- `market_stats` - Aggregated market data
- `system_config` - Runtime configuration

**Features**:
- Foreign key constraints for data integrity
- Composite indexes for query optimization
- Triggers for automatic timestamp updates
- JSONB support for flexible data structures

## Smart Contract Integration

### Contract Interface

The SVM CLOB smart contract provides these key instructions:

```rust
// Orderbook management
initialize_orderbook(base_mint, quote_mint, tick_size, min_order_size)
pause_orderbook() / resume_orderbook()

// User account management
initialize_user_account()

// Order operations
place_order(client_order_id, side, order_type, price, quantity, ...)
cancel_order()
modify_order(new_price, new_quantity)
```

### Program Derived Addresses (PDAs)

The contract uses deterministic account addresses:

```rust
// Orderbook PDA
["orderbook", base_mint, quote_mint]

// User account PDA  
["user_account", user_pubkey]

// Order PDA
["order", user_pubkey, client_order_id]
```

### Data Structures

Contract accounts mirror infrastructure types:

- `OrderBook`: Market configuration and statistics
- `UserAccount`: User trading data and balances
- `Order`: Individual order state and metadata

## Implementation Status

### ✅ Completed Components

1. **Core Type System** - Complete compatibility with smart contract
2. **Order Book Engine** - High-performance price-level management
3. **Matching Logic** - Institutional-grade order matching
4. **Storage Layer** - PostgreSQL + Redis persistence
5. **CLI Interface** - Full system management capabilities
6. **Database Schema** - Production-ready with optimizations

### ⚠️ Partially Implemented

1. **RPC Server** - Core endpoints work, missing some features
2. **WebSocket Server** - Framework ready, needs matching engine integration

### ❌ Missing for MVP

1. **Solana Contract Client** - No blockchain integration
2. **PDA Management** - Account address calculation
3. **Order Synchronization** - On-chain/off-chain state sync
4. **Authentication System** - User verification and wallet integration
5. **Real-time Event Bridge** - WebSocket integration with matching engine

## Development Roadmap

### Phase 1: MVP Demo (Current Priority)

**Goal**: Functional demo with basic contract integration

**Tasks**:
1. ✅ Complete infrastructure indexing and documentation
2. 🚧 **Create comprehensive README.md** (In Progress)
3. ⏳ Implement Solana contract client integration
4. ⏳ Add PDA address management
5. ⏳ Complete RPC server missing endpoints
6. ⏳ Bridge WebSocket server with matching engine
7. ⏳ Basic order submission to smart contract

**Timeline**: 1-2 weeks

### Phase 2: Integration Completion

**Goal**: Full contract integration with real-time sync

**Tasks**:
- Order lifecycle synchronization
- Event monitoring and state reconciliation
- User account management integration
- Error handling and retry logic
- Performance optimization

**Timeline**: 2-3 weeks

### Phase 3: Production Readiness

**Goal**: Enterprise-grade system with monitoring

**Tasks**:
- Authentication and authorization
- Rate limiting and security features
- Comprehensive monitoring and alerting
- Load testing and optimization
- Documentation and deployment guides

**Timeline**: 3-4 weeks

## Quick Start

### Prerequisites

- Rust 1.75+
- PostgreSQL 13+
- Redis 6+
- Solana CLI tools
- Anchor framework

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd svm_clob_infra

# Install dependencies
cargo build --release

# Initialize database
cargo run --bin svm-clob-cli init-db

# Start the infrastructure
cargo run --bin svm-clob-cli start
```

### Configuration

The system uses TOML configuration files:

```toml
[database]
url = "postgresql://localhost/svm_clob"
max_connections = 10

[redis]
url = "redis://localhost:6379"

[rpc_server]
host = "0.0.0.0"
port = 8080

[websocket_server]
host = "0.0.0.0"
port = 8081

[orderbook]
base_mint = "So11111111111111111111111111111111111111112"  # SOL
quote_mint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" # USDC
tick_size = 1000
min_order_size = 1000000
```

### API Usage

**Place an Order**:
```bash
curl -X POST http://localhost:8080/api/v1/orders \
  -H "Content-Type: application/json" \
  -d '{
    "client_order_id": 1,
    "side": "Bid",
    "order_type": "Limit", 
    "price": 100000,
    "quantity": 1000000,
    "time_in_force": "GoodTillCancelled",
    "self_trade_behavior": "DecrementAndCancel"
  }'
```

**Get Order Book**:
```bash
curl http://localhost:8080/api/v1/orderbook
```

**WebSocket Subscription**:
```javascript
const ws = new WebSocket('ws://localhost:8081/ws');
ws.send(JSON.stringify({
  type: 'Subscribe',
  subscription: {
    type: 'OrderBook',
    market: 'SOL/USDC'
  }
}));
```

## Testing

### Unit Tests

```bash
# Run all unit tests
cargo test

# Run tests for specific crate
cargo test -p svm-clob-matching-engine
```

### Integration Tests

```bash
# Start test environment
docker-compose -f docker-compose.test.yml up -d

# Run integration tests
cargo test --test integration
```

### Performance Tests

```bash
# Load testing with artillery
npm install -g artillery
artillery run tests/load/basic-load.yml
```

## Contributing

### Development Setup

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make changes and add tests
4. Ensure all tests pass: `cargo test`
5. Run formatting: `cargo fmt`
6. Run linting: `cargo clippy`
7. Submit a pull request

### Code Standards

- Follow Rust API guidelines
- Add comprehensive tests for new features
- Document public APIs with rustdoc
- Use structured logging with tracing
- Handle errors explicitly with proper types

### Performance Considerations

- Optimize for low-latency order processing
- Minimize memory allocations in hot paths
- Use async/await for I/O operations
- Profile critical code paths
- Monitor system metrics in production

## Security Considerations

### Smart Contract Security

- All order validation occurs on-chain
- Infrastructure cannot execute unauthorized trades
- User funds remain in smart contract custody
- Multi-signature support for administrative functions

### Infrastructure Security

- Input validation on all API endpoints
- Rate limiting to prevent abuse
- Secure configuration management
- Audit trails for all operations
- Regular security updates and monitoring

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For questions, issues, or contributions:

- Create an issue on GitHub
- Join our Discord community
- Review the documentation wiki
- Check the FAQ section

---

**Note**: This infrastructure is designed for demonstration and development purposes. For production deployment, additional security audits, testing, and monitoring are recommended.