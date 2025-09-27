import { Outlet, NavLink, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import {
  TrendingUp,
  Wifi,
  WifiOff,
  LayoutDashboard,
  CandlestickChart,
  BriefcaseBusiness,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { WalletConnection } from '../../components/WalletConnection';
import { useBackendStatus } from '../hooks/useBackendStatus';

const NAV_ITEMS = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/trade', label: 'Trade', icon: CandlestickChart },
  { to: '/portfolio', label: 'Portfolio', icon: BriefcaseBusiness },
];

export const AppLayout = () => {
  const { connected, loading } = useBackendStatus();
  const location = useLocation();

  const connectionClasses = clsx(
    'status-pill',
    loading ? 'status-pill--accent' : connected ? 'status-pill--online' : 'status-pill--offline',
  );

  const ConnectionIcon = loading ? RefreshCw : connected ? Wifi : WifiOff;

  return (
    <div className="app-shell flex min-h-screen flex-col text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-800/60 bg-slate-950/55 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex min-w-[260px] flex-1 items-center gap-4">
              <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500/30 via-indigo-500/20 to-purple-500/20 text-sky-300 shadow-[0_18px_45px_-28px_rgba(56,189,248,0.65)]">
                <TrendingUp className="h-6 w-6" />
                <span className="pointer-events-none absolute inset-0 rounded-2xl border border-sky-500/30" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-[0.625rem] font-semibold uppercase tracking-[0.28em] text-slate-400">
                  <Sparkles className="h-3 w-3 text-sky-300" />
                  Hybrid Venue
                </div>
                <p className="text-xl font-semibold tracking-tight text-white sm:text-2xl">SVM CLOB</p>
                <p className="text-sm text-slate-400">Solana Devnet • Rust matching with Anchor-backed settlement</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-medium text-slate-300 sm:flex-none">
              <span className="status-pill status-pill--accent">Devnet</span>
              <span className={connectionClasses}>
                <ConnectionIcon className={clsx('h-3.5 w-3.5', loading && 'animate-spin')} />
                {loading ? 'Checking infrastructure…' : connected ? 'Infrastructure online' : 'Mock data mode'}
              </span>
              <span className="status-pill hidden lg:inline-flex">Release candidate</span>
            </div>

            <div className="ml-auto shrink-0">
              <WalletConnection className="wallet-toolbar--floating" />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <nav className="app-nav flex-1">
              <div className="app-nav__rail">
                {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === '/'}
                    className={({ isActive }) =>
                      clsx('app-nav__link', isActive && 'app-nav__link--active')
                    }
                  >
                    <Icon />
                    <span>{label}</span>
                  </NavLink>
                ))}
              </div>
            </nav>
          </div>
        </div>
      </header>

      <main key={location.pathname} className="relative flex-1 pb-24 pt-10 lg:pt-14">
        <Outlet />
      </main>
    </div>
  );
};

export default AppLayout;
