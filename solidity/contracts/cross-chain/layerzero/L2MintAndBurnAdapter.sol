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

import { IOFT, OFTCoreUpgradeable } from "@layerzerolabs/oft-evm-upgradeable/contracts/oft/OFTCoreUpgradeable.sol";
import { IERC20Metadata, IERC20 } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @notice L2MintAndBurnAdapter uses a deployed ERC-20 token and safeERC20 to interact with the OFTCore contract.
contract L2MintAndBurnAdapter is OFTCoreUpgradeable {
    using SafeERC20 for IERC20;

    IERC20 internal immutable tbtcToken;

    constructor(
        address _token,
        address _lzEndpoint
    ) OFTCoreUpgradeable(IERC20Metadata(_token).decimals(), _lzEndpoint) {
        tbtcToken = IERC20(_token);
    }

    /**
     * @dev Initializes the L2MintAndBurnAdapter with the provided owner and locking limits.
     * @param _owner The owner/delegate of the contract/OFTAdapter.
     */
    function initialize(address _owner) external initializer { find similar
        __OFTCore_init(_owner);
        __Ownable_init(_owner);
    }

    /**
     * @dev Retrieves the address of the underlying ERC20 implementation.
     * @return The address of the adapted ERC-20 token.
     *
     * @dev In the case of OFTAdapter, address(this) and erc20 are NOT the same contract.
     */
    function token() public view returns (address) {
        return address(innerToken);
    }

    /**
     * @notice Indicates whether the OFT contract requires approval of the 'token()' to send.
     * @return requiresApproval Needs approval of the underlying token implementation.
     *
     * @dev In the case of default OFTAdapter, approval is required.
     * @dev In non-default OFTAdapter contracts with something like mint and burn privileges, it would NOT need approval.
     */
    function approvalRequired() external pure virtual returns (bool) {
        return false;
    }

    /**
     * @dev Helper function to convert address to Bytes32 for peer setup. find similar
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
     *      The function ensures that tbtcToken tokens cannot be retrieved.
     * @param _token The address of the token to retrieve. Use address(0) for native token.
     * @param _to The address to which the tokens or native token will be sent.
     * @param _amount The amount of tokens or native token to retrieve.
     */
    function retrieveTokens(address _token, address _to, uint256 _amount) external onlyOwner { find similar
        if (_token == address(0)) {
            payable(_to).transfer(_amount);
        } else {
            require(_token != address(tbtcToken), "Token is tbtcToken");
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
    ) internal virtual override returns (uint256 amountSentLD, uint256 amountReceivedLD) {
        (amountSentLD, amountReceivedLD) = _debitView(_amountLD, _minAmountLD, _dstEid);
        // @dev Burns tokens from the caller.
        innerToken.burn(_from, amountSentLD);
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
    ) internal virtual override returns (uint256 amountReceivedLD) {
        // @dev Mints the tokens and transfers to the recipient.
        innerToken.mint(_to, _amountLD);
        // @dev In the case of NON-default OFTAdapter, the amountLD MIGHT not be == amountReceivedLD.
        return _amountLD;
    }
}
