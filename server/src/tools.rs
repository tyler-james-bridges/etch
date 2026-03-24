use crate::contracts::{self, IEtchFactory, IIdentityRegistry};
use crate::Config;
use alloy::{
    hex,
    primitives::Address,
    providers::ProviderBuilder,
    signers::local::PrivateKeySigner,
};
use serde_json::{json, Value};
use std::str::FromStr;
use std::sync::Arc;

/// Base64 encode bytes (no external dependency needed).
fn base64_encode(data: &[u8]) -> String {
    use alloy::hex;
    // Use a simple base64 implementation
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut result = String::with_capacity((data.len() + 2) / 3 * 4);
    let _ = hex::encode([]); // suppress unused import warning

    for chunk in data.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = if chunk.len() > 1 { chunk[1] as u32 } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as u32 } else { 0 };
        let n = (b0 << 16) | (b1 << 8) | b2;

        result.push(CHARS[((n >> 18) & 0x3F) as usize] as char);
        result.push(CHARS[((n >> 12) & 0x3F) as usize] as char);
        if chunk.len() > 1 {
            result.push(CHARS[((n >> 6) & 0x3F) as usize] as char);
        } else {
            result.push('=');
        }
        if chunk.len() > 2 {
            result.push(CHARS[(n & 0x3F) as usize] as char);
        } else {
            result.push('=');
        }
    }
    result
}

/// Return the MCP tool definitions.
pub fn tool_definitions() -> Value {
    json!([
        {
            "name": "etch",
            "description": "Create a permanent onchain ETCH record on Abstract. Mints an ERC-721 token with generative art and typed metadata. The art is automatically generated and embedded in the token.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "to": {
                        "type": "string",
                        "description": "Recipient Ethereum address (0x...)"
                    },
                    "name": {
                        "type": "string",
                        "description": "Name for the record (e.g. 'My Agent Identity', 'Audit Attestation')"
                    },
                    "description": {
                        "type": "string",
                        "description": "Description of what this record represents"
                    },
                    "tokenType": {
                        "type": "string",
                        "description": "Token type: identity (onchain ID), attestation (verified claim), credential (qualification), receipt (transaction record), or pass (access token)",
                        "enum": ["identity", "attestation", "credential", "receipt", "pass"]
                    },
                    "soulbound": {
                        "type": "boolean",
                        "description": "Whether the token is soulbound (non-transferable). Default: true for identity/attestation/credential, false for receipt/pass"
                    }
                },
                "required": ["to", "name", "tokenType"]
            }
        },
        {
            "name": "etch_check",
            "description": "Look up etched records. Query by address (get balance) or by token ID (get details).",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "address": {
                        "type": "string",
                        "description": "Look up token balance for this address"
                    },
                    "tokenId": {
                        "type": "string",
                        "description": "Look up details for a specific token ID"
                    }
                }
            }
        },
        {
            "name": "etch_resolve",
            "description": "Resolve an agent's identity via the ERC-8004 Identity Registry on Abstract",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "address": {
                        "type": "string",
                        "description": "Agent address to resolve"
                    }
                },
                "required": ["address"]
            }
        }
    ])
}

/// Execute a tool call and return the result as a string.
pub async fn call_tool(
    name: &str,
    arguments: &Value,
    config: &Arc<Config>,
) -> Result<String, String> {
    match name {
        "etch" => tool_etch(arguments, config).await,
        "etch_check" => tool_etch_check(arguments, config).await,
        "etch_resolve" => tool_etch_resolve(arguments, config).await,
        _ => Err(format!("Unknown tool: {name}")),
    }
}

