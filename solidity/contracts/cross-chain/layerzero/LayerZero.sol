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

pragma solidity ^0.8.17;

/// @title LayerZeroUtils
/// @notice Library for LayerZero utilities.
library LayerZeroUtils {
    /**
     * @dev Helper function to convert address to Bytes32 for peer setup. find similar
     * @param _address The address needed to be converted.
     * @return The converted address.
     */
    function addressToBytes32(address _address) internal pure returns (bytes32) {
        return bytes32(uint256(uint160(_address)));
    }

    /**
     * @dev Helper function to convert Bytes32 to address for peer setup. find similar
     * @param _address The address needed to be converted.
     * @return The converted address.
     */
    function bytes32ToAddress(bytes32 _address) internal pure returns (address) {
        return address(uint160(uint256(_address)));
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
    function sharedDecimals() internal pure returns (uint8) {
        return 6;
    }

    /// @dev Eliminates the dust that cannot be bridged with Wormhole
    ///      due to the decimal shift in the Wormhole Bridge contract.
    ///      See https://github.com/wormhole-foundation/wormhole/blob/96682bdbeb7c87bfa110eade0554b3d8cbf788d2/ethereum/contracts/bridge/Bridge.sol#L276-L288
    function calculateMinimumAmount(
        uint256 _amount,
        uint8 _localDecimals
    ) internal pure returns (uint256) {
        uint256 decimalConversionRate = 10 **
            (_localDecimals - sharedDecimals());
        return (_amount / decimalConversionRate) * decimalConversionRate;
    }
}
