/**
 * Solana Configuration
 *
 * Configuration for SVM CLOB smart contract integration
 * Based on deployment information from svm_clob/README.md
 */

import { PublicKey } from '@solana/web3.js';

// SVM CLOB Program Configuration (from svm_clob/README.md)
export const CLOB_CONFIG = {
  // Deployed program on Solana Devnet
  PROGRAM_ID: new PublicKey("7YtJ5eYw1am3m73Yw2sh1QPWek3Ux17Ju1tp263h7YJB"),
  NETWORK: "devnet",
  RPC_URL: "https://api.devnet.solana.com",
  WS_URL: "wss://api.devnet.solana.com/",

  // Known token mints
  TOKENS: {
    SOL: new PublicKey("So11111111111111111111111111111111111111112"),
    USDC: new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")
  },

  // Default trading pair
  DEFAULT_MARKET: {
    BASE_MINT: "So11111111111111111111111111111111111111112", // SOL
    QUOTE_MINT: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
    SYMBOL: "SOL/USDC",
    TICK_SIZE: 1000, // Minimum price increment
    MIN_ORDER_SIZE: 1000000 // Minimum order size in micro-units
  }
};

// PDA Derivation Functions (from svm_clob/README.md)

/**
 * Derive orderbook Program Derived Address (PDA)
 * Seeds: ["orderbook", base_mint, quote_mint]
 */
export const getOrderbookPDA = (baseMint: PublicKey, quoteMint: PublicKey): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("orderbook"), baseMint.toBuffer(), quoteMint.toBuffer()],
    CLOB_CONFIG.PROGRAM_ID
  );
};

/**
 * Derive user account Program Derived Address (PDA)
 * Seeds: ["user_account", user_pubkey]
 */
export const getUserAccountPDA = (userPubkey: PublicKey): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("user_account"), userPubkey.toBuffer()],
    CLOB_CONFIG.PROGRAM_ID
  );
};

/**
 * Derive token vault Program Derived Address (PDA)
 * Seeds: ["clob_vault", mint_pubkey]
 */
export const getTokenVaultPDA = (mintPubkey: PublicKey): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("clob_vault"), mintPubkey.toBuffer()],
    CLOB_CONFIG.PROGRAM_ID
  );
};

// Helper functions for unit conversions
export const LAMPORTS_PER_SOL = 1_000_000_000;
export const USDC_DECIMALS = 6;

/**
 * Convert SOL amount to lamports
 */
export const solToLamports = (sol: number): number => {
  return Math.floor(sol * LAMPORTS_PER_SOL);
};

/**
 * Convert lamports to SOL
 */
export const lamportsToSol = (lamports: number): number => {
  return lamports / LAMPORTS_PER_SOL;
};

/**
 * Convert USDC amount to micro-USDC
 */
export const usdcToMicroUsdc = (usdc: number): number => {
  return Math.floor(usdc * Math.pow(10, USDC_DECIMALS));
};

/**
 * Convert micro-USDC to USDC
 */
export const microUsdcToUsdc = (microUsdc: number): number => {
  return microUsdc / Math.pow(10, USDC_DECIMALS);
};

// Environment-specific configuration
export const getEnvironmentConfig = () => {
  const isDev = process.env.NODE_ENV === 'development';

  return {
    // Backend API URLs (svm_clob_infra)
    API_BASE_URL: process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1',
    WS_BASE_URL: process.env.REACT_APP_WS_URL || 'ws://localhost:8001/ws',

    // Solana network
    SOLANA_RPC_URL: process.env.REACT_APP_SOLANA_RPC_URL || CLOB_CONFIG.RPC_URL,
    SOLANA_NETWORK: process.env.REACT_APP_SOLANA_NETWORK || CLOB_CONFIG.NETWORK,

    // Feature flags
    ENABLE_DEVTOOLS: isDev,
    ENABLE_MOCK_DATA: process.env.REACT_APP_USE_MOCK_DATA === 'true',

    // Logging
    LOG_LEVEL: process.env.REACT_APP_LOG_LEVEL || (isDev ? 'debug' : 'warn')
  };
};