# SVM CLOB

Hybrid Solana CLOB prototype with three workspaces:

| Path | Purpose | Status |
| --- | --- | --- |
| `svm_clob` | Anchor smart contract that holds user funds, runs settlement, PDAs for vaults | ✅ Deployed to devnet (`7YtJ5eYw1am3m73Yw2sh1QPWek3Ux17Ju1tp263h7YJB`) |
| `svm_clob_infra` | Off-chain matching engine, REST API, WebSocket server, storage, CLI | ⚠️ Core crates compile; still missing live endpoints + settlement bridge |
| `svm_clob_frontend` | React/Vite trading terminal (home page, trading desk, user dashboard) | ✅ Fully redesigned; supports live services or mock mode |

## Frontend Progress (March 2026)
- New landing page with telemetry cards, feature grid, and pipeline overview
- Trading terminal reorganised into a three-column “control room” (order book, chart, order entry)
- User dashboard shows balances, P&L, trade history, and account controls
- Realistic error handling: banners appear when REST or WebSocket services are offline
- Browser-safe polyfills for `Buffer`/`process` added so wallet adapters work on Vercel

### Running the UI Locally
```bash
cd svm_clob_frontend
npm install
npm run dev                    # expects live REST/WS on :8080/:8081
```
To work without the backend:
```
VITE_USE_MOCK_API=true npm run dev
```
This switches every service call to the built-in mock adapters while keeping the new UI.

### Deploying (e.g. Vercel)
Set these environment variables before building:
```
VITE_USE_MOCK_API=false or true
VITE_API_BASE_URL=https://<rest-endpoint>/api/v1
VITE_WS_BASE_URL=wss://<ws-endpoint>/ws
VITE_SOLANA_NETWORK=devnet
VITE_SOLANA_RPC_URL=https://api.devnet.solana.com
```
When `VITE_USE_MOCK_API=true` the app renders without touching the backend.

## Backend Work Needed
To make the demo fully live, the `svm_clob_infra` services must supply:

1. **REST Endpoints** (JSON)
   - `POST /api/v1/orders` / `PUT` / `DELETE` / `GET` for full order lifecycle
   - `GET /api/v1/orderbook?market=SOL/USDC`
   - `GET /api/v1/trades?market=SOL/USDC&limit=200`
   - `GET /api/v1/market/stats`, `market/depth`, `system/markets`
   - `GET /api/v1/users/:wallet/{orders,trades,account}`
   - `POST /api/v1/auth/challenge` & `POST /api/v1/auth/verify` (wallet signature → JWT)

2. **WebSocket Streams**
   - Accept `{ "type":"Subscribe", "subscription": { "type": "OrderBook", "market": "SOL/USDC" } }`
   - Broadcast `OrderBookUpdate`, `TradeExecution`, and `OrderUpdate` payloads
   - Heartbeat / status frames so the UI can show latency badges

3. **Solana Settlement Bridge**
   - After a match, submit `execute_trade` on the Anchor program and persist tx signatures
   - Reconcile vault balances with PostgreSQL state

4. **Deposits & Withdrawals**
   - REST endpoints that trigger Anchor instructions for funding the trading vaults
   - Ensure PDA seeds (`orderbook`, `user_account`, `clob_vault`) align with the on-chain program

## Smart Contract
The Anchor program already supports:
- Orderbook and user account PDAs
- `deposit`, `withdraw`, `initialize_orderbook`, `initialize_user_account`
- `execute_trade` that transfers balances and emits settlement events

Any future instruction changes must stay in sync with the off-chain settlement bot.

## Scripts
- `npm run build` in `svm_clob_frontend` – Vite production build -> `dist/`
- `cargo build --release` in `svm_clob_infra` – builds all infrastructure crates
- `anchor build` in `svm_clob` – compiles on-chain program

## Cleaning & Next Steps
- Frontend mock mode works with no backend; flip env vars to connect to live infra
- Backend team should prioritise the REST/WebSocket contracts above followed by settlement integration
- Once endpoints exist, switch `VITE_USE_MOCK_API` to `false` and verify Sol/USDC data flows end-to-end

For deeper implementation notes see each submodule’s README.
