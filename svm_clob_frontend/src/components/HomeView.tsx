import React from 'react';
import clsx from 'clsx';
import {
  Zap,
  ShieldCheck,
  BarChart3,
  Layers,
  SignalHigh,
  ArrowRight,
  Activity,
  Cpu,
  Database,
  Cable,
  Users,
} from 'lucide-react';

interface HomeViewProps {
  onLaunchTrade: () => void;
  backendStatus: {
    connected: boolean;
    totalVolume: string;
    activeOrders: number;
    users: number;
    loading: boolean;
  };
}

const FEATURE_CARDS = [
  {
    icon: BarChart3,
    title: 'Institutional order book',
    description:
      'Depth-aware ladder with aggregated liquidity, partial fill tracking, and one-click trading ergonomics.',
  },
  {
    icon: Zap,
    title: 'Ultra-low latency',
    description: 'Rust matching with microsecond responses while settlement finalises on Solana consensus.',
  },
  {
    icon: ShieldCheck,
    title: 'Custodied funds',
    description: 'Anchor vaults guarantee balances with deterministic settlement flows and PDA-managed custody.',
  },
  {
    icon: Layers,
    title: 'Modular architecture',
    description: 'Composable REST, WebSocket, settlement bot, and analytics layers deployable on-demand.',
  },
];

const SYSTEM_PIPELINE = [
  {
    label: 'Client',
    icon: Activity,
    description: 'React front end with wallet adapter, live telemetry, and pro terminal ergonomics.',
    accent: 'text-sky-300',
  },
  {
    label: 'Matching engine',
    icon: Cpu,
    description: 'Rust order router enforcing price-time priority, risk controls, and market microstructure.',
    accent: 'text-emerald-300',
  },
  {
    label: 'Storage',
    icon: Database,
    description: 'PostgreSQL ledger with Redis-backed hot paths for order book and trade history caching.',
    accent: 'text-amber-300',
  },
  {
    label: 'Solana',
    icon: Cable,
    description: 'Anchor settlement program orchestrating custody, state transitions, and final settlement.',
    accent: 'text-indigo-300',
  },
];

