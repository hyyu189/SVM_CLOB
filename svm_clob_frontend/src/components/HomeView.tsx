import React from 'react';
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
    description: 'Depth-aware ladder with aggregated liquidity, partial fill tracking, and click-to-trade ergonomics.',
  },
  {
    icon: Zap,
    title: 'Ultra-low latency',
    description: 'Rust-based matching with microsecond response times while settlement finalises on Solana.',
  },
  {
    icon: ShieldCheck,
    title: 'Custodied funds',
    description: 'Anchor vaults guarantee balances with deterministic settlement instructions and PDA-managed custody.',
  },
  {
    icon: Layers,
    title: 'Modular architecture',
    description: 'Composable REST, WebSocket, settlement bot, and analytics layers you can deploy independently.',
  },
];

const SYSTEM_PIPELINE = [
  { label: 'Client', icon: Activity, description: 'React terminal with wallet adapter and realtime streaming UI.' },
  { label: 'Matching engine', icon: Cpu, description: 'Rust order router, price-time priority, and risk checks.' },
  { label: 'Storage', icon: Database, description: 'PostgreSQL ledger with Redis caching for hot market data.' },
  { label: 'Solana', icon: Cable, description: 'Anchor settlement program handling custody and trade execution.' },
];

export const HomeView: React.FC<HomeViewProps> = ({ onLaunchTrade, backendStatus }) => {
  const isOnline = backendStatus.connected;

  return (
    <div className="landing-screen text-slate-100">
      <div className="landing-screen__container">
        <section className="landing-hero">
          <div className="landing-hero__grid">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-blue-200">
                <span className="h-2 w-2 rounded-full bg-blue-300" />
                SVM CLOB • Devnet
              </div>
              <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                On-chain certainty with off-chain performance.
              </h1>
              <p className="max-w-2xl text-base leading-relaxed text-slate-300">
                SVM CLOB is a minimally viable institutional venue: a Rust matching engine orchestrates orders while the
                Anchor program enforces settlement. Run the entire stack locally for demos or connect to Devnet for live
                balances.
              </p>

              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-200">
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-700/80 bg-slate-900/60 px-4 py-1.5">
                  <SignalHigh className={isOnline ? 'h-4 w-4 text-emerald-300' : 'h-4 w-4 text-amber-300'} />
                  {isOnline ? 'Infrastructure online' : 'Offline demo mode'}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-900/50 px-4 py-1.5">
                  Program ID: <code className="font-mono text-xs">7YtJ…7YJB</code>
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <button
                  onClick={onLaunchTrade}
                  className="group inline-flex items-center gap-3 rounded-xl bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:-translate-y-1 hover:shadow-blue-500/40"
                >
                  Launch trading terminal
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </button>
                <span className="text-xs text-slate-400">
                  Wallet connection optional when infrastructure is offline.
                </span>
              </div>
            </div>

            <aside className="surface-card space-y-6">
              <header className="flex items-center justify-between text-sm text-slate-300">
                <p className="font-medium text-slate-100">System telemetry</p>
                <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs">Last 24h</span>
              </header>
              <dl className="space-y-4 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-slate-400">Total volume</dt>
                  <dd className="font-mono text-base text-blue-200">{backendStatus.loading ? '—' : backendStatus.totalVolume}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-400">Open orders</dt>
                  <dd className="font-mono text-base text-emerald-200">{backendStatus.loading ? '—' : backendStatus.activeOrders}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-400">Active traders</dt>
                  <dd className="font-mono text-base text-purple-200">{backendStatus.loading ? '—' : backendStatus.users}</dd>
                </div>
              </dl>
              {!isOnline && (
                <p className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-4 text-xs text-amber-100">
                  Infrastructure is offline. UI is rendering from local fallbacks—start the Rust services to stream live
                  state.
                </p>
              )}
            </aside>
          </div>
        </section>

        <section className="space-y-8">
          <header className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Trading infrastructure</p>
            <h2 className="text-3xl font-semibold text-white">Build a venue end-to-end.</h2>
            <p className="max-w-3xl text-sm leading-relaxed text-slate-300">
              The front end mirrors the real Solana settlement flow—order placement, balances, and analytics—while
              gracefully degrading to mock services if you’re running the UI in isolation.
            </p>
          </header>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {FEATURE_CARDS.map(({ icon: Icon, title, description }) => (
              <article
                key={title}
                className="surface-card transition hover:border-sky-500/40 hover:shadow-sky-600/20"
              >
                <div className="flex items-start gap-4">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-300">
                    <Icon className="h-6 w-6" />
                  </span>
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-white">{title}</h3>
                    <p className="text-sm leading-relaxed text-slate-300">{description}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="space-y-8">
          <header className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Flow</p>
            <h2 className="text-2xl font-semibold text-white">Hybrid settlement pipeline.</h2>
            <p className="max-w-3xl text-sm text-slate-300">
              Orders travel from the React terminal through the matching engine and settle on Solana via the Anchor
              program shipped in this workspace.
            </p>
          </header>
          <div className="grid gap-4 md:grid-cols-4">
            {SYSTEM_PIPELINE.map(({ label, icon: Icon, description }) => (
              <div key={label} className="surface-card p-5 text-sm space-y-3">
                <Icon className="h-6 w-6 text-sky-300" />
                <h3 className="text-base font-semibold text-white">{label}</h3>
                <p className="text-xs leading-relaxed text-slate-400">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <div className="surface-card p-8 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl space-y-3">
              <h2 className="text-2xl font-semibold text-white">Bring the services online.</h2>
              <p className="text-sm text-slate-300">
                Use <code className="font-mono">npm run dev:mock</code> for a self-contained demo, or boot the Rust infrastructure to experience the
                full hybrid loop with live settlement on Devnet.
              </p>
            </div>
            <button
              onClick={onLaunchTrade}
              className="inline-flex items-center gap-3 rounded-xl bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:-translate-y-1 hover:shadow-blue-500/40"
            >
              Launch trading terminal
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default HomeView;
