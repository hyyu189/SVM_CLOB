/// CLI for SVM CLOB Infrastructure
/// 
/// This module provides a command-line interface for managing and operating
/// the SVM CLOB infrastructure components.

use svm_clob_types::*;
use svm_clob_storage::PostgresStorage;
use svm_clob_rpc_server::{RpcServerState, start_server as start_rpc_server};
use svm_clob_websocket_server::{WebSocketServerState, start_server as start_ws_server};
use svm_clob_matching_engine::MatchingEngine;
use clap::{Parser, Subcommand};
use config::{Config, File, Environment};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, error};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

/// CLI application for SVM CLOB Infrastructure
#[derive(Parser)]
#[command(name = "svm-clob")]
#[command(about = "SVM CLOB Infrastructure CLI")]
#[command(version = "0.1.0")]
pub struct Cli {
    /// Configuration file path
    #[arg(short, long, default_value = "config.toml")]
    pub config: String,
    
    /// Log level
    #[arg(short, long, default_value = "info")]
    pub log_level: String,
    
    #[command(subcommand)]
    pub command: Commands,
}

/// Available CLI commands
#[derive(Subcommand)]
pub enum Commands {
    /// Start the full CLOB infrastructure
    Start {
        /// Run in daemon mode
        #[arg(short, long)]
        daemon: bool,
    },
    /// Start only the RPC server
    StartRpc {
        /// Port to run RPC server on
        #[arg(short, long, default_value = "8080")]
        port: u16,
    },
    /// Start only the WebSocket server
    StartWs {
        /// Port to run WebSocket server on
        #[arg(short, long, default_value = "8081")]
        port: u16,
    },
    /// Initialize the database
    InitDb,
    /// Validate configuration
    ValidateConfig,
    /// Show system status
    Status,
}

