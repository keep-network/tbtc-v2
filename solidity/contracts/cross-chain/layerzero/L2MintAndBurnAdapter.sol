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
import {IERC20Metadata, IERC20} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IL2TBTC} from "../utils/IL2TBTC.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @notice L2MintAndBurnAdapter uses a deployed ERC-20 token and safeERC20 to interact with the OFTCore contract.
contract L2MintAndBurnAdapter is OFTAdapterUpgradeable {
    using SafeERC20 for IERC20;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address _token, address _lzEndpoint)
        OFTAdapterUpgradeable(_token, _lzEndpoint)
    {
        _disableInitializers();
    }

    /**
     * @dev Initializes the L2MintAndBurnAdapter with the provided owner and locking limits.
     * @param _delegate The delegate of the contract/OFTAdapter.
     */
    function initialize(address _delegate) external initializer {
        __OFTAdapter_init(_delegate);
        __Ownable_init();
    }

    /**
     * @notice Indicates whether the OFT contract requires approval of the 'token()' to send.
     * @return requiresApproval Needs approval of the underlying token implementation.
     *
     * @dev In the case of default OFTAdapter, approval is required.
     * @dev In non-default OFTAdapter contracts with something like mint and burn privileges, it would NOT need approval.
     */
    function approvalRequired() external pure override returns (bool) {
        return false;
    }

    /**
     * @dev Helper function to convert address to Bytes32 for peer setup.
     * @param _address The address needed to be converted.
     * @return The converted address.
     */
    function addressToBytes32(address _address) public pure returns (bytes32) {
        return bytes32(uint256(uint160(_address)));
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
     * @dev Burns tokens from the sender's specified balance.
     * @param _from The address to debit the tokens from.
     * @param _amountLD The amount of tokens to send in local decimals.
     * @param _minAmountLD The minimum amount to send in local decimals.
     * @param _dstEid The destination chain ID.
     * @return amountSentLD The amount sent in local decimals.
     * @return amountReceivedLD The amount received in local decimals on the remote.
     * @dev WARNING: The default OFTAdapter implementation assumes LOSSLESS transfers, ie. 1 token in, 1 token out.
     * IF the 'innerToken' applies something like a transfer fee, the default will NOT work...
     * a pre/post balance check will need to be done to calculate the amountReceivedLD.
     */
    function _debit(
        address _from,
        uint256 _amountLD,
        uint256 _minAmountLD,
        uint32 _dstEid
    )
        internal
        override
        returns (uint256 amountSentLD, uint256 amountReceivedLD)
    {
        (amountSentLD, amountReceivedLD) = _debitView(
            _amountLD,
            _minAmountLD,
            _dstEid
        );
        /// The caller must have allowance for `accounts`'s tokens of at
        /// least `amount`.
        IL2TBTC(address(innerToken)).burnFrom(_from, amountSentLD);
    }

    /**
     * @dev Credits tokens to the specified address.
     * @param _to The address to credit the tokens to.
     * @param _amountLD The amount of tokens to credit in local decimals.
     * @dev _srcEid The source chain ID.
     * @return amountReceivedLD The amount of tokens ACTUALLY received in local decimals.
     *
     * @dev WARNING: The default OFTAdapter implementation assumes LOSSLESS transfers, ie. 1 token in, 1 token out.
     * IF the 'innerToken' applies something like a transfer fee, the default will NOT work...
     * a pre/post balance check will need to be done to calculate the amountReceivedLD.
     */
    function _credit(
        address _to,
        uint256 _amountLD,
        uint32 /*_srcEid*/
    ) internal override returns (uint256 amountReceivedLD) {
        // @dev Mints the tokens and transfers to the recipient.
        IL2TBTC(address(innerToken)).mint(_to, _amountLD);
        // @dev In the case of NON-default OFTAdapter, the amountLD MIGHT not be == amountReceivedLD.
        return _amountLD;
    }
}