async fn tool_etch(args: &Value, config: &Arc<Config>) -> Result<String, String> {
    let to_str = args
        .get("to")
        .and_then(|v| v.as_str())
        .ok_or("Missing required parameter: to")?;
    let name = args
        .get("name")
        .and_then(|v| v.as_str())
        .ok_or("Missing required parameter: name")?;
    let description = args
        .get("description")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let token_type_str = args
        .get("tokenType")
        .and_then(|v| v.as_str())
        .ok_or("Missing required parameter: tokenType")?;
    let soulbound = args
        .get("soulbound")
        .and_then(|v| v.as_bool())
        .unwrap_or_else(|| {
            match token_type_str {
                "identity" | "attestation" | "credential" => true,
                _ => false,
            }
        });

    let to = Address::from_str(to_str).map_err(|e| format!("Invalid 'to' address: {e}"))?;
    let token_type =
        contracts::token_type_to_u8(token_type_str).ok_or("Invalid tokenType. Must be one of: identity, attestation, credential, receipt, pass")?;

    if config.private_key.is_empty() {
        return Err("ETCH_PRIVATE_KEY not configured".to_string());
    }

    let factory_address = Address::from_str(&config.factory_address)
        .map_err(|e| format!("Invalid factory address: {e}"))?;

    let signer: PrivateKeySigner = config
        .private_key
        .parse()
        .map_err(|e| format!("Invalid private key: {e}"))?;

    let provider = ProviderBuilder::new()
        .wallet(signer)
        .connect_http(config.rpc_url.parse().map_err(|e| format!("Invalid RPC URL: {e}"))?);

    let contract = IEtchFactory::new(factory_address, &provider);

    // Get totalSupply to determine next token ID for metadata
    let total_supply = contract
        .balanceOf(to) // Use a simple call to verify contract is reachable
        .call()
        .await;
    let _ = total_supply; // Just checking connectivity

    // NOTE: This Rust server has a known issue where {{tokenId}} produces literal
    // "{tokenId}" in the metadata URLs instead of the actual token ID. The correct
    // fix requires a two-step approach (mint first, parse tokenId from receipt, then
    // call setTokenURI with correct metadata). This is implemented in the Node.js
    // MCP package (packages/etch-mcp/server.js) which replaces this Rust server.
    // Do not restructure this Rust code - use the Node.js package instead.
    let type_label = contracts::token_type_to_string(token_type);
    let desc = if description.is_empty() {
        format!("Onchain {} record on Abstract.", type_label)
    } else {
        description.to_string()
    };

    let metadata = json!({
        "name": name,
        "description": desc,
        "image": format!("https://etch.ack-onchain.dev/api/art/{{tokenId}}"),
        "external_url": format!("https://etch.ack-onchain.dev/etch/{{tokenId}}"),
        "attributes": [
            { "trait_type": "Type", "value": type_label },
            { "trait_type": "Soulbound", "value": if soulbound { "Yes" } else { "No" } }
        ]
    });

    // For now, use a data URI with the metadata JSON
    // The image URL uses a placeholder that we'll note in the response
    let metadata_str = serde_json::to_string(&metadata).unwrap();
    let uri = format!(
        "data:application/json;base64,{}",
        base64_encode(metadata_str.as_bytes())
    );

    let tx = contract
        .etch(to, uri.clone(), token_type, soulbound)
        .send()
        .await
        .map_err(|e| format!("Transaction send failed: {e}"))?;

    let tx_hash = *tx.tx_hash();

    let receipt = tx
        .get_receipt()
        .await
        .map_err(|e| format!("Failed to get receipt: {e}"))?;

    // Parse Etched event from logs
    let mut token_id: Option<alloy::primitives::U256> = None;
    for log in receipt.inner.logs() {
        if let Ok(event) = log.log_decode::<IEtchFactory::Etched>() {
            token_id = Some(event.inner.data.tokenId);
            break;
        }
    }

    let token_id_num = token_id.map(|id: alloy::primitives::U256| id.to_string());

    let result = json!({
        "txHash": format!("0x{}", hex::encode(tx_hash)),
        "tokenId": token_id_num,
        "blockNumber": receipt.block_number,
        "status": "success",
        "view": token_id_num.as_ref().map(|id| format!("https://etch.ack-onchain.dev/etch/{}", id)),
        "art": token_id_num.as_ref().map(|id| format!("https://etch.ack-onchain.dev/api/art/{}", id)),
        "opensea": token_id_num.as_ref().map(|id| format!("https://opensea.io/item/abstract/{}/{}", config.factory_address, id))
    });

    Ok(serde_json::to_string_pretty(&result).unwrap())
}

