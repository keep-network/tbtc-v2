// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../token/TBTCToken.sol";
import "../token/IReceiveApproval.sol";
import "../GovernanceUtils.sol";

/// @title TBTC v2 Vending Machine
/// @notice The Vending Machine is the owner of TBTC v2 token and can mint
///         TBTC v2 tokens in 1:1 ratio from TBTC v1 tokens. TBTC v2 can be
///         unminted back to TBTC v1 with or without a fee - fee parameter is
///         controlled by the Governance. This implementation acts as a bridge
///         between TBTC v1 and TBTC v2 token, allowing to mint TBTC v2 before
///         the system is ready and fully operational without sacrificing any
///         security guarantees and decentralization of the project.
///         Vending Machine as a contract itself is not upgradeable, though
///         TBTC v2 token ownership can be updated in a two-step,
///         governance-controlled process. It is expected that this process
///         will be executed before the v2 system launch.
contract VendingMachine is Ownable, IReceiveApproval {
    using SafeERC20 for IERC20;
    using SafeERC20 for TBTCToken;

    /// @notice The time delay that needs to pass between initializing and
    ///         finalizing update of any governable parameter in this contract.
    uint256 public constant GOVERNANCE_DELAY = 7 days;

    /// @notice Divisor for precision purposes. Used to represent fractions
    ///         in parameter values.
    uint256 public constant FLOATING_POINT_DIVISOR = 1e18;

    IERC20 public immutable tbtcV1;
    TBTCToken public immutable tbtcV2;

    /// @notice The fee for unminting TBTC v2 back into TBTC v1 represented as
    ///         1e18 precision fraction. The fee is proportional to the amount
    ///         being unminted and added on the top of the amount being unminted.
    ///         To calculate the fee value, the amount being unminted needs
    ///         to be multiplied by `unmintFee` and divided by 1e18.
    ///         For example, `unmintFee` set to 1000000000000000
    ///         means that 0.001 of the amount being unminted needs to be paid
    ///         to the `VendingMachine` as an unminting fee on the top of the
    ///         amount being unminted.
    uint256 public unmintFee;
    uint256 public newUnmintFee;
    uint256 public unmintFeeChangeInitiatedTimestamp;

    /// @notice The address of a new vending machine. Set only when the update
    ///         process is pending. Once the update gets finalized, the new
    ///         vending machine will become an owner of TBTC v2 token.
    address public newVendingMachine;
    uint256 public vendingMachineUpdateInitiatedTimestamp;

    event UnmintFeeUpdateInitiated(uint256 newUnmintFee, uint256 timestamp);
    event UnmintFeeUpdated(uint256 newUnmintFee);

    event VendingMachineUpdateInitiated(
        address newVendingMachine,
        uint256 timestamp
    );
    event VendingMachineUpdated(address newVendingMachine);

    event Minted(address indexed recipient, uint256 amount);
    event Unminted(address indexed recipient, uint256 amount, uint256 fee);

    modifier onlyAfterGovernanceDelay(uint256 changeInitiatedTimestamp) {
        GovernanceUtils.onlyAfterGovernanceDelay(
            changeInitiatedTimestamp,
            GOVERNANCE_DELAY
        );
        _;
    }

    constructor(
        IERC20 _tbtcV1,
        TBTCToken _tbtcV2,
        uint256 _unmintFee
    ) {
        tbtcV1 = _tbtcV1;
        tbtcV2 = _tbtcV2;
        unmintFee = _unmintFee;
    }

    /// @notice Mints TBTC v2 to the caller from TBTC v1 with 1:1 ratio.
    ///         The caller needs to have at least `amount` of TBTC v1 balance
    ///         approved for transfer to the `VendingMachine` before calling
    ///         this function.
    /// @param amount The amount of TBTC v2 to mint from TBTC v1
    function mint(uint256 amount) external {
        _mint(msg.sender, amount);
    }

    /// @notice Mints TBTC v2 to `from` address from TBTC v1 with 1:1 ratio.
    ///         `from` address needs to have at least `amount` of TBTC v1
    ///         balance approved for transfer to the `VendingMachine` before
    ///         calling this function.
    /// @dev This function is a shortcut for approve + mint. Only TBTC v1
    ///      caller is allowed and only TBTC v1 is allowed as a token to
    ///      transfer.
    /// @param from TBTC v1 token holder minting TBTC v2 tokens
    /// @param amount The amount of TBTC v2 to mint from TBTC v1
    /// @param token TBTC v1 token address
    function receiveApproval(
        address from,
        uint256 amount,
        address token,
        bytes calldata
    ) external override {
        require(token == address(tbtcV1), "Token is not TBTC v1");
        require(msg.sender == address(tbtcV1), "Only TBTC v1 caller allowed");
        _mint(from, amount);
    }

    /// @notice Unmints TBTC v2 from the caller into TBTC v1. Depending on
    ///         `unmintFee` value, may require paying an additional unmint fee
    ///         in TBTC v2 in addition to the amount being unminted. To see
    ///         what is the value of the fee, please call `unmintFeeFor(amount)`
    ///         function. The caller needs to have at least
    ///         `amount + unmintFeeFor(amount)` of TBTC v2 balance approved for
    ///         transfer to the `VendingMachine` before calling this function.
    /// @param amount The amount of TBTC v2 to unmint to TBTC v1
    function unmint(uint256 amount) external {
        uint256 fee = unmintFeeFor(amount);
        emit Unminted(msg.sender, amount, fee);

        require(
            tbtcV2.balanceOf(msg.sender) >= amount + fee,
            "Amount + fee exceeds TBTC v2 balance"
        );

        tbtcV2.safeTransferFrom(msg.sender, address(this), fee);
        tbtcV2.burnFrom(msg.sender, amount);
        tbtcV1.safeTransfer(msg.sender, amount);
    }

    /// @notice Allows the Governance to withdraw unmint fees accumulated by
    ///         `VendingMachine`.
    /// @param recipient The address receiving the fees
    /// @param amount The amount of fees in TBTC v2 to withdraw
    function withdrawFees(address recipient, uint256 amount)
        external
        onlyOwner
    {
        tbtcV2.safeTransfer(recipient, amount);
    }

    /// @notice Allows the Governance to initiate unmint fee update process.
    ///         The update process needs to be finalized with a call to
    ///         `finalizeUnmintFeeUpdate` function after the `GOVERNANCE_DELAY`
    ///         passes.
    /// @param _newUnmintFee The new unmint fee
    function initiateUnmintFeeUpdate(uint256 _newUnmintFee) external onlyOwner {
        /* solhint-disable-next-line not-rely-on-time */
        emit UnmintFeeUpdateInitiated(_newUnmintFee, block.timestamp);
        newUnmintFee = _newUnmintFee;
        /* solhint-disable-next-line not-rely-on-time */
        unmintFeeChangeInitiatedTimestamp = block.timestamp;
    }

    /// @notice Allows the Governance to finalize unmint fee update process.
    ///         The update process needs to be first initiated with a call to
    ///         `initiateUnmintFeeUpdate` and the `GOVERNANCE_DELAY` needs to
    ///         pass.
    function finalizeUnmintFeeUpdate()
        external
        onlyOwner
        onlyAfterGovernanceDelay(unmintFeeChangeInitiatedTimestamp)
    {
        emit UnmintFeeUpdated(newUnmintFee);
        unmintFee = newUnmintFee;
        newUnmintFee = 0;
        unmintFeeChangeInitiatedTimestamp = 0;
    }

    /// @notice Allows the Governance to initiate vending machine update process.
    ///         The update process needs to be finalized with a call to
    ///         `finalizeVendingMachineUpdate` function after the
    ///         `GOVERNANCE_DELAY` passes.
    /// @param _newVendingMachine The new vending machine address
    function initiateVendingMachineUpdate(address _newVendingMachine)
        external
        onlyOwner
    {
        require(
            _newVendingMachine != address(0),
            "New VendingMachine cannot be zero address"
        );

        /* solhint-disable-next-line not-rely-on-time */
        emit VendingMachineUpdateInitiated(_newVendingMachine, block.timestamp);
        newVendingMachine = _newVendingMachine;
        /* solhint-disable-next-line not-rely-on-time */
        vendingMachineUpdateInitiatedTimestamp = block.timestamp;
    }

    /// @notice Allows the Governance to finalize vending machine update process.
    ///         The update process needs to be first initiated with a call to
    ///         `initiateVendingMachineUpdate` and the `GOVERNANCE_DELAY` needs
    ///         to pass. Once the update is finalized, the new vending machine
    ///         will become an owner of TBTC v2 token.
    function finalizeVendingMachineUpdate()
        external
        onlyOwner
        onlyAfterGovernanceDelay(vendingMachineUpdateInitiatedTimestamp)
    {
        emit VendingMachineUpdated(newVendingMachine);
        //slither-disable-next-line reentrancy-no-eth
        tbtcV2.transferOwnership(newVendingMachine);
        newVendingMachine = address(0);
        vendingMachineUpdateInitiatedTimestamp = 0;
    }

    /// @notice Get the remaining time that needs to pass until unmint fee
    ///         update can be finalized by the Governance. If the update has
    ///         not been initiated, the function reverts.
    function getRemainingUnmintFeeUpdateTime() external view returns (uint256) {
        return
            GovernanceUtils.getRemainingGovernanceDelay(
                unmintFeeChangeInitiatedTimestamp,
                GOVERNANCE_DELAY
            );
    }

    /// @notice Get the remaining time that needs to pass until vending machine
    ///         update can be finalized by the Governance. If the update has not
    ///         been initiated, the function reverts.
    function getRemainingVendingMachineUpdateTime()
        external
        view
        returns (uint256)
    {
        return
            GovernanceUtils.getRemainingGovernanceDelay(
                vendingMachineUpdateInitiatedTimestamp,
                GOVERNANCE_DELAY
            );
    }

    /// @notice Returns the fee that needs to be paid to the `VendingMachine` to
    ///         unmint the given amount of TBTC v2 back into TBTC v1.
    function unmintFeeFor(uint256 amount) public view returns (uint256) {
        return (amount * unmintFee) / FLOATING_POINT_DIVISOR;
    }

    function _mint(address tokenOwner, uint256 amount) internal {
        emit Minted(tokenOwner, amount);
        tbtcV1.safeTransferFrom(tokenOwner, address(this), amount);
        tbtcV2.mint(tokenOwner, amount);
    }
}
