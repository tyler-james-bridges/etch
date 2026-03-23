// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {Etch} from "../src/Etch.sol";

contract EtchTest is Test {
    Etch public etch;
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    event Etched(uint256 indexed tokenId, address indexed to, string uri, uint8 tokenType, bool soulbound);
    event TokenURIUpdated(uint256 indexed tokenId, string uri);
    event Burned(uint256 indexed tokenId);

    function setUp() public {
        etch = new Etch();
    }

    // -- Mint each token type -------------------------------------------------

    function test_mintIdentity() public {
        etch.etch(alice, "data:,identity", 0, false);
        assertEq(etch.ownerOf(0), alice);
        assertEq(etch.tokenType(0), 0);
    }

    function test_mintAttestation() public {
        etch.etch(alice, "data:,attestation", 1, false);
        assertEq(etch.tokenType(0), 1);
    }

    function test_mintCredential() public {
        etch.etch(alice, "data:,credential", 2, false);
        assertEq(etch.tokenType(0), 2);
    }

    function test_mintReceipt() public {
        etch.etch(alice, "data:,receipt", 3, false);
        assertEq(etch.tokenType(0), 3);
    }

    function test_mintPass() public {
        etch.etch(alice, "data:,pass", 4, false);
        assertEq(etch.tokenType(0), 4);
    }

    // -- Soulbound enforcement ------------------------------------------------

    function test_soulboundBlocksTransfer() public {
        etch.etch(alice, "data:,soul", 0, true);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Etch.SoulboundTransfer.selector, 0));
        etch.transferFrom(alice, bob, 0);
    }

    function test_soulboundBlocksSafeTransfer() public {
        etch.etch(alice, "data:,soul", 0, true);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Etch.SoulboundTransfer.selector, 0));
        etch.safeTransferFrom(alice, bob, 0);
    }

    function test_nonSoulboundCanTransfer() public {
        etch.etch(alice, "data:,free", 0, false);
        vm.prank(alice);
        etch.transferFrom(alice, bob, 0);
        assertEq(etch.ownerOf(0), bob);
    }

    // -- tokenURI -------------------------------------------------------------

    function test_tokenURI() public {
        etch.etch(alice, "data:application/json;base64,abc", 0, false);
        assertEq(etch.tokenURI(0), "data:application/json;base64,abc");
    }

    // -- setTokenURI ----------------------------------------------------------

    function test_setTokenURI() public {
        etch.etch(alice, "data:,old", 0, false);
        assertEq(etch.tokenURI(0), "data:,old");
        etch.setTokenURI(0, "data:,new");
        assertEq(etch.tokenURI(0), "data:,new");
    }

    function test_setTokenURIEmitsEvent() public {
        etch.etch(alice, "data:,old", 0, false);
        vm.expectEmit(true, false, false, true);
        emit TokenURIUpdated(0, "data:,updated");
        etch.setTokenURI(0, "data:,updated");
    }

    function test_setTokenURIOnlyMinter() public {
        etch.etch(alice, "data:,old", 0, false);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Etch.UnauthorizedMinter.selector, alice));
        etch.setTokenURI(0, "data:,hacked");
    }

    function test_setTokenURIAuthorizedMinter() public {
        etch.etch(alice, "data:,old", 0, false);
        etch.setMinter(bob, true);
        vm.prank(bob);
        etch.setTokenURI(0, "data:,updated-by-bob");
        assertEq(etch.tokenURI(0), "data:,updated-by-bob");
    }

    function test_setTokenURINonexistentReverts() public {
        vm.expectRevert();
        etch.setTokenURI(999, "data:,nope");
    }

    // -- Burn -----------------------------------------------------------------

    function test_burnByOwner() public {
        etch.etch(alice, "data:,burn", 0, false);
        assertEq(etch.totalSupply(), 1);
        vm.prank(alice);
        etch.burn(0);
        assertEq(etch.totalSupply(), 0);
    }

    function test_burnEmitsEvent() public {
        etch.etch(alice, "data:,burn", 0, false);
        vm.prank(alice);
        vm.expectEmit(true, false, false, false);
        emit Burned(0);
        etch.burn(0);
    }

    function test_burnClearsTokenData() public {
        etch.etch(alice, "data:,burn", 2, true);
        vm.prank(alice);
        etch.burn(0);
        vm.expectRevert();
        etch.tokenURI(0);
    }

    function test_burnOnlyTokenOwner() public {
        etch.etch(alice, "data:,mine", 0, false);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(Etch.NotTokenOwner.selector, 0));
        etch.burn(0);
    }

    function test_burnSoulboundAllowed() public {
        etch.etch(alice, "data:,soul", 0, true);
        vm.prank(alice);
        etch.burn(0);
        assertEq(etch.totalSupply(), 0);
    }

    function test_contractOwnerCannotBurnOthers() public {
        etch.etch(alice, "data:,mine", 0, false);
        vm.expectRevert(abi.encodeWithSelector(Etch.NotTokenOwner.selector, 0));
        etch.burn(0);
    }

    // -- Invalid token type ---------------------------------------------------

    function test_invalidTokenTypeReverts() public {
        vm.expectRevert(abi.encodeWithSelector(Etch.InvalidTokenType.selector, 5));
        etch.etch(alice, "uri", 5, false);
    }

    // -- Fuzz -----------------------------------------------------------------

    function testFuzz_mintValidTokenType(uint8 _type) public {
        vm.assume(_type <= 4);
        etch.etch(alice, "data:,fuzz", _type, false);
        assertEq(etch.tokenType(0), _type);
    }

    function testFuzz_mintToRandomAddress(address to) public {
        vm.assume(to != address(0));
        vm.assume(to.code.length == 0);
        etch.etch(to, "data:,fuzz", 0, false);
        assertEq(etch.ownerOf(0), to);
    }

    function testFuzz_invalidTokenTypeReverts(uint8 _type) public {
        vm.assume(_type > 4);
        vm.expectRevert(abi.encodeWithSelector(Etch.InvalidTokenType.selector, _type));
        etch.etch(alice, "uri", _type, false);
    }

    // -- Pause ----------------------------------------------------------------

    function test_pauseBlocksMinting() public {
        etch.pause();
        vm.expectRevert();
        etch.etch(alice, "uri", 0, false);
    }

    function test_unpauseAllowsMinting() public {
        etch.pause();
        etch.unpause();
        etch.etch(alice, "uri", 0, false);
        assertEq(etch.ownerOf(0), alice);
    }

    // -- Events ---------------------------------------------------------------

    function test_etchEmitsEvent() public {
        vm.expectEmit(true, true, false, true);
        emit Etched(0, alice, "data:,event", 2, true);
        etch.etch(alice, "data:,event", 2, true);
    }

    // -- Auto-increment -------------------------------------------------------

    function test_autoIncrementIds() public {
        etch.etch(alice, "uri1", 0, false);
        etch.etch(bob, "uri2", 1, false);
        etch.etch(alice, "uri3", 2, true);
        assertEq(etch.ownerOf(0), alice);
        assertEq(etch.ownerOf(1), bob);
        assertEq(etch.ownerOf(2), alice);
    }

    // -- Minter access control ------------------------------------------------

    function test_unauthorizedMinterReverts() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Etch.UnauthorizedMinter.selector, alice));
        etch.etch(alice, "data:,test", 0, false);
    }

    function test_setMinterAllowsMinting() public {
        etch.setMinter(alice, true);
        assertTrue(etch.isMinter(alice));
        vm.prank(alice);
        uint256 tokenId = etch.etch(bob, "data:,test", 0, false);
        assertEq(etch.ownerOf(tokenId), bob);
    }

    function test_removeMinterBlocksMinting() public {
        etch.setMinter(alice, true);
        etch.setMinter(alice, false);
        assertFalse(etch.isMinter(alice));
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Etch.UnauthorizedMinter.selector, alice));
        etch.etch(alice, "data:,test", 0, false);
    }

    function test_onlyOwnerCanSetMinter() public {
        vm.prank(alice);
        vm.expectRevert();
        etch.setMinter(bob, true);
    }

    // -- Contract URI ---------------------------------------------------------

    function test_setContractURI() public {
        etch.setContractURI("https://etch.ack-onchain.dev/metadata.json");
        assertEq(etch.contractURI(), "https://etch.ack-onchain.dev/metadata.json");
    }

    function test_onlyOwnerCanSetContractURI() public {
        vm.prank(alice);
        vm.expectRevert();
        etch.setContractURI("https://evil.com");
    }

    // -- ERC721Enumerable -----------------------------------------------------

    function test_totalSupply() public {
        assertEq(etch.totalSupply(), 0);
        etch.etch(alice, "data:,a", 0, false);
        assertEq(etch.totalSupply(), 1);
        etch.etch(bob, "data:,b", 1, true);
        assertEq(etch.totalSupply(), 2);
    }

    function test_tokenByIndex() public {
        etch.etch(alice, "data:,a", 0, false);
        etch.etch(bob, "data:,b", 1, true);
        assertEq(etch.tokenByIndex(0), 0);
        assertEq(etch.tokenByIndex(1), 1);
    }

    function test_tokenOfOwnerByIndex() public {
        etch.etch(alice, "data:,a", 0, false);
        etch.etch(alice, "data:,b", 1, true);
        assertEq(etch.tokenOfOwnerByIndex(alice, 0), 0);
        assertEq(etch.tokenOfOwnerByIndex(alice, 1), 1);
    }

    // -- isMinter view --------------------------------------------------------

    function test_ownerIsAlwaysMinter() public view {
        assertTrue(etch.isMinter(address(this)));
    }

    function test_randomAddressNotMinter() public view {
        assertFalse(etch.isMinter(alice));
    }
}
