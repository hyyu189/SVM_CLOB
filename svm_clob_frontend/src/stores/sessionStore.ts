import { create } from 'zustand';

type FeatureFlags = {
  mockMode: boolean;
};

export interface SessionState {
  walletAddress: string | null;
  authToken: string | null;
  selectedMarket: string;
  featureFlags: FeatureFlags;
  setWalletAddress: (address: string | null) => void;
  setAuthToken: (token: string | null) => void;
  setSelectedMarket: (market: string) => void;
  setMockMode: (enabled: boolean) => void;
  reset: () => void;
}

const DEFAULT_MARKET = 'SOL/USDC';

export const useSessionStore = create<SessionState>((set) => ({
  walletAddress: null,
  authToken: null,
  selectedMarket: DEFAULT_MARKET,
  featureFlags: {
    mockMode: false,
  },
  setWalletAddress: (walletAddress) => set({ walletAddress }),
  setAuthToken: (authToken) => set({ authToken }),
  setSelectedMarket: (selectedMarket) => set({ selectedMarket }),
  setMockMode: (mockMode) => set((state) => ({ featureFlags: { ...state.featureFlags, mockMode } })),
  reset: () => set({
    walletAddress: null,
    authToken: null,
    selectedMarket: DEFAULT_MARKET,
    featureFlags: { mockMode: false },
  }),
}));
