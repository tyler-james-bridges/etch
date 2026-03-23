mod contracts;
mod mcp;
mod tools;

use clap::Parser;
use std::sync::Arc;
use tokio::io::{self, AsyncBufReadExt, AsyncWriteExt, BufReader};

#[derive(Parser, Debug)]
#[command(name = "etch-mcp-server", about = "MCP server for ETCH onchain records")]
pub struct Config {
    /// RPC URL for Abstract chain
    #[arg(long, env = "ETCH_RPC_URL", default_value = "https://api.mainnet.abs.xyz")]
    pub rpc_url: String,

    /// EtchFactory contract address
    #[arg(long, env = "ETCH_FACTORY_ADDRESS", default_value = "0x0000000000000000000000000000000000000000")]
    pub factory_address: String,

    /// Private key for signing transactions
    #[arg(long, env = "ETCH_PRIVATE_KEY", default_value = "")]
    pub private_key: String,

    /// ERC-8004 Identity Registry address
    #[arg(
        long,
        env = "ETCH_IDENTITY_REGISTRY",
        default_value = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"
    )]
    pub identity_registry: String,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let config = Config::parse();
    let config = Arc::new(config);

    eprintln!("etch-mcp-server starting...");
    eprintln!("RPC URL: {}", config.rpc_url);
    eprintln!("Factory: {}", config.factory_address);
    eprintln!("Identity Registry: {}", config.identity_registry);

    let stdin = io::stdin();
    let mut stdout = io::stdout();
    let reader = BufReader::new(stdin);
    let mut lines = reader.lines();

    while let Some(line) = lines.next_line().await? {
        let line = line.trim().to_string();
        if line.is_empty() {
            continue;
        }

        eprintln!("< {}", line);

        let response = mcp::handle_message(&line, &config).await;

        let response_str = serde_json::to_string(&response)?;
        eprintln!("> {}", response_str);

        stdout.write_all(response_str.as_bytes()).await?;
        stdout.write_all(b"\n").await?;
        stdout.flush().await?;
    }

    eprintln!("etch-mcp-server shutting down.");
    Ok(())
}
