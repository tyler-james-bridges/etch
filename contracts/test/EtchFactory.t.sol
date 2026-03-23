// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {EtchFactory} from "../src/EtchFactory.sol";

contract EtchFactoryTest is Test {
    EtchFactory public factory;
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    event Etched(
        uint256 indexed tokenId,
        address indexed to,
        string uri,
        uint8 tokenType,
        bool soulbound
    );

    function setUp() public {
        factory = new EtchFactory();
    }

    // -- Mint each token type -------------------------------------------------

    function test_mintIdentity() public {
        factory.etch(alice, "ipfs://identity", 0, false);
        assertEq(factory.ownerOf(0), alice);
        assertEq(factory.tokenType(0), 0);
    }

    function test_mintAttestation() public {
        factory.etch(alice, "ipfs://attestation", 1, false);
        assertEq(factory.tokenType(0), 1);
    }

    function test_mintCredential() public {
        factory.etch(alice, "ipfs://credential", 2, false);
        assertEq(factory.tokenType(0), 2);
    }

    function test_mintReceipt() public {
        factory.etch(alice, "ipfs://receipt", 3, false);
        assertEq(factory.tokenType(0), 3);
    }

    function test_mintPass() public {
        factory.etch(alice, "ipfs://pass", 4, false);
        assertEq(factory.tokenType(0), 4);
    }

    // -- Soulbound enforcement ------------------------------------------------

    function test_soulboundBlocksTransfer() public {
        factory.etch(alice, "ipfs://soul", 0, true);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(EtchFactory.SoulboundTransfer.selector, 0));
        factory.transferFrom(alice, bob, 0);
    }

    function test_soulboundBlocksSafeTransfer() public {
        factory.etch(alice, "ipfs://soul", 0, true);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(EtchFactory.SoulboundTransfer.selector, 0));
        factory.safeTransferFrom(alice, bob, 0);
    }

    // -- Non-soulbound CAN transfer -------------------------------------------

    function test_nonSoulboundCanTransfer() public {
        factory.etch(alice, "ipfs://free", 0, false);

        vm.prank(alice);
        factory.transferFrom(alice, bob, 0);
        assertEq(factory.ownerOf(0), bob);
    }

    // -- tokenURI -------------------------------------------------------------

    function test_tokenURI() public {
        factory.etch(alice, "ipfs://QmTest123", 0, false);
        assertEq(factory.tokenURI(0), "ipfs://QmTest123");
    }

    // -- tokenType ------------------------------------------------------------

    function test_tokenTypeReturnsCorrectType() public {
        factory.etch(alice, "uri", 3, false);
        assertEq(factory.tokenType(0), 3);
    }

    // -- isSoulbound ----------------------------------------------------------

    function test_isSoulboundTrue() public {
        factory.etch(alice, "uri", 0, true);
        assertTrue(factory.isSoulbound(0));
    }

    function test_isSoulboundFalse() public {
        factory.etch(alice, "uri", 0, false);
        assertFalse(factory.isSoulbound(0));
    }

    // -- Invalid token type ---------------------------------------------------

    function test_invalidTokenTypeReverts() public {
        vm.expectRevert(abi.encodeWithSelector(EtchFactory.InvalidTokenType.selector, 5));
        factory.etch(alice, "uri", 5, false);
    }

    function test_invalidTokenType255Reverts() public {
        vm.expectRevert(abi.encodeWithSelector(EtchFactory.InvalidTokenType.selector, 255));
        factory.etch(alice, "uri", 255, false);
    }

    // -- Fuzz: valid token types ----------------------------------------------

    function testFuzz_mintValidTokenType(uint8 _type) public {
        vm.assume(_type <= 4);
        factory.etch(alice, "ipfs://fuzz", _type, false);
        assertEq(factory.tokenType(0), _type);
    }

    // -- Fuzz: random addresses -----------------------------------------------

    function testFuzz_mintToRandomAddress(address to) public {
        vm.assume(to != address(0));
        vm.assume(to.code.length == 0); // avoid contract addresses that reject ERC721
        factory.etch(to, "ipfs://fuzz-addr", 0, false);
        assertEq(factory.ownerOf(0), to);
    }

    // -- Fuzz: invalid token type always reverts ------------------------------

    function testFuzz_invalidTokenTypeReverts(uint8 _type) public {
        vm.assume(_type > 4);
        vm.expectRevert(abi.encodeWithSelector(EtchFactory.InvalidTokenType.selector, _type));
        factory.etch(alice, "uri", _type, false);
    }

    // -- Pause ----------------------------------------------------------------

    function test_pauseBlocksMinting() public {
        factory.pause();
        vm.expectRevert();
        factory.etch(alice, "uri", 0, false);
    }

    function test_unpauseAllowsMinting() public {
        factory.pause();
        factory.unpause();
        factory.etch(alice, "uri", 0, false);
        assertEq(factory.ownerOf(0), alice);
    }

    // -- Etched event ---------------------------------------------------------

    function test_etchEmitsEvent() public {
        vm.expectEmit(true, true, false, true);
        emit Etched(0, alice, "ipfs://event", 2, true);
        factory.etch(alice, "ipfs://event", 2, true);
    }

    // -- Auto-increment IDs ---------------------------------------------------

    function test_autoIncrementIds() public {
        factory.etch(alice, "uri1", 0, false);
        factory.etch(bob, "uri2", 1, false);
        factory.etch(alice, "uri3", 2, true);

        assertEq(factory.ownerOf(0), alice);
        assertEq(factory.ownerOf(1), bob);
        assertEq(factory.ownerOf(2), alice);
    }
}
