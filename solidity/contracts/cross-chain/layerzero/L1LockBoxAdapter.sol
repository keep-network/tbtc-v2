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

import {OFTAdapterUpgradeable} from "@layerzerolabs/oft-evm-upgradeable/contracts/oft/OFTAdapterUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @notice L1LockBoxAdapter uses a deployed ERC-20 token and safeERC20 to interact with the OFTCore contract.
contract L1LockBoxAdapter is OFTAdapterUpgradeable {
    using SafeERC20 for IERC20;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address _token, address _lzEndpoint)
        OFTAdapterUpgradeable(_token, _lzEndpoint)
    {
        _disableInitializers();
    }

    /**
     * @dev Initializes the L1LockBoxAdapter with the provided owner and locking limits.
     * @param _owner The owner/delegate of the contract/OFTAdapter.
     */
    function initialize(address _owner) external initializer {
        __OFTAdapter_init(_owner);
        __Ownable_init();
    }

    /**
     * @dev Allows the owner to retrieve tokens from the contract.
     *      If the token address is zero, it transfers the specified amount of native token to the given address.
     *      Otherwise, it transfers the specified amount of the given ERC20 token to the given address.
     *      The function ensures that innerToken tokens cannot be retrieved.
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
            require(_token != address(innerToken), "Token is innerToken");
            IERC20(_token).safeTransfer(_to, _amount);
        }
    }

    /**
     * @dev Helper function to convert address to Bytes32 for peer setup.
     * @param _address The address needed to be converted.
     * @return The converted address.
     */
    function addressToBytes32(address _address) public pure returns (bytes32) {
        return bytes32(uint256(uint160(_address)));
    }
}
