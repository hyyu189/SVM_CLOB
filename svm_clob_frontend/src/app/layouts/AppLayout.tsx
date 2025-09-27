import { Outlet, NavLink, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { TrendingUp, Wifi, WifiOff } from 'lucide-react';
import { WalletConnection } from '../../components/WalletConnection';
import { useBackendStatus } from '../hooks/useBackendStatus';

const NAV_ITEMS = [
  { to: '/', label: 'Overview' },
  { to: '/trade', label: 'Trade' },
  { to: '/portfolio', label: 'Portfolio' },
];

export const AppLayout = () => {
  const { connected, loading } = useBackendStatus();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-[#0a0b0f] text-white flex flex-col">
      <header className="border-b border-slate-800/60 bg-[#0d0f15]/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10">
              <TrendingUp className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-lg font-semibold tracking-tight">SVM CLOB</p>
              <p className="text-xs text-slate-400">Solana Devnet • Hybrid CLOB demo</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
            <span className="flex items-center gap-1 rounded-full border border-slate-700 px-3 py-1">
              <div className="h-2 w-2 rounded-full bg-indigo-400" />
              DEVNET
            </span>
            <span
              className={clsx(
                'flex items-center gap-1 rounded-full border px-3 py-1 transition-colors',
                connected
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                  : 'border-rose-500/40 bg-rose-500/10 text-rose-300',
              )}
            >
              {connected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
              {loading ? 'Checking infrastructure…' : connected ? 'Infrastructure Online' : 'Mock Data Mode'}
            </span>
          </div>

          <WalletConnection />
        </div>

        <nav className="mx-auto flex max-w-7xl gap-2 px-4 pb-4">
          {NAV_ITEMS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx(
                  'flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all sm:flex-none sm:px-6',
                  isActive
                    ? 'bg-white/10 text-white shadow-lg shadow-blue-500/10'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white',
                )
              }
              end={to === '/'}
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main key={location.pathname} className="flex-1">
        <Outlet />
      </main>
    </div>
  );
};

export default AppLayout;
