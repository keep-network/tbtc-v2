// SPDX-License-Identifier: GPL-3.0-only

// ██████████████     ▐████▌     ██████████████
// ██████████████     ▐████▌     ██████████████
//               ▐████▌    ▐████▌
//               ▐████▌    ▐████▌
// ██████████████     ▐████▌     ██████████████
// ██████████████     ▐████▌     ██████████████
//               ▐████▌    ▐████▌
//               ▐████▌    ▐████▌
//               ▐████▌    ▐████▌
//               ▐████▌    ▐████▌
//               ▐████▌    ▐████▌
//               ▐████▌    ▐████▌

pragma solidity ^0.8.20;

import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {SafeERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import {IERC20MetadataUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";

import {IOFT, SendParam, OFTReceipt} from "@layerzerolabs/oft-evm/contracts/interfaces/IOFT.sol";
import {MessagingReceipt, MessagingFee} from "@layerzerolabs/oapp-evm/contracts/oapp/OAppSender.sol";

import "../L1BitcoinDepositor.sol";

/// @title L1BitcoinDepositorLayerZero
/// @notice This contract is part of the direct bridging mechanism allowing
///         users to obtain ERC20 TBTC on supported L2 chains, without the need
///         to interact with the L1 tBTC ledger chain where minting occurs.
contract L1BitcoinDepositorLayerZero is L1BitcoinDepositor {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /// @notice tBTC `l1OFTAdapter` contract.
    IOFT public l1OFTAdapter;
    /// @notice LayerZero Destination Endpoint Id.
    uint32 public destinationEndpointId;

    event TokensSent(MessagingReceipt msgReceipt, OFTReceipt oftReceipt);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initializes this contract. Must be called exactly once.
     * @param _tbtcBridge             Address of the tBTC Bridge on L1
     * @param _tbtcVault              Address of the tBTC Vault on L1
     * @param _destinationEndpointId  The LayerZero endpoint ID for the destination L2
     * @param _l1OFTAdapter           The LayerZero OFT adapter on L1 that locks TBTC
     */
    function initialize(
        address _tbtcBridge,
        address _tbtcVault,
        uint32 _destinationEndpointId,
        address _l1OFTAdapter
    ) external initializer {
        __L1BitcoinDepositor_initialize(_tbtcBridge, _tbtcVault);
        __Ownable_init();

        require(
            _l1OFTAdapter != address(0),
            "l1OFTAdapter address cannot be zero"
        );
        l1OFTAdapter = IOFT(_l1OFTAdapter);
        destinationEndpointId = _destinationEndpointId;
    }

    /**
     * @dev Given that this contract is set to receive any excess funds from LayerZero, this function
     *      Allows the owner to retrieve tokens from the contract and send to another wallet.
     *      If the token address is zero, it transfers the specified amount of native token to the given address.
     *      Otherwise, it transfers the specified amount of the given ERC20 token to the given address.
     * @param _token The address of the token to retrieve. Use address(0) for native token.
     * @param _to The address to which the tokens or native token will be sent.
     * @param _amount The amount of tokens or native token to retrieve.
     */
    function retrieveTokens(
        address _token,
        address _to,
        uint256 _amount
    ) external onlyOwner {
        require(
            _to != address(0),
            "Cannot retrieve tokens to the zero address"
        );

        if (_token == address(0)) {
            payable(_to).transfer(_amount);
        } else {
            IERC20Upgradeable(_token).safeTransfer(_to, _amount);
        }
    }

    /**
     * @dev Transfers TBTC from L1 to L2 via the LayerZero OFTAdapter:
     *
     *  1. L1 TBTC is locked by the OFTAdapter on the L1 side.
     *  2. A LayerZero message is sent across chains.
     *  3. The corresponding L2 OFTAdapter receives the message, mints canonical
     *     TBTC, and delivers it to the final user (the `l2Receiver` address).
     *
     * @param amount      Amount of TBTC in 1e18 precision
     * @param l2Receiver  L2 user’s address (padded to 32 bytes)
     */
    function _transferTbtc(
        uint256 amount,
        bytes32 l2Receiver
    ) internal override {
        // Calculate the minimum amount without dust that the user should receive on L2.
        uint8 tbtcDecimals = IERC20MetadataUpgradeable(address(tbtcToken))
            .decimals();
        uint256 minimumAmount = _calculateMinimumAmount(amount, tbtcDecimals);

        require(minimumAmount > 0, "minimumAmount too low to bridge");
        require(amount > 0, "Amount too low to bridge");

        SendParam memory sendParam = SendParam({
            dstEid: destinationEndpointId,
            to: l2Receiver,
            amountLD: amount,
            minAmountLD: minimumAmount,
            extraOptions: bytes(""),
            composeMsg: bytes(""),
            oftCmd: bytes("")
        });

        // The second parameter is `_payInLzToken` which indicates whether we want to pay
        // the bridging fee using LayerZero's ZRO token. Here it's set to `false`
        // because we're paying the fee in the native chain currency.
        MessagingFee memory msgFee = l1OFTAdapter.quoteSend(sendParam, false);

        require(
            msg.value == msgFee.nativeFee,
            "Payment for ZeroLayer is too low"
        );

        // The LayerZero Token Bridge will pull the TBTC amount
        // from this contract. We need to approve the transfer first.
        tbtcToken.safeIncreaseAllowance(address(l1OFTAdapter), amount);

        // Initiate a LayerZero token transfer that will mint L2 TBTC and
        // send it to the user.
        // slither-disable-next-line arbitrary-send-eth
        // solhint-disable-next-line check-send-result
        (MessagingReceipt memory msgReceipt, OFTReceipt memory oftReceipt) = l1OFTAdapter
            .send{value: msgFee.nativeFee}(
            sendParam,
            msgFee,
            address(this) // refundable address
        );

        // slither-disable-next-line reentrancy-events
        emit TokensSent(msgReceipt, oftReceipt);
    }

    /**
     * @dev Retrieves the shared decimals of the OFT.
     * @return The shared decimals of the OFT.
     *
     * @dev Sets an implicit cap on the amount of tokens, over uint64.max() will need some sort of outbound cap / totalSupply cap
     * Lowest common decimal denominator between chains.
     * Defaults to 6 decimal places to provide up to 18,446,744,073,709.551615 units (max uint64).
     * For tokens exceeding this totalSupply(), they will need to override the sharedDecimals function with something smaller.
     * ie. 4 sharedDecimals would be 1,844,674,407,370,955.1615
     */
    function _sharedDecimals() internal pure returns (uint8) {
        return 6;
    }

    /**
     * @dev Calculates the minimal “no‐dust” bridging amount by removing
     *      any precision beyond the `_sharedDecimals()` from `_amount`.
     * @param _amount        Amount of TBTC in local decimals (e.g. 1e18).
     * @param _localDecimals The local (L1) TBTC decimal precision (e.g. 18).
     * @return The minimal amount eligible for bridging, after removing dust.
     */
    function _calculateMinimumAmount(
        uint256 _amount,
        uint8 _localDecimals
    ) internal pure returns (uint256) {
        uint8 sharedDecimals = _sharedDecimals();

        require(_localDecimals > sharedDecimals, "localDecimals too low");
        uint256 decimalConversionRate = 10 ** (_localDecimals - sharedDecimals);

        return _amount - (_amount % decimalConversionRate);
    }
}
