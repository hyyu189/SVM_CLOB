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
  PROGRAM_ID: new PublicKey("JBphRWHYzHCiVvYB89vGM9NpaDmHbe1A9W156sRV52Bo"),
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
  const env = import.meta.env;
  const mode = env.MODE ?? 'development';

  return {
    API_BASE_URL: env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1',
    WS_BASE_URL: env.VITE_WS_BASE_URL || 'ws://localhost:8081/ws',
    SOLANA_RPC_URL: env.VITE_SOLANA_RPC_URL || CLOB_CONFIG.RPC_URL,
    SOLANA_NETWORK: env.VITE_SOLANA_NETWORK || CLOB_CONFIG.NETWORK,
    ENABLE_DEVTOOLS: mode === 'development',
    ENABLE_MOCK_DATA: env.VITE_USE_MOCK_API === 'true',
    LOG_LEVEL: env.VITE_LOG_LEVEL || (mode === 'development' ? 'debug' : 'warn')
  } as const;
};
