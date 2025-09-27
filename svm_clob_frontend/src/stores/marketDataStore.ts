import { create } from 'zustand';
import type { OrderBookSnapshot, TradeData } from '../services/api-types';

export interface MarketDataState {
  orderBook: OrderBookSnapshot | null;
  trades: TradeData[];
  lastSequence: number;
  setOrderBook: (snapshot: OrderBookSnapshot) => void;
  prependTrade: (trade: TradeData, limit?: number) => void;
  reset: () => void;
}

export const useMarketDataStore = create<MarketDataState>((set) => ({
  orderBook: null,
  trades: [],
  lastSequence: 0,
  setOrderBook: (orderBook) => set({ orderBook, lastSequence: orderBook.sequence_number }),
  prependTrade: (trade, limit = 200) => set((state) => {
    const trades = [trade, ...state.trades].slice(0, limit);
    return { trades };
  }),
  reset: () => set({ orderBook: null, trades: [], lastSequence: 0 }),
}));