export const HomeView: React.FC<HomeViewProps> = ({ onLaunchTrade, backendStatus }) => {
  const isOnline = backendStatus.connected;
  const heroHighlights = [
    {
      label: 'Program status',
      value: backendStatus.loading ? '—' : isOnline ? 'Live Devnet' : 'Mock data mode',
      helper: isOnline ? 'REST + WebSocket responding' : 'Fallback telemetry engaged',
      icon: SignalHigh,
    },
    {
      label: 'Program ID',
      value: '7YtJ…7YJB',
      helper: 'Anchor deployment packaged with this workspace',
      icon: ShieldCheck,
    },
    {
      label: 'Settlement loop',
      value: 'Hybrid',
      helper: 'Off-chain matching + on-chain finality',
      icon: Layers,
    },
    {
      label: 'Latency target',
      value: 'µs matching',
      helper: 'Rust engine with in-memory order paths',
      icon: Zap,
    },
  ];

  const telemetryCards = [
    {
      label: 'Total volume',
      value: backendStatus.loading ? '—' : backendStatus.totalVolume,
      helper: 'Executed in the past 24h',
      icon: BarChart3,
      accent: 'text-sky-200',
    },
    {
      label: 'Open orders',
      value: backendStatus.loading ? '—' : backendStatus.activeOrders.toLocaleString('en-US'),
      helper: 'Resting liquidity on the book',
      icon: Layers,
      accent: 'text-emerald-200',
    },
    {
      label: 'Active traders',
      value: backendStatus.loading ? '—' : backendStatus.users.toLocaleString('en-US'),
      helper: isOnline ? 'Connected wallets' : 'Simulated peers',
      icon: Users,
      accent: 'text-purple-200',
    },
    {
      label: 'Mode',
      value: backendStatus.loading ? '—' : isOnline ? 'Live Devnet' : 'Offline demo',
      helper: isOnline ? 'REST & WebSocket online' : 'Start infrastructure services to stream live state',
      icon: SignalHigh,
      accent: isOnline ? 'text-emerald-200' : 'text-amber-200',
    },
  ];

  const environmentChecklist = [
    { label: 'REST base URL configured', detail: 'VITE_API_BASE_URL' },
    { label: 'WebSocket endpoint set', detail: 'VITE_WS_BASE_URL' },
    { label: 'Anchor program deployed on Devnet' },
  ];

  return (
    <div className="relative isolate text-slate-100">
      <div className="absolute inset-x-0 -top-32 -z-10 flex justify-center" aria-hidden="true">
        <div className="h-72 w-[60rem] bg-gradient-to-br from-sky-500/25 via-indigo-500/15 to-transparent blur-3xl opacity-70" />
      </div>

      <div className="page-container mx-auto w-full max-w-7xl px-6 pb-28 pt-8 sm:px-8 lg:px-12">
        <section className="hero-grid">
          <div className="hero-card">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-4 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-sky-200">
              <span className="h-2 w-2 rounded-full bg-sky-300" />
              SVM CLOB • Devnet
            </div>

            <div className="space-y-4">
              <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                On-chain certainty with off-chain performance.
              </h1>
              <p className="text-base leading-relaxed text-slate-300 sm:text-lg">
                SVM CLOB is an institutional-ready hybrid venue: a Rust matching engine orchestrates orders while the Anchor program enforces deterministic settlement. Run the stack locally for demos or connect to Devnet for live flows.
              </p>
            </div>

            <div className="hero-card__meta">
              <span
                className={clsx(
                  'inline-flex items-center gap-2 rounded-full border px-4 py-1.5 uppercase tracking-[0.18em]',
                  isOnline
                    ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200'
                    : 'border-amber-400/40 bg-amber-400/10 text-amber-200',
                )}
              >
                <SignalHigh className={isOnline ? 'h-4 w-4 text-emerald-300' : 'h-4 w-4 text-amber-300'} />
                {isOnline ? 'Infrastructure online' : 'Offline demo mode'}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-900/50 px-4 py-1.5 text-[0.7rem] font-medium">
                Program ID
                <code className="font-mono text-xs text-slate-300">7YtJ…7YJB</code>
              </span>
            </div>

            <div className="hero-actions">
              <button onClick={onLaunchTrade} className="btn btn--primary">
                Launch trading terminal
                <ArrowRight className="btn-icon" />
              </button>
              <span className="text-xs text-slate-400 sm:text-sm">
                Wallet optional while infrastructure runs in mock mode.
              </span>
            </div>

            <div className="metric-grid metric-grid--compact">
              {heroHighlights.map(({ label, value, helper, icon: Icon }) => (
                <div key={label} className="highlight-card">
                  <span className="highlight-card__icon">
                    <Icon className="h-5 w-5 text-slate-200" />
                  </span>
                  <div className="highlight-card__body">
                    <p className="highlight-card__label">{label}</p>
                    <p className="highlight-card__value">{value}</p>
                    <p className="highlight-card__helper">{helper}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <aside className="hero-grid__sidebar">
            <div className="telemetry-banner">
              <div className="telemetry-banner__headline">
                <div>
                  <h3>System telemetry</h3>
                  <p>Last 24 hours</p>
                </div>
                <span>{isOnline ? 'Devnet Live' : 'Offline mode'}</span>
              </div>
              {telemetryCards.map(({ label, value, helper, icon: Icon, accent }) => (
                <div key={label} className="telemetry-banner__card">
                  <span className="telemetry-banner__icon">
                    <Icon className={clsx('h-5 w-5', accent)} />
                  </span>
                  <div>
                    <p className="telemetry-banner__label">{label}</p>
                    <p className={clsx('telemetry-banner__value', accent)}>{value}</p>
                    <p className="telemetry-banner__helper">{helper}</p>
                  </div>
                </div>
              ))}
              {!isOnline && (
                <div className="telemetry-banner__note">
                  Infrastructure is offline. The UI renders from local fallbacks—start the Rust services to stream live state from Devnet.
                </div>
              )}
            </div>

            <div className="environment-card">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900/70">
                  <Cpu className="h-5 w-5 text-sky-300" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Environment checklist</p>
                  <p className="mt-1 text-sm text-slate-300">Verify prerequisites before connecting to live infrastructure.</p>
                </div>
              </div>
              <ul className="environment-card__list">
                {environmentChecklist.map(({ label, detail }) => (
                  <li key={label} className="environment-card__item">
                    <span className="environment-card__bullet" />
                    <div>
                      <p className="font-medium text-slate-100">{label}</p>
                      {detail ? <p className="environment-card__detail">{detail}</p> : null}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </section>

        <section className="space-y-16">
          <header className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-700/60 bg-slate-900/60 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-slate-500">
              Trading infrastructure
            </div>
            <h2 className="mt-4 text-3xl font-semibold text-white">Build a venue end-to-end.</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              The front end mirrors Solana settlement flows—order placement, balances, analytics—while gracefully degrading to mock services whenever infrastructure is offline.
            </p>
          </header>
          <div className="grid gap-8 lg:grid-cols-[repeat(2,minmax(0,1fr))]">
            <article className="surface-card p-8">
              <div className="feature-grid">
                {FEATURE_CARDS.map(({ icon: Icon, title, description, iconGradient }) => (
                  <article key={title} className="feature-card">
                    <span className="feature-card__icon">
                      <Icon className="h-6 w-6 text-slate-200" />
                    </span>
                    <div>
                      <h3 className="feature-card__title">{title}</h3>
                      <p className="feature-card__description">{description}</p>
                    </div>
                  </article>
                ))}
              </div>
            </article>
            <article className="surface-card p-8">
              <div className="space-y-6">
                <h3 className="text-2xl font-semibold text-white">Execution pillars</h3>
                <p className="text-sm leading-relaxed text-slate-300">
                  Hybrid architecture lets you toggle between mock data and live Devnet settlement without altering the terminal.
                </p>
                <div className="stat-list">
                  {[
                    { label: 'Client', detail: 'React terminal with wallet adapter taps into REST + WebSocket surfaces.' },
                    { label: 'Matching engine', detail: 'Rust-based price-time priority and partial fill accounting.' },
                    { label: 'Storage', detail: 'PostgreSQL ledger augmented by Redis for hot market data reads.' },
                    { label: 'Settlement', detail: 'Anchor program finalises state changes and custody on Solana Devnet.' },
                  ].map(({ label, detail }) => (
                    <div key={label} className="stat-list__item">
                      <p className="stat-list__label">{label}</p>
                      <p className="stat-list__copy">{detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          </div>
        </section>

        <section className="space-y-16">
          <header className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-700/60 bg-slate-900/60 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-slate-500">
              Flow
            </div>
            <h2 className="mt-4 text-2xl font-semibold text-white">Hybrid settlement pipeline.</h2>
            <p className="mt-3 text-sm text-slate-300">
              Orders traverse the React terminal, Rust engine, and Solana settlement program bundled in this workspace—swap between mock and live data without touching the UI.
            </p>
          </header>
          <div className="flow-layout">
            <ol className="timeline">
              {SYSTEM_PIPELINE.map(({ label, icon: Icon, description, accent, beam }, index) => (
                <li key={label} className="timeline__item">
                  <div className="timeline__meta">
                    <span>Stage {String(index + 1).padStart(2, '0')}</span>
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/70">
                      <Icon className={clsx('h-4 w-4', accent)} />
                    </span>
                  </div>
                  <h3 className="timeline__title">{label}</h3>
                  <p className="timeline__description">{description}</p>
                </li>
              ))}
            </ol>
            <div className="surface-card p-8 space-y-4">
              <h3 className="text-xl font-semibold text-white">Streaming modes</h3>
              <p className="text-sm text-slate-300">
                Toggle between local mock data and Devnet streams without leaving the control room. The UI gracefully degrades as services go offline.
              </p>
              <ul className="environment-card__list">
                <li className="environment-card__item">
                  <span className="environment-card__bullet" />
                  <div>
                    <p className="font-medium text-slate-100">Mock mode</p>
                    <p className="environment-card__detail">npm run dev:mock</p>
                  </div>
                </li>
                <li className="environment-card__item">
                  <span className="environment-card__bullet" />
                  <div>
                    <p className="font-medium text-slate-100">Live mode</p>
                    <p className="environment-card__detail">Boot Rust services + settle on Devnet</p>
                  </div>
                </li>
                <li className="environment-card__item">
                  <span className="environment-card__bullet" />
                  <div>
                    <p className="font-medium text-slate-100">Failover</p>
                    <p className="environment-card__detail">UI reverts to cached state when REST/WS offline</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section>
          <div className="cta-card">
            <div className="max-w-xl space-y-3">
              <h2 className="text-2xl font-semibold text-white">Bring the services online.</h2>
              <p className="text-sm text-slate-300">
                Use <code className="font-mono">npm run dev:mock</code> for a self-contained demo, or boot the Rust services to experience the full hybrid loop with live settlement on Devnet.
              </p>
            </div>
            <button onClick={onLaunchTrade} className="btn btn--gradient">
              Launch trading terminal
              <ArrowRight className="btn-icon" />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default HomeView;
