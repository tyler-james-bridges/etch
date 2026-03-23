use crate::Config;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;

use crate::tools;

/// A JSON-RPC request message.
#[derive(Debug, Deserialize)]
pub struct JsonRpcRequest {
    pub jsonrpc: String,
    pub id: Option<Value>,
    pub method: String,
    #[serde(default)]
    pub params: Option<Value>,
}

/// A JSON-RPC response message.
#[derive(Debug, Serialize)]
pub struct JsonRpcResponse {
    pub jsonrpc: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<JsonRpcError>,
}

#[derive(Debug, Serialize)]
pub struct JsonRpcError {
    pub code: i64,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<Value>,
}

impl JsonRpcResponse {
    pub fn success(id: Option<Value>, result: Value) -> Self {
        Self {
            jsonrpc: "2.0".to_string(),
            id,
            result: Some(result),
            error: None,
        }
    }

    pub fn error(id: Option<Value>, code: i64, message: String) -> Self {
        Self {
            jsonrpc: "2.0".to_string(),
            id,
            result: None,
            error: Some(JsonRpcError {
                code,
                message,
                data: None,
            }),
        }
    }
}

/// Handle an incoming JSON-RPC message and return a response.
pub async fn handle_message(line: &str, config: &Arc<Config>) -> JsonRpcResponse {
    let request: JsonRpcRequest = match serde_json::from_str(line) {
        Ok(r) => r,
        Err(e) => {
            return JsonRpcResponse::error(None, -32700, format!("Parse error: {e}"));
        }
    };

    let id = request.id.clone();

    match request.method.as_str() {
        "initialize" => handle_initialize(id, &request.params),
        "tools/list" => handle_tools_list(id),
        "tools/call" => handle_tools_call(id, &request.params, config).await,
        "notifications/initialized" => {
            // Client notification, no response needed but we return one since
            // our loop always writes. Use a null id to signal no-op.
            // Actually per MCP spec, notifications don't get responses.
            // But we need to return *something* from this function.
            // We'll handle this by returning a response the caller can skip.
            JsonRpcResponse::success(id, json!({}))
        }
        _ => JsonRpcResponse::error(id, -32601, format!("Method not found: {}", request.method)),
    }
}

fn handle_initialize(id: Option<Value>, _params: &Option<Value>) -> JsonRpcResponse {
    JsonRpcResponse::success(
        id,
        json!({
            "protocolVersion": "2024-11-05",
            "capabilities": {
                "tools": {}
            },
            "serverInfo": {
                "name": "etch-mcp-server",
                "version": "0.1.0"
            }
        }),
    )
}

fn handle_tools_list(id: Option<Value>) -> JsonRpcResponse {
    JsonRpcResponse::success(id, json!({ "tools": tools::tool_definitions() }))
}