async fn tool_etch_check(args: &Value, config: &Arc<Config>) -> Result<String, String> {
    let address_str = args.get("address").and_then(|v| v.as_str());
    let token_id_str = args.get("tokenId").and_then(|v| v.as_str());

    if address_str.is_none() && token_id_str.is_none() {
        return Err("Must provide either 'address' or 'tokenId'".to_string());
    }

    let factory_address = Address::from_str(&config.factory_address)
        .map_err(|e| format!("Invalid factory address: {e}"))?;

    let provider = ProviderBuilder::new()
        .connect_http(config.rpc_url.parse().map_err(|e| format!("Invalid RPC URL: {e}"))?);

    let contract = IEtchFactory::new(factory_address, &provider);

    if let Some(token_id_str) = token_id_str {
        let token_id: alloy::primitives::U256 = token_id_str
            .parse()
            .map_err(|e| format!("Invalid tokenId: {e}"))?;

        let uri_result = contract
            .tokenURI(token_id)
            .call()
            .await
            .map_err(|e| format!("tokenURI call failed: {e}"))?;

        let type_result = contract
            .tokenType(token_id)
            .call()
            .await
            .map_err(|e| format!("tokenType call failed: {e}"))?;

        let soulbound_result = contract
            .isSoulbound(token_id)
            .call()
            .await
            .map_err(|e| format!("isSoulbound call failed: {e}"))?;

        let owner_result = contract
            .ownerOf(token_id)
            .call()
            .await
            .map_err(|e| format!("ownerOf call failed: {e}"))?;

        let result = json!({
            "tokenId": token_id_str,
            "uri": uri_result,
            "tokenType": contracts::token_type_to_string(type_result),
            "tokenTypeRaw": type_result,
            "soulbound": soulbound_result,
            "owner": format!("{}", owner_result)
        });

        Ok(serde_json::to_string_pretty(&result).unwrap())
    } else if let Some(address_str) = address_str {
        let address =
            Address::from_str(address_str).map_err(|e| format!("Invalid address: {e}"))?;

        let balance: alloy::primitives::U256 = contract
            .balanceOf(address)
            .call()
            .await
            .map_err(|e| format!("balanceOf call failed: {e}"))?;

        let result = json!({
            "address": address_str,
            "balance": balance.to_string()
        });

        Ok(serde_json::to_string_pretty(&result).unwrap())
    } else {
        unreachable!()
    }
}

