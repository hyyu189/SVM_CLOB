# Frontend Refactor Blueprint

## Context
- Replace the existing mock-driven UI with a production-ready trading experience that talks to the Solana-based hybrid CLOB.
- Maintain the current dev velocity by allowing mock-mode fallbacks, but design real data flows as the primary path.
- Document dependencies so backend and smart-contract workstreams can proceed in parallel.

## Goals for the New Frontend (Step 3)
1. Deliver a Solana-aware trading terminal that covers onboarding, funding, order entry, monitoring, and position management.
2. Encapsulate network interactions behind typed clients with graceful degradation (mock → cache → live) to support offline tooling.
3. Establish real-time UX primitives (streaming order book, trades, user fills) tied to backend/WebSocket contracts.
4. Expose integration points for wallet-based authentication and custody operations (deposit/withdraw).

## Architectural Overview
### Application Shell
- **Routing**: Shallow route structure (`/markets/:symbol`, `/portfolio`, `/settings`) with guarded sub-routes for authenticated views.
- **Providers**: Global context stack for wallet adapter, auth session, query/mutation cache (React Query), and real-time bus.
- **Layout**: Persistent top bar (wallet & market selector), left rail (navigation & account), main content grid (terminal widgets).

### State Domains
| Domain | Owner | Description |
| --- | --- | --- |
| `SessionStore` | Zustand (or Redux Toolkit) | Wallet connection status, JWT, preferred market, feature flags. |
| `MarketDataStore` | React Query + streaming reducer | Current order book, trades, ticker metrics per market with snapshots + deltas. |
| `UserPortfolioStore` | React Query | Account balances, open orders, fills fetched via authenticated REST. |
| `UiLayoutStore` | Local storage backed | Widget visibility, theme, per-device panel arrangements. |

### Component Breakdown
| Area | Components | Notes |
| --- | --- | --- |
| Onboarding & Wallet | `WalletGate`, `SignatureChallengeModal`, `NetworkWarningBanner` | Drives signature-based auth and network mismatch alerts. |
| Funding | `DepositFlow`, `WithdrawFlow`, `VaultBalanceCard` | Triggers Anchor transactions via wallet adapter, shows vault holdings. |
| Market Select | `MarketSearch`, `MarketListPanel`, `FavoritesToggle` | Consumes `/api/v1/system/markets`, persists selections. |
| Trading Terminal | `OrderEntryForm`, `OrderBookPanel`, `DepthChart`, `RecentTrades`, `TradeHistoryTabs`, `ExecutionFeed` | Core trading widgets driven by REST bootstrap + WebSocket streams. |
| Portfolio | `OpenOrdersTable`, `PositionsSummary`, `PnLChart` | Uses authenticated endpoints for user scope data. |
| Settings | `NotificationPreferences`, `PerformanceToggles`, `DeveloperConsole` | Houses advanced config including mock/live toggle. |
| Shared Primitives | `DataStateBoundary`, `LatencyBadge`, `PillTabs`, `NumberFormat`, `SideBadge` | Reusable UI building blocks. |

### Service Layer
- **REST Client**: OpenAPI-ish wrapper around `fetch`, mounted in React Query; handles auth headers and error normalization.
- **WebSocket Client**: Resilient connection that multiplexes subscriptions (markets, user events) and emits typed events.
- **Mock Adapters**: Same interface as live clients, seeded with scenario scripts for developing without infra.
- **Anchor Client Facade**: Wraps `@coral-xyz/anchor` interactions used for deposits, withdrawals, and (later) on-chain queries.

## Data & Integration Contracts
### REST (Current + Required)
| Use Case | HTTP Contract | Notes |
| --- | --- | --- |
| Order submission | `POST /api/v1/orders` | Requires owner pubkey, order params; returns order payload + id. |
| Cancel order | `DELETE /api/v1/orders/:id` | Expects numeric id; should reflect new status. |
| Modify order | `PUT /api/v1/orders/:id` | Needed for amend flow; must support partial updates. |
| Order lookup | `GET /api/v1/orders/:id` | Bootstrap for order details drawer. |
| Order book | `GET /api/v1/orderbook?market=SOL/USDC` | Provide aggregated levels with timestamp + sequence. |
| Trades feed | `GET /api/v1/trades?market=SOL/USDC&limit=200` | Used for initial list + pagination. |
| Market stats | `GET /api/v1/market/stats?market=SOL/USDC` | Supplies ticker block (last/24h high/low/vol). |
| Market depth | `GET /api/v1/market/depth?levels=50` | Needed for depth chart (backend requirement). |
| System markets | `GET /api/v1/system/markets` | Enumerate available trading pairs with config. |
| User orders | `GET /api/v1/users/:wallet/orders?status=open` | Populates open orders table. |
| User trades | `GET /api/v1/users/:wallet/trades?limit=200` | Drives fills history. |
| User account | `GET /api/v1/users/:wallet/account` | Provides aggregate portfolio stats. |
| Auth handshake | `POST /api/v1/auth/challenge`, `POST /api/v1/auth/verify` | Wallet signature → JWT (backend requirement). |