async fn handle_tools_call(
    id: Option<Value>,
    params: &Option<Value>,
    config: &Arc<Config>,
) -> JsonRpcResponse {
    let params = match params {
        Some(p) => p,
        None => {
            return JsonRpcResponse::error(id, -32602, "Missing params".to_string());
        }
    };

    let tool_name = params
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    let arguments = params
        .get("arguments")
        .cloned()
        .unwrap_or(json!({}));

    let result = tools::call_tool(tool_name, &arguments, config).await;

    match result {
        Ok(content) => JsonRpcResponse::success(
            id,
            json!({
                "content": [
                    {
                        "type": "text",
                        "text": content
                    }
                ]
            }),
        ),
        Err(e) => JsonRpcResponse::success(
            id,
            json!({
                "content": [
                    {
                        "type": "text",
                        "text": format!("Error: {e}")
                    }
                ],
                "isError": true
            }),
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_valid_request() {
        let input = r#"{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}"#;
        let req: JsonRpcRequest = serde_json::from_str(input).unwrap();
        assert_eq!(req.method, "initialize");
        assert_eq!(req.id, Some(json!(1)));
    }

    #[test]
    fn test_parse_request_without_params() {
        let input = r#"{"jsonrpc":"2.0","id":2,"method":"tools/list"}"#;
        let req: JsonRpcRequest = serde_json::from_str(input).unwrap();
        assert_eq!(req.method, "tools/list");
        assert!(req.params.is_none());
    }

    #[test]
    fn test_success_response_serialization() {
        let resp = JsonRpcResponse::success(Some(json!(1)), json!({"hello": "world"}));
        let s = serde_json::to_string(&resp).unwrap();
        let v: Value = serde_json::from_str(&s).unwrap();
        assert_eq!(v["jsonrpc"], "2.0");
        assert_eq!(v["id"], 1);
        assert_eq!(v["result"]["hello"], "world");
        assert!(v.get("error").is_none());
    }

    #[test]
    fn test_error_response_serialization() {
        let resp = JsonRpcResponse::error(Some(json!(2)), -32600, "Invalid request".to_string());
        let s = serde_json::to_string(&resp).unwrap();
        let v: Value = serde_json::from_str(&s).unwrap();
        assert_eq!(v["error"]["code"], -32600);
        assert_eq!(v["error"]["message"], "Invalid request");
        assert!(v.get("result").is_none());
    }

    #[tokio::test]
    async fn test_handle_initialize() {
        let config = Arc::new(Config {
            rpc_url: "http://localhost:8545".to_string(),
            factory_address: "0x0000000000000000000000000000000000000000".to_string(),
            private_key: String::new(),
            identity_registry: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432".to_string(),
        });

        let msg = r#"{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}"#;
        let resp = handle_message(msg, &config).await;

        assert!(resp.result.is_some());
        let result = resp.result.unwrap();
        assert_eq!(result["serverInfo"]["name"], "etch-mcp-server");
        assert_eq!(result["protocolVersion"], "2024-11-05");
        assert!(result["capabilities"]["tools"].is_object());
    }

    #[tokio::test]
    async fn test_handle_tools_list() {
        let config = Arc::new(Config {
            rpc_url: "http://localhost:8545".to_string(),
            factory_address: "0x0000000000000000000000000000000000000000".to_string(),
            private_key: String::new(),
            identity_registry: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432".to_string(),
        });

        let msg = r#"{"jsonrpc":"2.0","id":2,"method":"tools/list"}"#;
        let resp = handle_message(msg, &config).await;

        assert!(resp.result.is_some());
        let result = resp.result.unwrap();
        let tools = result["tools"].as_array().unwrap();
        assert_eq!(tools.len(), 3);

        let names: Vec<&str> = tools.iter().map(|t| t["name"].as_str().unwrap()).collect();
        assert!(names.contains(&"etch"));
        assert!(names.contains(&"etch_check"));
        assert!(names.contains(&"etch_resolve"));
    }

    #[tokio::test]
    async fn test_handle_unknown_method() {
        let config = Arc::new(Config {
            rpc_url: "http://localhost:8545".to_string(),
            factory_address: "0x0000000000000000000000000000000000000000".to_string(),
            private_key: String::new(),
            identity_registry: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432".to_string(),
        });

        let msg = r#"{"jsonrpc":"2.0","id":3,"method":"unknown/method"}"#;
        let resp = handle_message(msg, &config).await;

        assert!(resp.error.is_some());
        assert_eq!(resp.error.unwrap().code, -32601);
    }

    #[tokio::test]
    async fn test_handle_invalid_json() {
        let config = Arc::new(Config {
            rpc_url: "http://localhost:8545".to_string(),
            factory_address: "0x0000000000000000000000000000000000000000".to_string(),
            private_key: String::new(),
            identity_registry: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432".to_string(),
        });

        let msg = r#"not valid json"#;
        let resp = handle_message(msg, &config).await;

        assert!(resp.error.is_some());
        assert_eq!(resp.error.unwrap().code, -32700);
    }
}
