# SVM CLOB Frontend

A React-based frontend for the SVM (Solana Virtual Machine) Central Limit Order Book trading application.

## Features

- 🔗 **Live Sol/USDC Integration**: Renders real order book, trade tape, and stats from the `svm_clob_infra` REST + WebSocket services
- 🚨 **Connection Awareness**: Prominent API/WebSocket status banners instead of silent mock data
- 📱 **Responsive Trading Dashboard**: Advanced layout with order entry, book heat-map, trade history, balances, and charting
- 🔐 **Wallet Integration**: Solana wallet adapter with Anchor client scaffolding for deposits/withdrawals
- ⚡ **Real-Time Streams**: WebSocket subscriptions for order book depth, trade executions, and user order updates

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- For real trading: `svm_clob_infra` backend running on localhost:8080/8081

### Installation

```bash
npm install
```

### Development

Start the Vite dev server (expects the Rust infra on localhost by default):

```bash
npm run dev
```

If the backend is unreachable the UI will stay empty and surface a red **Backend API unreachable** banner so you can diagnose connectivity.

### Production Build

#### For Demo/Testing (with mock data)
```bash
npm run build:mock
```

#### For Production (with real backend)
```bash
npm run build:production
```

### Preview Built Application
```bash
npm run preview
```

## Configuration

### Environment Variables

Copy `.env.example` to `.env.local` and configure the endpoints that serve real data:

```env
# Backend API Configuration
VITE_API_BASE_URL=http://localhost:8080/api/v1
VITE_WS_BASE_URL=ws://localhost:8081/ws

# Optional: enable legacy mock mode (not used for investor demo)
VITE_USE_MOCK_API=false

# Solana Configuration
VITE_SOLANA_RPC_URL=https://api.devnet.solana.com
VITE_SOLANA_NETWORK=devnet
```

### Available Scripts

- `npm run dev` – Start development server (requires backend)
- `npm run dev:mock` – Legacy mock mode for isolated UI work
- `npm run build` – Production build against live endpoints
- `npm run build:production` – Convenience alias for CI/CD
- `npm run type-check` – TypeScript type checking
- `npm run lint` – Lint code
- `npm run preview` – Preview built application

## Architecture

### Service Layer

The application uses a resilient service architecture:

1. **ResilientApiService**: Calls REST endpoints and surfaces explicit offline errors (no synthetic data)
2. **ResilientWebSocketService**: Manages subscriptions with auto-reconnect and status messages
3. **Service Factory**: Chooses live or mock implementations based on `VITE_USE_MOCK_API`

### Key Components

- **TradingDashboard**: Main trading interface with order book and charts
- **WalletConnection**: Solana wallet integration with balance display
- **OrderBook**: Real-time order book visualization
- **MarketDataWidget**: Market statistics and price information
- **PriceChart**: Interactive price charts with multiple timeframes

### Backend Integration

The frontend is designed to work with the `svm_clob_infra` backend:

- **REST API**: Port 8080 for order management and market data
- **WebSocket**: Port 8081 for real-time updates
- **Connection Signals**: UI conveys when endpoints or sockets are offline instead of fabricating data

## Troubleshooting

### Blank States / No Data

1. Confirm `npm run dev` logs show successful fetches (no `BACKEND_OFFLINE` errors)
2. Verify the REST API is reachable at `VITE_API_BASE_URL`
3. Check the WebSocket endpoint send/receive in browser dev tools
4. Use the red/yellow status banners at the top of the Trade page as guidance

### Backend Connection Issues

1. Ensure `svm_clob_infra` REST (port 8080) and WebSocket (port 8081) services are online
2. If hosting elsewhere, update `VITE_API_BASE_URL` and `VITE_WS_BASE_URL`
3. Confirm CORS and firewall rules allow the browser to reach the services

### Wallet Issues

1. Try different wallet adapters (Phantom, Solflare, etc.)
2. Check network setting matches wallet (devnet)
3. Clear browser cache and wallet connections

## Development Tips

1. **Run the Rust infra locally** when demoing to investors so every widget loads real data
2. **Type check** with `npm run type-check` before committing changes
3. **Lint the code** via `npm run lint` to keep styling consistent
4. **Only use mock mode** when intentionally working without backend dependencies

## Production Deployment

1. Build the application:
   ```bash
   npm run build:production
   ```

2. Deploy the `dist/` folder to your web server

3. Configure environment variables for production backend URLs

4. Ensure CORS is properly configured on your backend

## License

This project is part of the SVM CLOB trading system.