/// Configuration structure
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ClobConfig {
    pub database: DatabaseConfig,
    pub redis: RedisConfig,
    pub rpc_server: ServerConfig,
    pub websocket_server: ServerConfig,
    pub orderbook: OrderbookConfig,
    pub matching_engine: MatchingEngineConfig,
    pub logging: LoggingConfig,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DatabaseConfig {
    pub url: String,
    pub max_connections: u32,
    pub min_connections: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RedisConfig {
    pub url: String,
    pub pool_size: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
    pub workers: Option<usize>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OrderbookConfig {
    pub base_mint: String,
    pub quote_mint: String,
    pub tick_size: u64,
    pub min_order_size: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MatchingEngineConfig {
    pub max_orders_per_batch: usize,
    pub matching_interval_ms: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LoggingConfig {
    pub level: String,
    pub file: Option<String>,
    pub json_format: bool,
}

impl Default for ClobConfig {
    fn default() -> Self {
        Self {
            database: DatabaseConfig {
                url: "postgresql://localhost/svm_clob".to_string(),
                max_connections: 10,
                min_connections: 1,
            },
            redis: RedisConfig {
                url: "redis://localhost:6379".to_string(),
                pool_size: 10,
            },
            rpc_server: ServerConfig {
                host: "0.0.0.0".to_string(),
                port: 8080,
                workers: None,
            },
            websocket_server: ServerConfig {
                host: "0.0.0.0".to_string(),
                port: 8081,
                workers: None,
            },
            orderbook: OrderbookConfig {
                base_mint: "So11111111111111111111111111111111111111112".to_string(), // SOL
                quote_mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v".to_string(), // USDC
                tick_size: 1000, // 0.001 USDC
                min_order_size: 1000000, // 0.001 SOL
            },
            matching_engine: MatchingEngineConfig {
                max_orders_per_batch: 100,
                matching_interval_ms: 10,
            },
            logging: LoggingConfig {
                level: "info".to_string(),
                file: None,
                json_format: false,
            },
        }
    }
}

/// Main CLI runner
pub async fn run_cli() -> Result<(), Box<dyn std::error::Error>> {
    let cli = Cli::parse();
    
    // Load configuration
    let config = load_config(&cli.config)?;
    
    // Initialize logging
    init_logging(&config.logging)?;
    
    info!("Starting SVM CLOB Infrastructure CLI");
    
    match cli.command {
        Commands::Start { daemon } => {
            start_full_infrastructure(config, daemon).await?;
        }
        Commands::StartRpc { port } => {
            start_rpc_only(config, port).await?;
        }
        Commands::StartWs { port } => {
            start_websocket_only(config, port).await?;
        }
        Commands::InitDb => {
            init_database(config).await?;
        }
        Commands::ValidateConfig => {
            validate_config(config)?;
        }
        Commands::Status => {
            show_status(config).await?;
        }
    }
    
    Ok(())
}

/// Load configuration from file and environment
fn load_config(config_path: &str) -> Result<ClobConfig, Box<dyn std::error::Error>> {
    let mut config_builder = Config::builder()
        .add_source(File::with_name(config_path).required(false))
        .add_source(Environment::with_prefix("CLOB"));
    
    // If config file doesn't exist, create default one
    if !std::path::Path::new(config_path).exists() {
        let default_config = ClobConfig::default();
        let config_content = toml::to_string_pretty(&default_config)?;
        std::fs::write(config_path, config_content)?;
        info!("Created default configuration file: {}", config_path);
    }
    
    let config = config_builder.build()?;
    let clob_config: ClobConfig = config.try_deserialize()?;
    
    Ok(clob_config)
}

/// Initialize logging based on configuration
fn init_logging(config: &LoggingConfig) -> Result<(), Box<dyn std::error::Error>> {
    let level = config.level.parse()?;
    
    let registry = tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(&config.level));
    
    if config.json_format {
        registry
            .with(tracing_subscriber::fmt::layer().json())
            .init();
    } else {
        registry
            .with(tracing_subscriber::fmt::layer())
            .init();
    }
    
    Ok(())
}

/// Start the full CLOB infrastructure
async fn start_full_infrastructure(
    config: ClobConfig,
    _daemon: bool,
) -> Result<(), Box<dyn std::error::Error>> {
    info!("Starting full CLOB infrastructure");
    
    // Initialize storage
    let storage = Arc::new(PostgresStorage::new(&config.database.url).await?);
    
    // Create orderbook configuration
    let orderbook_config = OrderBook {
        authority: solana_sdk::pubkey::Pubkey::default(),
        base_mint: config.orderbook.base_mint.parse()?,
        quote_mint: config.orderbook.quote_mint.parse()?,
        tick_size: config.orderbook.tick_size,
        min_order_size: config.orderbook.min_order_size,
        sequence_number: 0,
        total_orders: 0,
        best_bid: 0,
        best_ask: u64::MAX,
        total_volume: 0,
        is_initialized: true,
        is_paused: false,
    };
    
    // Initialize matching engine
    let matching_engine = Arc::new(RwLock::new(
        MatchingEngine::new(storage.clone(), orderbook_config)
    ));
    
    // Create RPC server state
    let rpc_state = Arc::new(RpcServerState {
        matching_engine: matching_engine.clone(),
        storage: storage.clone(),
    });
    
    // Create WebSocket server state
    let ws_state = Arc::new(WebSocketServerState::new());
    
    // Start servers concurrently
    let rpc_handle = tokio::spawn(start_rpc_server(rpc_state, config.rpc_server.port));
    let ws_handle = tokio::spawn(start_ws_server(ws_state, config.websocket_server.port));
    
    info!("All services started successfully");
    
    // Wait for both servers
    tokio::try_join!(rpc_handle, ws_handle)??;
    
    Ok(())
}

/// Start only the RPC server
async fn start_rpc_only(
    config: ClobConfig,
    port: u16,
) -> Result<(), Box<dyn std::error::Error>> {
    info!("Starting RPC server only on port {}", port);
    
    let storage = Arc::new(PostgresStorage::new(&config.database.url).await?);
    
    let orderbook_config = OrderBook {
        authority: solana_sdk::pubkey::Pubkey::default(),
        base_mint: config.orderbook.base_mint.parse()?,
        quote_mint: config.orderbook.quote_mint.parse()?,
        tick_size: config.orderbook.tick_size,
        min_order_size: config.orderbook.min_order_size,
        sequence_number: 0,
        total_orders: 0,
        best_bid: 0,
        best_ask: u64::MAX,
        total_volume: 0,
        is_initialized: true,
        is_paused: false,
    };
    
    let matching_engine = Arc::new(RwLock::new(
        MatchingEngine::new(storage.clone(), orderbook_config)
    ));
    
    let rpc_state = Arc::new(RpcServerState {
        matching_engine,
        storage,
    });
    
    start_rpc_server(rpc_state, port).await?;
    
    Ok(())
}

/// Start only the WebSocket server
async fn start_websocket_only(
    _config: ClobConfig,
    port: u16,
) -> Result<(), Box<dyn std::error::Error>> {
    info!("Starting WebSocket server only on port {}", port);
    
    let ws_state = Arc::new(WebSocketServerState::new());
    start_ws_server(ws_state, port).await?;
    
    Ok(())
}

/// Initialize the database
async fn init_database(config: ClobConfig) -> Result<(), Box<dyn std::error::Error>> {
    info!("Initializing database");
    
    let _storage = PostgresStorage::new(&config.database.url).await?;
    
    info!("Database initialized successfully");
    Ok(())
}

/// Validate configuration
fn validate_config(config: ClobConfig) -> Result<(), Box<dyn std::error::Error>> {
    info!("Validating configuration");
    
    // Validate database URL format
    if !config.database.url.starts_with("postgresql://") {
        return Err("Invalid database URL format".into());
    }
    
    // Validate Redis URL format
    if !config.redis.url.starts_with("redis://") {
        return Err("Invalid Redis URL format".into());
    }
    
    // Validate mint addresses
    let _base_mint: solana_sdk::pubkey::Pubkey = config.orderbook.base_mint.parse()?;
    let _quote_mint: solana_sdk::pubkey::Pubkey = config.orderbook.quote_mint.parse()?;
    
    // Validate tick size and min order size
    if config.orderbook.tick_size == 0 {
        return Err("Tick size must be greater than 0".into());
    }
    
    if config.orderbook.min_order_size == 0 {
        return Err("Minimum order size must be greater than 0".into());
    }
    
    info!("Configuration is valid");
    Ok(())
}

/// Show system status
async fn show_status(_config: ClobConfig) -> Result<(), Box<dyn std::error::Error>> {
    info!("System Status:");
    info!("- Version: 0.1.0");
    info!("- Status: Running");
    info!("- Uptime: Not implemented yet");
    
    // TODO: Add actual status checks for databases, servers, etc.
    
    Ok(())
}