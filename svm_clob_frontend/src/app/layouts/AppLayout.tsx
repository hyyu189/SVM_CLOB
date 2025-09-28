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
        <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-4 sm:px-6 lg:px-8">
          <div className="app-topline">
            <div className="app-brand">
              <div className="app-brand__emblem">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div className="app-brand__copy">
                <span className="app-brand__eyebrow">
                  <Sparkles className="h-3 w-3 text-sky-300" />
                  Hybrid Venue
                </span>
                <p className="app-brand__title">SVM CLOB</p>
                <p className="app-brand__subtitle">Solana Devnet • Rust matching with Anchor-backed settlement</p>
              </div>
            </div>

            <div className="app-topline__status">
              <span className="status-pill status-pill--accent">Devnet</span>
              <span className={connectionClasses}>
                <ConnectionIcon className={clsx('h-3.5 w-3.5', loading && 'animate-spin')} />
                {loading ? 'Checking infrastructure…' : connected ? 'Infrastructure online' : 'Mock data mode'}
              </span>
              <span className="status-pill status-pill--muted hidden lg:inline-flex">Release candidate</span>
            </div>

            <div className="app-topline__wallet">
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
