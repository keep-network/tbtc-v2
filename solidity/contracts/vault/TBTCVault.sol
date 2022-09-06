// SPDX-License-Identifier: MIT

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

pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";

import "./IVault.sol";
import "../bank/Bank.sol";
import "../token/TBTC.sol";
import "../GovernanceUtils.sol";

/// @title TBTC application vault
/// @notice TBTC is a fully Bitcoin-backed ERC-20 token pegged to the price of
///         Bitcoin. It facilitates Bitcoin holders to act on the Ethereum
///         blockchain and access the decentralized finance (DeFi) ecosystem.
///         TBTC Vault mints and unmints TBTC based on Bitcoin balances in the
///         Bank.
/// @dev TBTC Vault is the owner of TBTC token contract and is the only contract
///      minting the token.
contract TBTCVault is IVault, Ownable {
    using SafeERC20 for IERC20;

    /// @notice The time delay that needs to pass between initializing and
    ///         finalizing upgrade to a new vault. The time delay forces the
    ///         upgrading party to reflect on the vault address it is upgrading
    ///         to and lets all TBTC holders notice the planned
    ///         upgrade.
    uint256 public constant UPGRADE_GOVERNANCE_DELAY = 24 hours;

    Bank public bank;
    TBTC public tbtcToken;

    /// @notice The address of a new TBTC vault. Set only when the upgrade
    ///         process is pending. Once the upgrade gets finalized, the new
    ///         TBTC vault will become an owner of TBTC token.
    address public newVault;
    /// @notice The timestamp at which an upgrade to a new TBTC vault was
    ///         initiated. Set only when the upgrade process is pending.
    uint256 public upgradeInitiatedTimestamp;

    event Minted(address indexed to, uint256 amount);
    event Unminted(address indexed from, uint256 amount);

    event UpgradeInitiated(address newVault, uint256 timestamp);
    event UpgradeFinalized(address newVault);

    modifier onlyBank() {
        require(msg.sender == address(bank), "Caller is not the Bank");
        _;
    }

    modifier onlyAfterUpgradeGovernanceDelay() {
        GovernanceUtils.onlyAfterGovernanceDelay(
            upgradeInitiatedTimestamp,
            UPGRADE_GOVERNANCE_DELAY
        );
        _;
    }

    constructor(Bank _bank, TBTC _tbtcToken) {
        require(
            address(_bank) != address(0),
            "Bank can not be the zero address"
        );

        require(
            address(_tbtcToken) != address(0),
            "TBTC token can not be the zero address"
        );

        bank = _bank;
        tbtcToken = _tbtcToken;
    }

    /// @notice Transfers the given `amount` of the Bank balance from caller
    ///         to TBTC Vault, and mints `amount` of TBTC to the caller.
    /// @dev TBTC Vault must have an allowance for caller's balance in the Bank
    ///      for at least `amount`.
    /// @param amount Amount of TBTC to mint.
    function mint(uint256 amount) external {
        require(
            bank.balanceOf(msg.sender) >= amount,
            "Amount exceeds balance in the bank"
        );
        _mint(msg.sender, amount);
        bank.transferBalanceFrom(msg.sender, address(this), amount);
    }

    /// @notice Transfers the given `amount` of the Bank balance from the caller
    ///         to TBTC Vault and mints `amount` of TBTC to the caller.
    /// @dev Can only be called by the Bank via `approveBalanceAndCall`.
    /// @param owner The owner who approved their Bank balance.
    /// @param amount Amount of TBTC to mint.
    function receiveBalanceApproval(
        address owner,
        uint256 amount,
        bytes calldata
    ) external override onlyBank {
        require(
            bank.balanceOf(owner) >= amount,
            "Amount exceeds balance in the bank"
        );
        _mint(owner, amount);
        bank.transferBalanceFrom(owner, address(this), amount);
    }

    /// @notice Mints the same amount of TBTC as the deposited amount for each
    ///         depositor in the array. Can only be called by the Bank after the
    ///         Bridge swept deposits and Bank increased balance for the
    ///         vault.
    /// @dev Fails if `depositors` array is empty. Expects the length of
    ///      `depositors` and `depositedAmounts` is the same.
    function receiveBalanceIncrease(
        address[] calldata depositors,
        uint256[] calldata depositedAmounts
    ) external override onlyBank {
        require(depositors.length != 0, "No depositors specified");
        for (uint256 i = 0; i < depositors.length; i++) {
            _mint(depositors[i], depositedAmounts[i]);
        }
    }

    /// @notice Burns `amount` of TBTC from the caller's balance and transfers
    ///         `amount` back to the caller's balance in the Bank.
    /// @dev Caller must have at least `amount` of TBTC approved to
    ///       TBTC Vault.
    /// @param amount Amount of TBTC to unmint.
    function unmint(uint256 amount) external {
        _unmint(msg.sender, amount);
    }

    /// @notice Burns `amount` of TBTC from the caller's balance and transfers
    ///         `amount` of Bank balance to the Bridge requesting redemption
    ///         based on the provided `redemptionData`.
    /// @dev Caller must have at least `amount` of TBTC approved to
    ///       TBTC Vault.
    /// @param amount Amount of TBTC to unmint and request to redeem in Bridge.
    /// @param redemptionData Redemption data in a format expected from
    ///        `redemptionData` parameter of Bridge's `receiveBalanceApproval`
    ///        function.
    function unmintAndRedeem(uint256 amount, bytes calldata redemptionData)
        external
    {
        _unmintAndRedeem(msg.sender, amount, redemptionData);
    }

    /// @notice Burns `amount` of TBTC from the caller's balance. If `extraData`
    ///         is empty, transfers `amount` back to the caller's balance in the
    ///         Bank. If `extraData` is not empty, requests redemption in the
    ///         Bridge using the `extraData` as a `redemptionData` parameter to
    ///         Bridge's `receiveBalanceApproval` function.
    /// @dev This function is doing the same as `unmint` or `unmintAndRedeem`
    ///      (depending on `extraData` parameter) but it allows to execute
    ///      unminting without a separate approval transaction. The function can
    ///      be called only via `approveAndCall` of TBTC token.
    /// @param from TBTC token holder executing unminting.
    /// @param amount Amount of TBTC to unmint.
    /// @param token TBTC token address.
    /// @param extraData Redemption data in a format expected from
    ///        `redemptionData` parameter of Bridge's `receiveBalanceApproval`
    ///        function. If empty, `receiveApproval` is not requesting a
    ///        redemption of Bank balance but is instead performing just TBTC
    ///        unminting to a Bank balance.
    function receiveApproval(
        address from,
        uint256 amount,
        address token,
        bytes calldata extraData
    ) external {
        require(token == address(tbtcToken), "Token is not TBTC");
        require(msg.sender == token, "Only TBTC caller allowed");
        if (extraData.length == 0) {
            _unmint(from, amount);
        } else {
            _unmintAndRedeem(from, amount, extraData);
        }
    }

    /// @notice Initiates vault upgrade process. The upgrade process needs to be
    ///         finalized with a call to `finalizeUpgrade` function after the
    ///         `UPGRADE_GOVERNANCE_DELAY` passes. Only the governance can
    ///         initiate the upgrade.
    /// @param _newVault The new vault address.
    function initiateUpgrade(address _newVault) external onlyOwner {
        require(_newVault != address(0), "New vault address cannot be zero");
        /* solhint-disable-next-line not-rely-on-time */
        emit UpgradeInitiated(_newVault, block.timestamp);
        /* solhint-disable-next-line not-rely-on-time */
        upgradeInitiatedTimestamp = block.timestamp;
        newVault = _newVault;
    }

    /// @notice Allows the governance to finalize vault upgrade process. The
    ///         upgrade process needs to be first initiated with a call to
    ///         `initiateUpgrade` and the `UPGRADE_GOVERNANCE_DELAY` needs to
    ///         pass. Once the upgrade is finalized, the new vault becomes the
    ///         owner of the TBTC token and receives the whole Bank balance of
    ///         this vault.
    function finalizeUpgrade()
        external
        onlyOwner
        onlyAfterUpgradeGovernanceDelay
    {
        emit UpgradeFinalized(newVault);
        // slither-disable-next-line reentrancy-no-eth
        tbtcToken.transferOwnership(newVault);
        bank.transferBalance(newVault, bank.balanceOf(address(this)));
        newVault = address(0);
        upgradeInitiatedTimestamp = 0;
    }

    /// @notice Allows the governance of the TBTCVault to recover any ERC20
    ///         token sent mistakenly to the TBTC token contract address.
    /// @param token Address of the recovered ERC20 token contract.
    /// @param recipient Address the recovered token should be sent to.
    /// @param amount Recovered amount.
    function recoverERC20FromToken(
        IERC20 token,
        address recipient,
        uint256 amount
    ) external onlyOwner {
        tbtcToken.recoverERC20(token, recipient, amount);
    }

    /// @notice Allows the governance of the TBTCVault to recover any ERC721
    ///         token sent mistakenly to the TBTC token contract address.
    /// @param token Address of the recovered ERC721 token contract.
    /// @param recipient Address the recovered token should be sent to.
    /// @param tokenId Identifier of the recovered token.
    /// @param data Additional data.
    function recoverERC721FromToken(
        IERC721 token,
        address recipient,
        uint256 tokenId,
        bytes calldata data
    ) external onlyOwner {
        tbtcToken.recoverERC721(token, recipient, tokenId, data);
    }

    /// @notice Allows the governance of the TBTCVault to recover any ERC20
    ///         token sent - mistakenly or not - to the vault address. This
    ///         function should be used to withdraw TBTC v1 tokens transferred
    ///         to TBTCVault as a result of VendingMachine > TBTCVault upgrade.
    /// @param token Address of the recovered ERC20 token contract.
    /// @param recipient Address the recovered token should be sent to.
    /// @param amount Recovered amount.
    function recoverERC20(
        IERC20 token,
        address recipient,
        uint256 amount
    ) external onlyOwner {
        token.safeTransfer(recipient, amount);
    }

    /// @notice Allows the governance of the TBTCVault to recover any ERC721
    ///         token sent mistakenly to the vault address.
    /// @param token Address of the recovered ERC721 token contract.
    /// @param recipient Address the recovered token should be sent to.
    /// @param tokenId Identifier of the recovered token.
    /// @param data Additional data.
    function recoverERC721(
        IERC721 token,
        address recipient,
        uint256 tokenId,
        bytes calldata data
    ) external onlyOwner {
        token.safeTransferFrom(address(this), recipient, tokenId, data);
    }

    // slither-disable-next-line calls-loop
    function _mint(address minter, uint256 amount) internal {
        emit Minted(minter, amount);
        tbtcToken.mint(minter, amount);
    }

    function _unmint(address unminter, uint256 amount) internal {
        emit Unminted(unminter, amount);
        tbtcToken.burnFrom(unminter, amount);
        bank.transferBalance(unminter, amount);
    }

    function _unmintAndRedeem(
        address redeemer,
        uint256 amount,
        bytes calldata redemptionData
    ) internal {
        emit Unminted(redeemer, amount);
        tbtcToken.burnFrom(redeemer, amount);
        bank.approveBalanceAndCall(bank.bridge(), amount, redemptionData);
    }
}