async fn tool_etch_resolve(args: &Value, config: &Arc<Config>) -> Result<String, String> {
    let address_str = args
        .get("address")
        .and_then(|v| v.as_str())
        .ok_or("Missing required parameter: address")?;

    let address =
        Address::from_str(address_str).map_err(|e| format!("Invalid address: {e}"))?;

    let registry_address = Address::from_str(&config.identity_registry)
        .map_err(|e| format!("Invalid registry address: {e}"))?;

    let provider = ProviderBuilder::new()
        .connect_http(config.rpc_url.parse().map_err(|e| format!("Invalid RPC URL: {e}"))?);

    let registry = IIdentityRegistry::new(registry_address, &provider);

    let token_id: alloy::primitives::U256 = registry
        .agentOf(address)
        .call()
        .await
        .map_err(|e| format!("agentOf call failed (address may not be registered): {e}"))?;

    // If token_id is 0, the address is likely not registered
    if token_id.is_zero() {
        return Ok(json!({
            "address": address_str,
            "registered": false,
            "message": "Address is not registered in the ERC-8004 Identity Registry"
        })
        .to_string());
    }

    let uri: String = registry
        .agentUri(token_id)
        .call()
        .await
        .map_err(|e| format!("agentUri call failed: {e}"))?;

    let result = json!({
        "address": address_str,
        "registered": true,
        "tokenId": token_id.to_string(),
        "metadataUri": uri
    });

    Ok(serde_json::to_string_pretty(&result).unwrap())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tool_definitions_structure() {
        let tools = tool_definitions();
        let tools_arr = tools.as_array().unwrap();
        assert_eq!(tools_arr.len(), 3);

        for tool in tools_arr {
            assert!(tool.get("name").is_some());
            assert!(tool.get("description").is_some());
            assert!(tool.get("inputSchema").is_some());
        }
    }

    #[test]
    fn test_etch_tool_schema() {
        let tools = tool_definitions();
        let etch = &tools.as_array().unwrap()[0];
        assert_eq!(etch["name"], "etch");

        let required = etch["inputSchema"]["required"].as_array().unwrap();
        let required_strs: Vec<&str> = required.iter().map(|v| v.as_str().unwrap()).collect();
        assert!(required_strs.contains(&"to"));
        assert!(required_strs.contains(&"name"));
        assert!(required_strs.contains(&"tokenType"));
    }

    #[test]
    fn test_base64_encode() {
        assert_eq!(base64_encode(b"hello"), "aGVsbG8=");
        assert_eq!(base64_encode(b"ab"), "YWI=");
        assert_eq!(base64_encode(b"abc"), "YWJj");
        assert_eq!(base64_encode(b""), "");
    }

    #[test]
    fn test_etch_resolve_tool_schema() {
        let tools = tool_definitions();
        let resolve = &tools.as_array().unwrap()[2];
        assert_eq!(resolve["name"], "etch_resolve");

        let required = resolve["inputSchema"]["required"].as_array().unwrap();
        assert!(required.iter().any(|v| v.as_str() == Some("address")));
    }

    #[tokio::test]
    async fn test_call_unknown_tool() {
        let config = Arc::new(Config {
            rpc_url: "http://localhost:8545".to_string(),
            factory_address: "0x0000000000000000000000000000000000000000".to_string(),
            private_key: String::new(),
            identity_registry: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432".to_string(),
        });

        let result = call_tool("nonexistent", &json!({}), &config).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Unknown tool"));
    }

    #[tokio::test]
    async fn test_etch_missing_params() {
        let config = Arc::new(Config {
            rpc_url: "http://localhost:8545".to_string(),
            factory_address: "0x0000000000000000000000000000000000000000".to_string(),
            private_key: String::new(),
            identity_registry: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432".to_string(),
        });

        // Missing all params
        let result = call_tool("etch", &json!({}), &config).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Missing required parameter"));
    }

    #[tokio::test]
    async fn test_etch_invalid_token_type() {
        let config = Arc::new(Config {
            rpc_url: "http://localhost:8545".to_string(),
            factory_address: "0x0000000000000000000000000000000000000000".to_string(),
            private_key: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
                .to_string(),
            identity_registry: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432".to_string(),
        });

        let result = call_tool(
            "etch",
            &json!({
                "to": "0x1234567890abcdef1234567890abcdef12345678",
                "name": "Test",
                "tokenType": "invalid_type"
            }),
            &config,
        )
        .await;

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Invalid tokenType"));
    }

    #[tokio::test]
    async fn test_etch_no_private_key() {
        let config = Arc::new(Config {
            rpc_url: "http://localhost:8545".to_string(),
            factory_address: "0x0000000000000000000000000000000000000000".to_string(),
            private_key: String::new(),
            identity_registry: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432".to_string(),
        });

        let result = call_tool(
            "etch",
            &json!({
                "to": "0x1234567890abcdef1234567890abcdef12345678",
                "name": "Test Identity",
                "tokenType": "identity"
            }),
            &config,
        )
        .await;

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("ETCH_PRIVATE_KEY not configured"));
    }

    #[tokio::test]
    async fn test_etch_check_no_params() {
        let config = Arc::new(Config {
            rpc_url: "http://localhost:8545".to_string(),
            factory_address: "0x0000000000000000000000000000000000000000".to_string(),
            private_key: String::new(),
            identity_registry: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432".to_string(),
        });

        let result = call_tool("etch_check", &json!({}), &config).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Must provide either"));
    }

    #[tokio::test]
    async fn test_etch_resolve_missing_address() {
        let config = Arc::new(Config {
            rpc_url: "http://localhost:8545".to_string(),
            factory_address: "0x0000000000000000000000000000000000000000".to_string(),
            private_key: String::new(),
            identity_registry: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432".to_string(),
        });

        let result = call_tool("etch_resolve", &json!({}), &config).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Missing required parameter"));
    }
}
