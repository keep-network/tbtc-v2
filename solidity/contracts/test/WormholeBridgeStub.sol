// SPDX-License-Identifier: GPL-3.0-only

pragma solidity 0.8.17;

import "./TestERC20.sol";
import "../l2/L2WormholeGateway.sol";

/// @dev Stub contract used in L2WormholeGateway unit tests.
///      Stub contract is used instead of a smock because of the token transfer
///      that needs to happen in completeTransferWithPayload function.
contract WormholeBridgeStub is IWormholeTokenBridge {
    TestERC20 public wormholeToken;

    uint256 public transferAmount;
    address public receiverAddress;

    // Two simple events allowing to assert Wormhole bridge functions are
    // called.
    event WormholeBridgeStub_completeTransferWithPayload(bytes encodedVm);
    event WormholeBridgeStub_transferTokens(
        address token,
        uint256 amount,
        uint16 recipientChain,
        bytes32 recipient,
        uint256 arbiterFee,
        uint32 nonce
    );

    constructor(TestERC20 _wormholeToken) {
        wormholeToken = _wormholeToken;
    }

    function completeTransferWithPayload(bytes memory encodedVm)
        external
        returns (bytes memory)
    {
        emit WormholeBridgeStub_completeTransferWithPayload(encodedVm);
        wormholeToken.mint(msg.sender, transferAmount);

        // In a real implementation, encodedVm is parsed. To avoid copy-pasting
        // Wormhole code to this contract and then encoding parmaters in unit
        // tests, we allow to set the address on the stub contract and we return
        // it here.
        return abi.encode(receiverAddress);
    }

    function transferTokens(
        address token,
        uint256 amount,
        uint16 recipientChain,
        bytes32 recipient,
        uint256 arbiterFee,
        uint32 nonce
    ) external payable returns (uint64 sequence) {
        emit WormholeBridgeStub_transferTokens(
            token,
            amount,
            recipientChain,
            recipient,
            arbiterFee,
            nonce
        );
        return 777;
    }

    function setTransferAmount(uint256 _transferAmount) external {
        transferAmount = _transferAmount;
    }

    function setReceiverAddress(address _receiverAddress) external {
        receiverAddress = _receiverAddress;
    }
}
