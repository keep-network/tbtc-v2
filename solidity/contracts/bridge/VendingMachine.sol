// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../token/TBTCToken.sol";
import "../GovernanceUtils.sol";

contract VendingMachine is Ownable {
    using SafeERC20 for IERC20;
    using SafeERC20 for TBTCToken;

    uint256 public constant GOVERNANCE_DELAY = 12 hours; // TODO: is it enough? maybe 48h?
    uint256 public constant FLOATING_POINT_DIVISOR = 1e18;

    IERC20 public immutable tbtcV1;
    TBTCToken public immutable tbtcV2;

    // portion of the amount being unminted in 1e18 precision,
    // e.g. 0.001 = 1000000000000000
    uint256 public unmintFee;
    uint256 public newUnmintFee;
    uint256 public unmintFeeChangeInitiated;

    address public newVendingMachine;
    uint256 public vendingMachineUpdateInitiated;

    event UnmintFeeUpdateStarted(uint256 newUnmintFee, uint256 timestamp);
    event UnmintFeeUpdated(uint256 newUnmintFee);

    event VendingMachineUpdateStarted(
        address newVendingMachine,
        uint256 timestamp
    );
    event VendingMachineUpdated(address newVendingMachine);

    event Minted(address recipient, uint256 amount);
    event Unminted(address recipient, uint256 amount, uint256 fee);

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

    function mint(uint256 amount) external {
        _mint(msg.sender, amount);
    }

    function receiveApproval(
        address from,
        uint256 amount,
        address token,
        bytes calldata
    ) external {
        require(token == address(tbtcV1), "Token is not TBTC v1");
        require(msg.sender == address(tbtcV1), "Only TBTC v1 caller allowed");
        _mint(from, amount);
    }

    function unmint(uint256 amount) external {
        uint256 fee = unmintFeeFor(amount);

        require(
            tbtcV2.balanceOf(msg.sender) >= amount + fee,
            "Amount + fee exceeds TBTC v2 balance"
        );

        tbtcV2.safeTransferFrom(msg.sender, address(this), fee);
        tbtcV2.burnFrom(msg.sender, amount);
        tbtcV1.safeTransfer(msg.sender, amount);
        emit Unminted(msg.sender, amount, fee);
    }

    function withdrawFees(address recipient, uint256 amount)
        external
        onlyOwner
    {
        tbtcV2.safeTransfer(recipient, amount);
    }

    function beginUnmintFeeUpdate(uint256 _newUnmintFee) external onlyOwner {
        newUnmintFee = _newUnmintFee;
        /* solhint-disable-next-line not-rely-on-time */
        unmintFeeChangeInitiated = block.timestamp;
        /* solhint-disable-next-line not-rely-on-time */
        emit UnmintFeeUpdateStarted(_newUnmintFee, block.timestamp);
    }

    function finalizeUnmintFeeUpdate()
        external
        onlyOwner
        onlyAfterGovernanceDelay(unmintFeeChangeInitiated)
    {
        emit UnmintFeeUpdated(newUnmintFee);
        unmintFee = newUnmintFee;
        newUnmintFee = 0;
        unmintFeeChangeInitiated = 0;
    }

    function beginVendingMachineUpdate(address _newVendingMachine)
        external
        onlyOwner
    {
        newVendingMachine = _newVendingMachine;
        /* solhint-disable-next-line not-rely-on-time */
        vendingMachineUpdateInitiated = block.timestamp;
        /* solhint-disable-next-line not-rely-on-time */
        emit VendingMachineUpdateStarted(_newVendingMachine, block.timestamp);
    }

    function finalizeVendingMachineUpdate()
        external
        onlyOwner
        onlyAfterGovernanceDelay(vendingMachineUpdateInitiated)
    {
        emit VendingMachineUpdated(newVendingMachine);
        tbtcV2.transferOwnership(newVendingMachine);
        newVendingMachine = address(0);
        vendingMachineUpdateInitiated = 0;
    }

    function getRemainingUnmintFeeUpdateTime() external view returns (uint256) {
        return
            GovernanceUtils.getRemainingChangeTime(
                unmintFeeChangeInitiated,
                GOVERNANCE_DELAY
            );
    }

    function getRemainingVendingMachineUpdateTime()
        external
        view
        returns (uint256)
    {
        return
            GovernanceUtils.getRemainingChangeTime(
                vendingMachineUpdateInitiated,
                GOVERNANCE_DELAY
            );
    }

    function unmintFeeFor(uint256 amount) public view returns (uint256) {
        return (amount * unmintFee) / FLOATING_POINT_DIVISOR;
    }

    function _mint(address tokenOwner, uint256 amount) internal {
        tbtcV1.safeTransferFrom(tokenOwner, address(this), amount);
        tbtcV2.mint(tokenOwner, amount);
        emit Minted(tokenOwner, amount);
    }
}
