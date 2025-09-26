/**
 * Application Configuration
 *
 * Centralized configuration for the SVM CLOB frontend application
 */

// Environment configuration
export const CONFIG = {
  // Backend API URLs (svm_clob_infra)
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1',
  WS_BASE_URL: import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8081/ws',

  // Feature flags
  USE_MOCK_API: import.meta.env.VITE_USE_MOCK_API === 'true',
  ENABLE_DEVTOOLS: import.meta.env.MODE === 'development',

  // API configuration
  API_TIMEOUT: parseInt(import.meta.env.VITE_API_TIMEOUT || '10000'),
  WEBSOCKET_RECONNECT_ATTEMPTS: parseInt(import.meta.env.VITE_WS_RECONNECT_ATTEMPTS || '5'),
  WEBSOCKET_RECONNECT_INTERVAL: parseInt(import.meta.env.VITE_WS_RECONNECT_INTERVAL || '5000'),

  // Solana configuration
  SOLANA_RPC_URL: import.meta.env.VITE_SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  SOLANA_NETWORK: import.meta.env.VITE_SOLANA_NETWORK || 'devnet',

  // Logging
  LOG_LEVEL: import.meta.env.VITE_LOG_LEVEL || (import.meta.env.MODE === 'development' ? 'debug' : 'warn'),

  // Default market data for fallback
  DEFAULT_FALLBACK_DATA: {
    last_price: 100.0,
    '24h_change': 0,
    '24h_volume': 0,
    '24h_high': 100.0,
    '24h_low': 100.0,
    best_bid: 99.5,
    best_ask: 100.5,
    spread: 1.0,
    total_bid_orders: 0,
    total_ask_orders: 0
  }
};

export type AppConfig = typeof CONFIG;