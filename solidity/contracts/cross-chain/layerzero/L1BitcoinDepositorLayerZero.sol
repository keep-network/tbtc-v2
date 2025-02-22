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

pragma solidity 0.8.17;

import "./LayerZero.sol";
import "../L1BitcoinDepositor.sol";

/// @title L1BitcoinDepositorLayerZero
/// @notice This contract is part of the direct bridging mechanism allowing
///         users to obtain ERC20 TBTC on supported L2 chains, without the need
///         to interact with the L1 tBTC ledger chain where minting occurs.
contract L1BitcoinDepositorLayerZero is L1BitcoinDepositor {
    /**
     * @dev Struct representing token parameters for the OFT send() operation.
     */
    struct SendParam {
        uint32 dstEid; // Destination endpoint ID.
        bytes32 to; // Recipient address.
        uint256 amountLD; // Amount to send in local decimals.
        uint256 minAmountLD; // Minimum amount to send in local decimals.
        bytes extraOptions; // Additional options supplied by the caller to be used in the LayerZero message.
        bytes composeMsg; // The composed message for the send() operation.
        bytes oftCmd; // The OFT command to be executed, unused in default OFT implementations.
    }

    /**
     * @dev Struct representing message fee for the OFT send() operation.
     */
    struct MessagingFee {
    uint nativeFee; // gas amount in native gas token
    uint lzTokenFee; // gas amount in ZRO token
    }

    /// @notice tBTC `l1OFTAdapter` contract.
    IOFT public l1OFTAdapter;
    /// @notice LayerZero Destination Endpoint Id.
    uint32 public destinationEndpointId;

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

        require(_l1OFTAdapter != address(0), "l1OFTAdapter address cannot be zero");
        l1OFTAdapter = IOFT(_l1OFTAdapter);
        destinationEndpointId = _destinationEndpointId;
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
    function _transferTbtc(uint256 amount, bytes32 l2Receiver) internal override {
        // Calculate the minimum amount without dust that the user should receive on L2.
        uint256 minimumAmount = _calculateMinimumAmount(amount, tbtcToken.decimals());

        require(minimumAmount > 0, "minimumAmount too low to bridge");
        require(amount > 0, "Amount too low to bridge");

        MessagingFee msgFee = l1OFTAdapter.quoteSend(
            {
                dstEid: destinationEndpointId,
                to: l2Receiver,
                amountLD: amount,
                minAmountLD: minimumAmount,
                extraOptions: bytes(""),
                composeMsg: bytes(""),
                oftCmd: bytes("")
            },
            false
        );

        require(msg.value == msgFee.nativeFee, "Payment for ZeroLayer is too low");

        // The LayerZero Token Bridge will pull the TBTC amount
        // from this contract. We need to approve the transfer first.
        tbtcToken.safeIncreaseAllowance(address(l1OFTAdapter), amount);

        // Initiate a LayerZero token transfer that will mint L2 TBTC and
        // send it to the user.
        // slither-disable-next-line arbitrary-send-eth
        l1OFTAdapter.send{
            value: msgFee.nativeFee
        }(
            {
                dstEid: destinationEndpointId,
                to: l2Receiver,
                amountLD: amount,
                minAmountLD: minimumAmount,
                extraOptions: bytes(""),
                composeMsg: bytes(""),
                oftCmd: bytes("")
            }
        );
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
        uint256 decimalConversionRate = 10 **
            (_localDecimals - _sharedDecimals());
        return (_amount / decimalConversionRate) * decimalConversionRate;
    }
}
