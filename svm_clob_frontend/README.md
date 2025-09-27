# SVM CLOB Frontend

Responsive Sol/USDC trading terminal built with Vite, React 19, Zustand, and Solana wallet adapter. The app now exposes three polished screens:

1. **Landing** – telemetry sidebar, feature grid, and architecture overview
2. **Trade** – three-column control room (market data + order book + trading form)
3. **Dashboard** – portfolio summary, live balances, trade history, and account controls

## Getting Started

```bash
cd svm_clob_frontend
npm install
npm run dev                # expects backend at http://localhost:8080 / ws://localhost:8081
```

### Mock Mode (no backend required)
```
VITE_USE_MOCK_API=true npm run dev
```
This feeds deterministic mock data into every widget while keeping the REST/WebSocket code paths intact.

## Environment Variables
| Variable | Description | Default |
| --- | --- | --- |
| `VITE_USE_MOCK_API` | `true` to serve mock data, `false` to hit live endpoints | `false` |
| `VITE_API_BASE_URL` | REST base URL (e.g. `https://infra/api/v1`) | `http://localhost:8080/api/v1` |
| `VITE_WS_BASE_URL` | WebSocket endpoint (e.g. `wss://infra/ws`) | `ws://localhost:8081/ws` |
| `VITE_SOLANA_RPC_URL` | RPC URL for wallet connection | `https://api.devnet.solana.com` |
| `VITE_SOLANA_NETWORK` | Cluster label – `devnet`, `mainnet-beta`, etc. | `devnet` |

The entry point (`src/main.tsx`) polyfills `Buffer`/`process` so wallet adapters work in browsers and Vercel.

## Build & Deploy
```bash
npm run build              # outputs to dist/
npm run preview            # serve the production build locally
```
On Vercel/GitHub Pages set the environment variables above before running `npm run build`.

## UI Overview
- **Connectivity banners** – surface `BACKEND_OFFLINE` / WebSocket disconnect states instead of fallback data.
- **Order book** – aggregated levels with depth shading, click-to-trade, configurable view modes.
- **Price chart** – timeframes 1m→1d, tooltip shows price + volume, updates every 30s.
- **Trading form** – limit/market flow, validation for balances/min size, preview modal, sticky on desktop.
- **Dashboard** – summary cards, token balances, trade history table with explorer links, account controls.

## QA Checklist
- `npm run type-check`
- `npm run build`
- (Optional) `npm run lint` *(legacy code still fails – clean-up tracked separately)*

## Backend Expectations
The UI calls the following contracts when `VITE_USE_MOCK_API=false`:
- REST: `/api/v1/orders`, `/api/v1/orderbook`, `/api/v1/trades`, `/api/v1/market/stats`, `/api/v1/system/markets`, `/api/v1/users/:wallet/{orders,trades,account}`
- WebSocket: `OrderBook`, `Trades`, and `UserOrders` subscriptions; expects `MarketData` + `OrderUpdate` payloads

Until those endpoints respond, run with `VITE_USE_MOCK_API=true` for demos.
