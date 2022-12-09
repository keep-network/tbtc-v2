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

import "../bridge/Bridge.sol";
import "../bridge/Deposit.sol";

/// @title TBTC Optimistic Minting
/// @notice The Optimistic Minting mechanism allows to mint TBTC before
///         TBTCVault receives the Bank balance. There are two permissioned sets
///         in the system: Minters and Guards, both set up in 1-of-n mode.
///         Minters observe the revealed deposits and request minting TBTC.
///         Any single Minter can perform this action. There is a 3 hours delay
///         between the time of the request from a Minter to the time TBTC is
///         minted. During the time of the delay, any Guard can cancel the
///         minting.
/// @dev This functionality is a part of TBTCVault. It is implemented in
///      a separate abstract contract to achieve better separation of concerns
///      and easier-to-follow code.
abstract contract TBTCOptimisticMinting is Ownable {
    /// @notice The time that needs to pass between the moment the optimistic
    ///         minting is requested and the moment optimistic minting is
    ///         finalized with minting TBTC.
    uint256 public constant OPTIMISTIC_MINTING_DELAY = 3 hours;

    Bridge public bridge;

    /// @notice Indicates if the given address is a minter. Only minters can
    ///         request optimistic minting.
    mapping(address => bool) public isMinter;

    /// @notice Indicates if the given address is a guard. Only guards can
    ///         cancel requested optimistic minting.
    mapping(address => bool) public isGuard;

    /// @notice Collection of all revealed deposits for which the optimistic
    ///         minting was requested. Indexed by a deposit key computed as
    ///         keccak256(fundingTxHash | fundingOutputIndex). The value is
    ///         a UNIX timestamp at which the optimistic minting was requested.
    mapping(uint256 => uint256) public pendingOptimisticMints;

    /// @notice Optimistic minting debt value per depositor's address. The debt
    ///         represents the total value of all depositor's deposits revealed
    ///         to the Bridge that has not been yet swept and led to the
    ///         optimistic minting of TBTC. When TBTCVault sweeps a deposit,
    ///         the debt is fully or partially paid off, no matter if that
    ///         particular swept deposit was used for the optimistic minting or
    ///         not.
    mapping(address => uint256) public optimisticMintingDebt;

    event OptimisticMintingRequested(
        address indexed minter,
        address depositor,
        uint256 amount,
        bytes32 fundingTxHash,
        uint32 fundingOutputIndex,
        uint256 depositKey
    );
    event OptimisticMintingFinalized(
        address indexed minter,
        address depositor,
        uint256 amount,
        bytes32 fundingTxHash,
        uint32 fundingOutputIndex,
        uint256 depositKey
    );
    event OptimisticMintingCancelled(
        address indexed guard,
        bytes32 fundingTxHash,
        uint32 fundingOutputIndex,
        uint256 depositKey
    );
    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);
    event GuardAdded(address indexed guard);
    event GuardRemoved(address indexed guard);

    modifier onlyMinter() {
        require(isMinter[msg.sender], "Caller is not a minter");
        _;
    }

    modifier onlyGuard() {
        require(isGuard[msg.sender], "Caller is not a guard");
        _;
    }

    constructor(Bridge _bridge) {
        require(
            address(_bridge) != address(0),
            "Bridge can not be the zero address"
        );

        bridge = _bridge;
    }

    /// @dev Mints the given amount of TBTC to the given depositor's address.
    ///      Implemented by TBTCVault.
    function _mint(address minter, uint256 amount) internal virtual;

    /// @notice Allows a minter to request for an optimistic minting of TBTC.
    ///         The following conditions must be met:
    ///         - The deposit with the given Bitcoin funding transaction hash
    ///           and output index has been revealed to the Bridge.
    ///         - The deposit has not been swept yet.
    ///         - The deposit is targeted into the TBTCVault.
    ///         After calling this function, the minter has to wait for
    ///         OPTIMISTIC_MINTING_DELAY before finalizing the mint with a call
    ///         to finalizeOptimisticMint.
    function optimisticMint(bytes32 fundingTxHash, uint32 fundingOutputIndex)
        external
        onlyMinter
    {
        uint256 depositKey = calculateDepositKey(
            fundingTxHash,
            fundingOutputIndex
        );
        Deposit.DepositRequest memory deposit = bridge.deposits(depositKey);

        // TODO: Validate when it was revealed. The deposit must be revealed
        //       early enough to the Bridge to pass the Bridge's validation.
        //       It may happen that none of the Minters request for an
        //       optimistic mint of a deposit early and one of them do it just
        //       before the Bitcoin refund unlocks. It should not be possible
        //       to request an optimistic mint for such a deposit because
        //       there is no guarantee the wallet will be able to sweep it.

        require(deposit.revealedAt != 0, "The deposit has not been revealed");
        require(deposit.sweptAt == 0, "The deposit is already swept");
        require(deposit.vault == address(this), "Unexpected vault address");

        /* solhint-disable-next-line not-rely-on-time */
        pendingOptimisticMints[depositKey] = block.timestamp;

        emit OptimisticMintingRequested(
            msg.sender,
            deposit.depositor,
            deposit.amount,
            fundingTxHash,
            fundingOutputIndex,
            depositKey
        );
    }

    /// @notice Allows a minter to finalize previously requested optimistic
    ///         minting. The following conditions must be met:
    ///         - The optimistic minting has been requested for the given
    ///           deposit.
    ///         - The deposit has not been swept yet.
    ///         - At least OPTIMISTIC_MINTING_DELAY passed since the optimistic
    ///           minting was requested for the given deposit.
    ///         - The optimistic minting has not been finalized earlier for the
    ///           given deposit.
    ///         - The optimistic minting request for the given deposit has not
    ///           been canceled by a guard.
    ///         This function mints TBTC and increases pendingOptimisticMints
    ///         for the given depositor. The finalized optimistic minting
    ///         request is removed from the contract.
    function finalizeOptimisticMint(
        bytes32 fundingTxHash,
        uint32 fundingOutputIndex
    ) external onlyMinter {
        uint256 depositKey = calculateDepositKey(
            fundingTxHash,
            fundingOutputIndex
        );

        uint256 requestedAt = pendingOptimisticMints[depositKey];
        require(
            requestedAt != 0,
            "Optimistic minting not requested or already finalized"
        );
        require(
            /* solhint-disable-next-line not-rely-on-time */
            block.timestamp - requestedAt > OPTIMISTIC_MINTING_DELAY,
            "Optimistic minting delay has not passed yet"
        );

        Deposit.DepositRequest memory deposit = bridge.deposits(depositKey);
        require(deposit.sweptAt == 0, "The deposit is already swept");

        // TODO: Deal with the minting fee. Right now we mint amount of TBTC
        //       equal to the output value of the Bitcoin deposit transaction.
        //       Bridge, when sweeping, will cut a sweeping fee and Bitcoin TX
        //       fee. If we do not take it into account here, we will create
        //       an imbalance in the system. Worth noting that even if we do not
        //       decide to cut fees here, it is possible to fix this imbalance
        //       later by a donation to the Bridge (see DonationVault).

        _mint(deposit.depositor, deposit.amount);
        optimisticMintingDebt[deposit.depositor] += deposit.amount;

        delete pendingOptimisticMints[depositKey];

        emit OptimisticMintingFinalized(
            msg.sender,
            deposit.depositor,
            deposit.amount,
            fundingTxHash,
            fundingOutputIndex,
            depositKey
        );
    }

    /// @notice Allows a guard to cancel optimistic minting request. The
    ///         following conditions must be met:
    ///         - The optimistic minting request for the given deposit exists.
    ///         - The optimistic minting request for the given deposit has not
    ///           been finalized yet.
    function cancelOptimisticMint(
        bytes32 fundingTxHash,
        uint32 fundingOutputIndex
    ) external onlyGuard {
        uint256 depositKey = calculateDepositKey(
            fundingTxHash,
            fundingOutputIndex
        );

        require(
            pendingOptimisticMints[depositKey] > 0,
            "Optimistic minting not requested of already finalized"
        );

        delete pendingOptimisticMints[depositKey];

        emit OptimisticMintingCancelled(
            msg.sender,
            fundingTxHash,
            fundingOutputIndex,
            depositKey
        );
    }

    // TODO: Find a convenient way for a guard to block minting at 3AM and deal
    //       with an errant minter.

    /// @notice Adds the address to the minter set.
    function addMinter(address minter) external onlyOwner {
        require(!isMinter[minter], "This address is already a minter");
        isMinter[minter] = true;
        emit MinterAdded(minter);
    }

    /// @notice Removes the address from the minter set.
    function removeMinter(address minter) external onlyOwner {
        require(isMinter[minter], "This address is not a minter");
        delete isMinter[minter];
        emit MinterRemoved(minter);
    }

    /// @notice Adds the address to the guard set.
    function addGuard(address guard) external onlyOwner {
        require(!isGuard[guard], "This address is already a guard");
        isGuard[guard] = true;
        emit GuardAdded(guard);
    }

    /// @notice Removes the address from the guard set.
    function removeGuard(address guard) external onlyOwner {
        require(isGuard[guard], "This address is not a guard");
        delete isGuard[guard];
        emit GuardRemoved(guard);
    }

    /// @notice Calculates deposit key the same way as the Bridge contract.
    ///         The deposit key is computed as
    ///         keccak256(fundingTxHash | fundingOutputIndex).
    function calculateDepositKey(
        bytes32 fundingTxHash,
        uint32 fundingOutputIndex
    ) public view returns (uint256) {
        return
            uint256(
                keccak256(abi.encodePacked(fundingTxHash, fundingOutputIndex))
            );
    }

    /// @notice Used by TBTCVault.receiveBalanceIncrease to repay the optimistic
    ///         minting debt before TBTC is minted. When optimistic minting is
    ///         finalized, debt equal to the value of the deposit being
    ///         a subject of the optimistic minting is incurred. When TBTCVault
    ///         sweeps a deposit, the debt is fully or partially paid off, no
    ///         matter if that particular deposit was used for the optimistic
    ///         minting or not.
    function repayOptimisticMintDebt(address depositor, uint256 amount)
        internal
        returns (uint256)
    {
        uint256 debt = optimisticMintingDebt[depositor];

        if (amount > debt) {
            optimisticMintingDebt[depositor] = 0;
            return amount - debt;
        } else {
            optimisticMintingDebt[depositor] -= amount;
            return 0;
        }

        // TODO: emit an event

        // TODO: cover with unit tests
    }
}
