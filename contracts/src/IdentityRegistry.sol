// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/// @title IdentityRegistry
/// @notice Minimal ERC-8004-style registry: register(agentURI) mints a non-transferable agent token.
contract IdentityRegistry is ERC721 {
    uint256 private _nextAgentId = 1;

    mapping(uint256 => string) private _agentURI;
    mapping(address => uint256) private _agentOf;

    error AlreadyRegistered(address account, uint256 agentId);
    error NonTransferable();

    constructor() ERC721("Agent Identity", "AGENT") {}

    function register(string calldata agentURI_) external returns (uint256 agentId) {
        if (_agentOf[msg.sender] != 0) {
            revert AlreadyRegistered(msg.sender, _agentOf[msg.sender]);
        }

        agentId = _nextAgentId++;
        _agentOf[msg.sender] = agentId;
        _agentURI[agentId] = agentURI_;
        _safeMint(msg.sender, agentId);
    }

    function agentOf(address account) external view returns (uint256) {
        return _agentOf[account];
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return _agentURI[tokenId];
    }

    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) {
            revert NonTransferable();
        }
        return super._update(to, tokenId, auth);
    }
}