### WebSocket Streams
- **Subscription message** (frontend → backend):
  ```json
  { "type": "Subscribe", "subscription": { "type": "OrderBook", "market": "SOL/USDC" } }
  ```
- **Market data payloads**: `MarketData` envelope with `OrderBookUpdate` or `TradeExecution` (per infra README).
- **User scope payloads**: `OrderUpdate` carrying revised status/filled qty for authenticated wallet.
- **Heartbeat**: Expect `ServiceStatus` ping every 15s to drive latency indicators.
- **Reconnect strategy**: Exponential backoff capped at 8s, replay last known sequence via REST bootstrap.

### Wallet & Auth Flow
1. Detect wallet connection via Solana wallet adapter; enforce selected network matches `devnet` or configured cluster.
2. Request nonce: `POST /api/v1/auth/challenge` → `{ challenge, expires_at }`.
3. User signs challenge; submit signature to `POST /api/v1/auth/verify` to obtain JWT.
4. Attach `Authorization: Bearer <token>` to REST/WebSocket upgrade; store token in memory only.
5. Refresh token silently prior to expiry; logout clears session + subscriptions.

### Deposit / Withdraw Flows
- **Deposit**: UI calls Anchor `deposit` with user token account → vault, expects transaction signature and updated balances via on-chain event polling + backend sync.
- **Withdraw**: Trigger Anchor `withdraw`; on success prompt backend refresh: call `GET /api/v1/users/:wallet/account` to resync.
- **Balance Reconciliation**: Display both on-chain vault balances (via Anchor account fetch) and backend perspective; warn if drift > configurable threshold (requires backend state sync endpoints).

## Backend Requirements (Step 2)
1. **Endpoint Parity**: Implement/confirm all REST routes listed above, including `market/depth`, `users/:wallet/trades`, `users/:wallet/account`, and auth endpoints (`svm_clob_infra` currently lacks these).
2. **Market Context**: Expose `/api/v1/system/markets` returning symbol metadata, tick size, min order size, vault addresses.
3. **WebSocket Bridge**: Stream matching engine events into the WS server using the documented message formats; emit heartbeats and backfill sequence numbers.
4. **Auth Layer**: Provide signature verification, JWT issuance, middleware enforcement on protected routes, and WebSocket token validation.
5. **State Sync Hooks**: Offer endpoints or event topics for balance/settlement reconciliation (e.g., on-chain event listener to update storage after `execute_trade`).
6. **Error Semantics**: Standardize error payloads `{ code, message, details }` with HTTP status alignment to help frontend surface actionable toasts.
7. **Versioning**: Add minimal version handshake (`GET /health` or new `/meta`) so frontend can warn on mismatches.

## Smart Contract Requirements (Step 1)
1. **Authority Enforcement**: Require the caller of `execute_trade` to match the `orderbook.authority`; emit explicit error otherwise.
2. **Event Schema Stability**: Confirm `TradeSettled` layout and document any planned changes; frontend will rely on logs for advanced analytics.
3. **Balance Guarantees**: Define on-chain invariants for ledger vs. token vault balances; clarify if further token transfers inside `execute_trade` are expected or if ledger-only is final.
4. **Account Discovery Helpers**: Publish TypeScript utilities/IDL updates for PDA derivations (orderbook, user account, vault) to keep frontend consistent with backend.
5. **Future Hooks**: Signal timeline for additional instructions (pause market, adjust tick size) so UI can reserve affordances.

## Outstanding Questions
- Should backend emit its own synthetic events for deposits/withdrawals, or should frontend consume on-chain logs directly?
- What is the SLA for backend-cached order book vs. on-chain truth when discrepancies occur?
- Can we tolerate unsigned market data (public) while securing user-scoped updates, or must all WS channels be authenticated?

Document owner: Codex agent — pending review with product, infra, and smart-contract leads.

## Implementation Notes (April 2025)
- React router shell, query client, and Solana providers compose through `AppProviders`, exposing REST/WS services via context for hooks/components.
- Zustand stores now track session state (`useSessionStore`), market data snapshots (`useMarketDataStore`), and layout toggles (`useUiLayoutStore`).
- Core dashboards consume the new hooks (`useBackendStatus`, updated `useOrderBook`, `useWalletConnection`) and drive market selection via the session store.
- Resilient services remain the backing implementations; the provider indirection makes it simpler to swap in mock adapters during development.

### Backend Follow-ups
1. Expose per-market REST queries referenced by the new layout (`/api/v1/system/markets`, `/api/v1/market/depth`, `/api/v1/users/:wallet/account`).
2. Align WebSocket topics: the UI now subscribes to `Trades` and `AllMarkets`; ensure both exist and emit the documented payload shape.
3. Deliver wallet-auth challenge endpoints so the session store can capture JWTs once implemented.
4. Emit user-order broadcasts after settlement so the portfolio tab stays fresh without polling.
5. Document authority expectations for `execute_trade` so the frontend can surface warnings when settlement fails.
