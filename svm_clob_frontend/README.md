# SVM CLOB Frontend

A React-based frontend for the SVM (Solana Virtual Machine) Central Limit Order Book trading application.

## Features

- 🔗 **Real API Integration**: Connects to `svm_clob_infra` backend infrastructure
- 🔄 **Resilient Architecture**: Works with or without backend availability
- 🧪 **Mock Data Support**: Fallback to mock data when backend is offline
- 📱 **Responsive Design**: Modern trading dashboard with real-time updates
- 🔐 **Wallet Integration**: Solana wallet adapter with multiple wallet support
- ⚡ **WebSocket Support**: Real-time market data and order book updates

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- For real trading: `svm_clob_infra` backend running on localhost:8080/8081

### Installation

```bash
npm install
```

### Development

#### Option 1: With Mock Data (Recommended for development)
```bash
npm run dev:mock
```
This runs the frontend with mock data, perfect when the backend isn't available.

#### Option 2: With Real Backend
```bash
npm run dev:real
```
Connects to the real `svm_clob_infra` backend. Requires backend to be running.

#### Option 3: Default Development
```bash
npm run dev
```
Uses `.env.development` settings (defaults to mock data).

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

Copy `.env.example` to `.env.local` and configure:

```env
# Backend API Configuration
VITE_API_BASE_URL=http://localhost:8080/api/v1
VITE_WS_BASE_URL=ws://localhost:8081/ws

# Development Mode (use mock data instead of real API)
VITE_USE_MOCK_API=false

# Solana Configuration
VITE_SOLANA_RPC_URL=https://api.devnet.solana.com
VITE_SOLANA_NETWORK=devnet
```

### Available Scripts

- `npm run dev` - Start development server
- `npm run dev:mock` - Development with mock data
- `npm run dev:real` - Development with real backend
- `npm run build` - Production build
- `npm run build:mock` - Build with mock data
- `npm run build:production` - Build for production
- `npm run type-check` - TypeScript type checking
- `npm run lint` - Lint code
- `npm run preview` - Preview built application

## Architecture

### Service Layer

The application uses a resilient service architecture:

1. **ResilientApiService**: Automatically handles backend unavailability with fallback data
2. **ResilientWebSocketService**: WebSocket connections with automatic reconnection
3. **Service Factory**: Switches between real and mock services based on configuration

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
- **Automatic Fallback**: Gracefully degrades when backend is unavailable

## Troubleshooting

### Black Screen Issues

1. Check browser console for JavaScript errors
2. Verify wallet connections aren't blocking
3. Try running with mock data: `npm run dev:mock`

### Backend Connection Issues

1. Ensure `svm_clob_infra` is running on correct ports
2. Check CORS settings if running on different domains
3. Use mock mode for development: `VITE_USE_MOCK_API=true`

### Wallet Issues

1. Try different wallet adapters (Phantom, Solflare, etc.)
2. Check network setting matches wallet (devnet)
3. Clear browser cache and wallet connections

## Development Tips

1. **Use Mock Mode First**: Always test with `npm run dev:mock` to ensure frontend works independently
2. **Check TypeScript**: Run `npm run type-check` before committing
3. **Lint Code**: Use `npm run lint` to maintain code quality
4. **Test Both Modes**: Verify both mock and real API modes work

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