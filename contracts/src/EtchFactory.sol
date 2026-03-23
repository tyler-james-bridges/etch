// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/// @title EtchFactory
/// @notice Mint typed, optionally soulbound ERC-721 tokens on Abstract.
/// @dev Paymaster: 0x5407B5040dec3D339A9247f3654E59EEccbb6391
contract EtchFactory is ERC721, Ownable, Pausable {
    // -- Types ----------------------------------------------------------------

    enum TokenType {
        Identity,    // 0
        Attestation, // 1
        Credential,  // 2
        Receipt,     // 3
        Pass         // 4
    }

    // -- Storage --------------------------------------------------------------

    uint256 private _nextTokenId;

    struct TokenData {
        string uri;
        uint8 tokenType;
        bool soulbound;
    }

    mapping(uint256 => TokenData) private _tokenData;

    // -- Events ---------------------------------------------------------------

    event Etched(
        uint256 indexed tokenId,
        address indexed to,
        string uri,
        uint8 tokenType,
        bool soulbound
    );

    // -- Errors ---------------------------------------------------------------

    error InvalidTokenType(uint8 tokenType);
    error SoulboundTransfer(uint256 tokenId);

    // -- Constructor ----------------------------------------------------------

    constructor() ERC721("Etch", "ETCH") Ownable(msg.sender) {}

    // -- Mint -----------------------------------------------------------------

    /// @notice Mint a new ETCH token.
    /// @param to        Recipient address.
    /// @param uri       Metadata URI for the token.
    /// @param _tokenType Token type (0-4). See `TokenType` enum.
    /// @param soulbound  If true, the token cannot be transferred.
    function etch(
        address to,
        string calldata uri,
        uint8 _tokenType,
        bool soulbound
    ) external whenNotPaused returns (uint256) {
        if (_tokenType > uint8(type(TokenType).max)) {
            revert InvalidTokenType(_tokenType);
        }

        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);

        _tokenData[tokenId] = TokenData({
            uri: uri,
            tokenType: _tokenType,
            soulbound: soulbound
        });

        emit Etched(tokenId, to, uri, _tokenType, soulbound);
        return tokenId;
    }

    // -- Views ----------------------------------------------------------------

    /// @notice Returns the token type for a given token.
    function tokenType(uint256 tokenId) external view returns (uint8) {
        _requireOwned(tokenId);
        return _tokenData[tokenId].tokenType;
    }

    /// @notice Returns whether a token is soulbound.
    function isSoulbound(uint256 tokenId) external view returns (bool) {
        _requireOwned(tokenId);
        return _tokenData[tokenId].soulbound;
    }

    /// @inheritdoc ERC721
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return _tokenData[tokenId].uri;
    }

    // -- Soulbound enforcement ------------------------------------------------

    /// @dev Blocks transfers of soulbound tokens. Minting (from == address(0)) is always allowed.
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address) {
        address from = _ownerOf(tokenId);

        if (from != address(0) && _tokenData[tokenId].soulbound) {
            revert SoulboundTransfer(tokenId);
        }

        return super._update(to, tokenId, auth);
    }

    // -- Admin ----------------------------------------------------------------

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
