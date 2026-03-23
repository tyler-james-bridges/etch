use alloy::sol;

// EtchFactory contract interface
sol! {
    #[sol(rpc)]
    interface IEtchFactory {
        function etch(address to, string calldata uri, uint8 _tokenType, bool soulbound) external returns (uint256);
        function tokenType(uint256 tokenId) external view returns (uint8);
        function isSoulbound(uint256 tokenId) external view returns (bool);
        function tokenURI(uint256 tokenId) external view returns (string memory);
        function balanceOf(address owner) external view returns (uint256);
        function ownerOf(uint256 tokenId) external view returns (address);

        event Etched(uint256 indexed tokenId, address indexed to, string uri, uint8 tokenType, bool soulbound);
    }
}

// ERC-8004 Identity Registry interface
sol! {
    #[sol(rpc)]
    interface IIdentityRegistry {
        function agentOf(address account) external view returns (uint256);
        function agentUri(uint256 tokenId) external view returns (string memory);
        function ownerOf(uint256 tokenId) external view returns (address);
        function name() external view returns (string memory);
    }
}

/// Convert a token type string to its uint8 representation.
pub fn token_type_to_u8(token_type: &str) -> Option<u8> {
    match token_type.to_lowercase().as_str() {
        "identity" => Some(0),
        "attestation" => Some(1),
        "credential" => Some(2),
        "receipt" => Some(3),
        "pass" => Some(4),
        _ => None,
    }
}

/// Convert a uint8 token type to its string representation.
pub fn token_type_to_string(token_type: u8) -> &'static str {
    match token_type {
        0 => "identity",
        1 => "attestation",
        2 => "credential",
        3 => "receipt",
        4 => "pass",
        _ => "unknown",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_token_type_to_u8() {
        assert_eq!(token_type_to_u8("identity"), Some(0));
        assert_eq!(token_type_to_u8("attestation"), Some(1));
        assert_eq!(token_type_to_u8("credential"), Some(2));
        assert_eq!(token_type_to_u8("receipt"), Some(3));
        assert_eq!(token_type_to_u8("pass"), Some(4));
        assert_eq!(token_type_to_u8("Identity"), Some(0)); // case insensitive
        assert_eq!(token_type_to_u8("PASS"), Some(4));
        assert_eq!(token_type_to_u8("invalid"), None);
        assert_eq!(token_type_to_u8(""), None);
    }

    #[test]
    fn test_token_type_to_string() {
        assert_eq!(token_type_to_string(0), "identity");
        assert_eq!(token_type_to_string(1), "attestation");
        assert_eq!(token_type_to_string(2), "credential");
        assert_eq!(token_type_to_string(3), "receipt");
        assert_eq!(token_type_to_string(4), "pass");
        assert_eq!(token_type_to_string(5), "unknown");
        assert_eq!(token_type_to_string(255), "unknown");
    }
}
