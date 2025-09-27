# SVM CLOB Project

A high-performance Central Limit Order Book (CLOB) implementation on the Solana Virtual Machine (SVM) using a hybrid on-chain/off-chain architecture.

## Project Structure

This repository contains two main modules:

### [svm_clob](./svm_clob/README.md)
The on-chain Solana program built with the Anchor framework. This module handles:
- Order book initialization
- User account management
- Trade settlement and execution
- Token deposits and withdrawals

**Current Status**: ✅ Deployed on Solana Devnet
- Program ID: `JBphRWHYzHCiVvYB89vGM9NpaDmHbe1A9W156sRV52Bo`

### [svm_clob_infra](./svm_clob_infra/README.md)
The off-chain infrastructure system providing:
- High-performance matching engine
- REST API server
- WebSocket real-time feeds
- PostgreSQL + Redis storage
- CLI management tools

**Current Status**: ⚠️ Core components complete, integration in progress

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    SVM CLOB Architecture                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                Off-Chain Infrastructure                     │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │ │
│  │  │ RPC Server  │  │ WebSocket   │  │  Matching Engine    │ │ │
│  │  │ (REST API)  │  │   Server    │  │                     │ │ │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘ │ │
│  │                           │                                │ │
│  │  ┌─────────────────────────────────────────────────────┐   │ │
│  │  │              Storage Layer                          │   │ │
│  │  │  ┌─────────────────┐     ┌─────────────────────┐   │   │ │
│  │  │  │   PostgreSQL    │     │       Redis         │   │   │ │
│  │  │  └─────────────────┘     └─────────────────────┘   │   │ │
│  │  └─────────────────────────────────────────────────────┘   │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                   │                              │
│                                   ▼                              │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                 Solana Blockchain                           │ │
│  │  ┌─────────────────────────────────────────────────────────┐│ │
│  │  │              SVM CLOB Smart Contract                   ││ │
│  │  │                                                        ││ │
│  │  │  • Trade Settlement      • User Account Management    ││ │
│  │  │  • Token Custody         • Order Book Initialization ││ │
│  │  └─────────────────────────────────────────────────────────┘│ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Key Features

- **Hybrid Architecture**: Off-chain matching for speed, on-chain settlement for security
- **High Performance**: Microsecond-latency order matching with institutional-grade features
- **Solana Native**: Built with Anchor framework, integrates with SPL Token Program
- **Real-time Data**: WebSocket feeds for order book updates and trade executions
- **Comprehensive API**: RESTful endpoints for complete order lifecycle management
- **Production Ready**: PostgreSQL persistence, Redis caching, robust error handling

## Getting Started

### Prerequisites
- Rust 1.75+
- Node.js 18+
- PostgreSQL 13+
- Redis 6+
- Solana CLI tools
- Anchor framework

### Quick Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd SVM_CLOB
   ```

2. **Set up the on-chain program**
   ```bash
   cd svm_clob
   anchor build
   anchor test
   ```

3. **Set up the infrastructure**
   ```bash
   cd ../svm_clob_infra
   cargo build --release
   cargo run --bin svm-clob-cli init-db
   cargo run --bin svm-clob-cli start
   ```

## Development Status

### ✅ Completed
- On-chain program with trade settlement
- Core infrastructure components (types, order book, matching engine)
- Storage layer (PostgreSQL + Redis)
- CLI management interface
- Database schema and migrations

### 🚧 In Progress
- Solana contract client integration
- Real-time WebSocket event bridging
- Complete RPC server endpoints

### ⏳ Planned
- Authentication and authorization system
- Production monitoring and alerting
- Load balancing and horizontal scaling
- Comprehensive test suites

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make changes and add tests
4. Ensure all tests pass: `cargo test && anchor test`
5. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.