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

import {BTCUtils} from "@keep-network/bitcoin-spv-sol/contracts/BTCUtils.sol";
import {BytesLib} from "@keep-network/bitcoin-spv-sol/contracts/BytesLib.sol";
import {IWalletRegistry as EcdsaWalletRegistry} from "@keep-network/ecdsa/contracts/api/IWalletRegistry.sol";
import "@keep-network/random-beacon/contracts/Reimbursable.sol";
import "@keep-network/random-beacon/contracts/ReimbursementPool.sol";

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "./BitcoinTx.sol";
import "./Bridge.sol";
import "./Deposit.sol";
import "./Wallets.sol";

/// @title Wallet coordinator.
/// @notice The wallet coordinator contract aims to facilitate the coordination
///         of the off-chain wallet members during complex multi-chain wallet
///         operations like deposit sweeping, redemptions, or moving funds.
///         Such processes involve various moving parts and many steps that each
///         individual wallet member must do. Given the distributed nature of
///         the off-chain wallet software, full off-chain implementation is
///         challenging and prone to errors, especially byzantine faults.
///         This contract provides a single and trusted on-chain coordination
///         point thus taking the riskiest part out of the off-chain software.
///         The off-chain wallet members can focus on the core tasks and do not
///         bother about electing a trusted coordinator or aligning internal
///         states using complex consensus algorithms.
contract WalletCoordinator is OwnableUpgradeable, Reimbursable {
    using BTCUtils for bytes;
    using BytesLib for bytes;

    /// @notice Helper structure carrying data necessary to validate the wallet
    ///         membership of the caller.
    struct WalletMemberContext {
        uint32[] walletMembersIDs;
        uint256 walletMemberIndex;
    }

    /// @notice Helper structure representing a deposit sweep proposal.
    ///         Holds the target wallet 20-byte public key hash and
    ///         deposits that should be part of the sweep.
    struct DepositSweepProposal {
        bytes20 walletPubKeyHash;
        DepositKey[] depositsKeys;
    }

    /// @notice Helper structure representing a plain-text deposit key.
    ///         Each deposit can be identified by their 32-byte funding
    ///         transaction hash (Bitcoin internal byte order) an the funding
    ///         output index (0-based).
    /// @dev Do not confuse this structure with the deposit key used within the
    ///      Bridge contract to store deposits. Here we have the plain-text
    ///      components of the key while the Bridge uses a uint representation of
    ///      keccak256(fundingTxHash | fundingOutputIndex) for gas efficiency.
    struct DepositKey {
        bytes32 fundingTxHash;
        uint32 fundingOutputIndex;
    }

    /// @notice Helper structure holding deposit extra data required during
    ///         deposit sweep proposal validation. Basically, this structure
    ///         is a combination of BitcoinTx.Info and relevant parts of
    ///         Deposit.DepositRevealInfo.
    /// @dev These data can be pulled from respective `DepositRevealed` events
    ///      emitted by the `Bridge.revealDeposit` function. The `fundingTx`
    ///      field must be taken directly from the Bitcoin chain, using the
    ///      `DepositRevealed.fundingTxHash` as transaction identifier.
    struct DepositExtraInfo {
        BitcoinTx.Info fundingTx;
        bytes8 blindingFactor;
        bytes20 walletPubKeyHash;
        bytes20 refundPubKeyHash;
        bytes4 refundLocktime;
    }

    /// @notice Mapping that holds addresses allowed to submit proposals.
    mapping(address => bool) public isProposalSubmitter;

    /// @notice Mapping that holds wallet time locks. The key is a 20-byte
    ///         wallet public key hash. The value is a UNIX timestamp defining
    ///         the moment until which the wallet is locked and cannot receive
    ///         new proposals. The value of 0 means the wallet is not locked
    ///         and can receive a proposal at any time.
    mapping(bytes20 => uint32) public walletLock;

    /// @notice Handle to the Bridge contract.
    Bridge public bridge;

    /// @notice Handle to the WalletRegistry contract.
    EcdsaWalletRegistry public walletRegistry;

    /// @notice Determines the deposit sweep proposal validity time. In other
    ///         words, this is the worst-case time for a deposit sweep during
    ///         which the wallet is busy and cannot take another actions. This
    ///         is also the duration of the time lock applied to the wallet
    ///         once a new deposit sweep proposal is submitted.
    ///
    ///         For example, if a deposit sweep proposal was submitted at
    ///         2 pm and depositSweepProposalValidity is 4 hours, the next
    ///         proposal (of any type) can be submitted after 6 pm.
    uint32 public depositSweepProposalValidity;

    /// @notice The minimum time that must elapse since the deposit reveal
    ///         before a deposit becomes eligible for a deposit sweep.
    ///
    ///         For example, if a deposit was revealed at 9 am and depositMinAge
    ///         is 2 hours, the deposit is eligible for sweep after 11 am.
    uint32 public depositMinAge;

    /// @notice Each deposit can be technically swept until it reaches its
    ///         refund timestamp after which it can be taken back by the depositor.
    ///         However, allowing the wallet to sweep deposits that are close
    ///         to their refund timestamp may cause a race between the wallet
    ///         and the depositor. In result, the wallet may sign an invalid
    ///         sweep transaction that aims to sweep an already refunded deposit.
    ///         Such tx signature may be used to create an undefeatable fraud
    ///         challenge against the wallet. In order to mitigate that problem,
    ///         this parameter determines a safety margin that puts the latest
    ///         moment a deposit can be swept far before the point after which
    ///         the deposit becomes refundable.
    ///
    ///         For example, if a deposit becomes refundable after 8 pm and
    ///         depositRefundSafetyMargin is 6 hours, the deposit is valid for
    ///         for a sweep only before 2 pm.
    uint32 public depositRefundSafetyMargin;

    /// @notice The maximum count of deposits that can be swept within a
    ///         single sweep.
    uint16 public depositSweepMaxSize;

    event ProposalSubmitterAdded(address indexed proposalSubmitter);

    event ProposalSubmitterRemoved(address indexed proposalSubmitter);

    event WalletManuallyUnlocked(bytes20 indexed walletPubKeyHash);

    event DepositSweepProposalValidityUpdated(
        uint32 depositSweepProposalValidity
    );

    event DepositMinAgeUpdated(uint32 depositMinAge);

    event DepositRefundSafetyMarginUpdated(uint32 depositRefundSafetyMargin);

    event DepositSweepMaxSizeUpdated(uint16 depositSweepMaxSize);

    event DepositSweepProposalSubmitted(
        DepositSweepProposal proposal,
        address indexed proposalSubmitter
    );

    modifier onlyProposalSubmitterOrWalletMember(
        bytes20 walletPubKeyHash,
        WalletMemberContext calldata walletMemberContext
    ) {
        bool proposalSubmitter = isProposalSubmitter[msg.sender];
        bool walletMember = false;

        if (!proposalSubmitter) {
            bytes32 ecdsaWalletID = bridge
                .wallets(walletPubKeyHash)
                .ecdsaWalletID;

            walletMember = walletRegistry.isWalletMember(
                ecdsaWalletID,
                walletMemberContext.walletMembersIDs,
                msg.sender,
                walletMemberContext.walletMemberIndex
            );
        }

        require(
            proposalSubmitter || walletMember,
            "Caller is neither a proposal submitter nor a wallet member"
        );

        _;
    }

    modifier onlyAfterWalletLock(bytes20 walletPubKeyHash) {
        require(
            /* solhint-disable-next-line not-rely-on-time */
            block.timestamp > walletLock[walletPubKeyHash],
            "Wallet locked"
        );
        _;
    }

    modifier onlyReimbursableAdmin() override {
        require(owner() == msg.sender, "Caller is not the owner");
        _;
    }

    function initialize(Bridge _bridge, ReimbursementPool _reimbursementPool)
        external
        initializer
    {
        __Ownable_init();

        bridge = _bridge;
        // Pre-fetch wallet registry address to save gas on calls protected
        // by the onlyProposalSubmitterOrWalletMember modifier.
        (, , walletRegistry, ) = _bridge.contractReferences();

        reimbursementPool = _reimbursementPool;

        depositSweepProposalValidity = 4 hours;
        depositMinAge = 2 hours;
        depositRefundSafetyMargin = 24 hours;
        depositSweepMaxSize = 5;
    }

    /// @notice Adds the given address to the proposal submitters set.
    /// @param proposalSubmitter Address of the new proposal submitter.
    /// @dev Requirements:
    ///      - The caller must be the owner,
    ///      - The `proposalSubmitter` must not be an existing proposal submitter.
    function addProposalSubmitter(address proposalSubmitter)
        external
        onlyOwner
    {
        require(
            !isProposalSubmitter[proposalSubmitter],
            "This address is already a proposal submitter"
        );
        isProposalSubmitter[proposalSubmitter] = true;
        emit ProposalSubmitterAdded(proposalSubmitter);
    }

    /// @notice Removes the given address from the proposal submitters set.
    /// @param proposalSubmitter Address of the existing proposal submitter.
    /// @dev Requirements:
    ///      - The caller must be the owner,
    ///      - The `proposalSubmitter` must be an existing proposal submitter.
    function removeProposalSubmitter(address proposalSubmitter)
        external
        onlyOwner
    {
        require(
            isProposalSubmitter[proposalSubmitter],
            "This address is not a proposal submitter"
        );
        delete isProposalSubmitter[proposalSubmitter];
        emit ProposalSubmitterRemoved(proposalSubmitter);
    }

    /// @notice Allows to unlock the given wallet before their time lock expires.
    ///         This function should be used in exceptional cases where
    ///         something went wrong and there is a need to unlock the wallet
    ///         without waiting.
    /// @param walletPubKeyHash 20-byte public key hash of the wallet
    /// @dev Requirements:
    ///      - The caller must be the owner.
    function unlockWallet(bytes20 walletPubKeyHash) external onlyOwner {
        // Just in case, allow the owner to unlock the wallet earlier.
        walletLock[walletPubKeyHash] = 0;
        emit WalletManuallyUnlocked(walletPubKeyHash);
    }

    /// @notice Updates the value of the depositSweepProposalValidity parameter.
    /// @param _depositSweepProposalValidity New value.
    /// @dev Requirements:
    ///      - The caller must be the owner.
    function updateDepositSweepProposalValidity(
        uint32 _depositSweepProposalValidity
    ) external onlyOwner {
        depositSweepProposalValidity = _depositSweepProposalValidity;
        emit DepositSweepProposalValidityUpdated(_depositSweepProposalValidity);
    }

    /// @notice Updates the value of the depositMinAge parameter.
    /// @param _depositMinAge New value.
    /// @dev Requirements:
    ///      - The caller must be the owner.
    function updateDepositMinAge(uint32 _depositMinAge) external onlyOwner {
        depositMinAge = _depositMinAge;
        emit DepositMinAgeUpdated(_depositMinAge);
    }

    /// @notice Updates the value of the depositRefundSafetyMargin parameter.
    /// @param _depositRefundSafetyMargin New value.
    /// @dev Requirements:
    ///      - The caller must be the owner.
    function updateDepositRefundSafetyMargin(uint32 _depositRefundSafetyMargin)
        external
        onlyOwner
    {
        depositRefundSafetyMargin = _depositRefundSafetyMargin;
        emit DepositRefundSafetyMarginUpdated(_depositRefundSafetyMargin);
    }

    /// @notice Updates the value of the depositSweepMaxSize parameter.
    /// @param _depositSweepMaxSize New value.
    /// @dev Requirements:
    ///      - The caller must be the owner.
    function updateDepositSweepMaxSize(uint16 _depositSweepMaxSize)
        external
        onlyOwner
    {
        depositSweepMaxSize = _depositSweepMaxSize;
        emit DepositSweepMaxSizeUpdated(_depositSweepMaxSize);
    }

    /// @notice Submits a deposit sweep proposal. Locks the target wallet
    ///         for a specific time, equal to the proposal validity period.
    ///         This function does not store the proposal in the state but
    ///         just emits an event that serves as a guiding light for wallet
    ///         off-chain members. Wallet members are supposed to validate
    ///         the proposal on their own, before taking any action.
    /// @param proposal The deposit sweep proposal
    /// @param walletMemberContext Optional parameter holding some data allowing
    ///        to confirm the wallet membership of the caller. This parameter is
    ///        relevant only when the caller is not a registered proposal
    ///        submitter but claims to be a member of the target wallet.
    /// @dev Requirements:
    ///      - The caller is either a proposal submitter or a member of the
    ///        target wallet,
    ///      - The wallet is not time-locked.
    function submitDepositSweepProposal(
        DepositSweepProposal calldata proposal,
        WalletMemberContext calldata walletMemberContext
    )
        public
        onlyProposalSubmitterOrWalletMember(
            proposal.walletPubKeyHash,
            walletMemberContext
        )
        onlyAfterWalletLock(proposal.walletPubKeyHash)
    {
        walletLock[proposal.walletPubKeyHash] =
            /* solhint-disable-next-line not-rely-on-time */
            uint32(block.timestamp) +
            depositSweepProposalValidity;

        emit DepositSweepProposalSubmitted(proposal, msg.sender);
    }

    /// @notice Wraps `submitDepositSweepProposal` call and reimburses the
    ///         caller's transaction cost.
    /// @dev See `submitDepositSweepProposal` function documentation.
    function submitDepositSweepProposalWithReimbursement(
        DepositSweepProposal calldata proposal,
        WalletMemberContext calldata walletMemberContext
    ) external refundable(msg.sender) {
        submitDepositSweepProposal(proposal, walletMemberContext);
    }

    /// @notice View function encapsulating the main rules of a valid deposit
    ///         sweep proposal. This function is meant to facilitate the off-chain
    ///         validation of the incoming proposals. Thanks to it, most
    ///         of the work can be done using a single readonly contract call.
    ///         Worth noting, the validation done here is not exhaustive as some
    ///         conditions may not be verifiable within the on-chain function or
    ///         checking them may be easier on the off-chain side. For example,
    ///         this function does not check the SPV proofs and confirmations of
    ///         the deposit funding transactions as this would require an
    ///         integration with the difficulty relay that greatly increases
    ///         complexity. Instead of that, each off-chain wallet member is
    ///         supposed to do that check on their own.
    /// @param proposal The sweeping proposal to validate.
    /// @param depositsExtraInfo Deposits extra data required to perform the validation.
    /// @dev Requirements:
    ///      - The target wallet must be in the Live state,
    ///      - The number of deposits included in the sweep must be in
    ///        the range [1, `depositSweepMaxSize`],
    ///      - The length of `depositsExtraInfo` array must be equal to the
    ///        length of `proposal.depositsKeys`, i.e. each deposit must
    ///        have exactly one set of corresponding extra data,
    ///      - Each deposit must be revealed to the Bridge,
    ///      - Each deposit must be old enough, i.e. at least `depositMinAge`
    ///        elapsed since their reveal time,
    ///      - Each deposit must not be swept yet,
    ///      - Each deposit must have valid extra data (see `isDepositExtraInfoValid`),
    ///      - Each deposit must have the refund safety margin preserved,
    ///      - Each deposit must be controlled by the same wallet,
    ///      - Each deposit must target the same vault.
    function validateDepositSweepProposal(
        DepositSweepProposal calldata proposal,
        DepositExtraInfo[] calldata depositsExtraInfo
    ) external view {
        require(
            bridge.wallets(proposal.walletPubKeyHash).state ==
                Wallets.WalletState.Live,
            "Wallet is not in Live state"
        );

        require(proposal.depositsKeys.length > 0, "Sweep below the min size");

        require(
            proposal.depositsKeys.length <= depositSweepMaxSize,
            "Sweep exceeds the max size"
        );

        require(
            proposal.depositsKeys.length == depositsExtraInfo.length,
            "Each deposit key must have matching extra data"
        );

        address proposalVault = address(0);

        for (uint256 i = 0; i < proposal.depositsKeys.length; i++) {
            DepositKey memory depositKey = proposal.depositsKeys[i];
            DepositExtraInfo memory depositExtraInfo = depositsExtraInfo[i];

            // slither-disable-next-line calls-loop
            Deposit.DepositRequest memory depositRequest = bridge.deposits(
                uint256(
                    keccak256(
                        abi.encodePacked(
                            depositKey.fundingTxHash,
                            depositKey.fundingOutputIndex
                        )
                    )
                )
            );

            require(depositRequest.revealedAt != 0, "Deposit not revealed");

            require(
                /* solhint-disable-next-line not-rely-on-time */
                block.timestamp > depositRequest.revealedAt + depositMinAge,
                "Deposit min age not achieved yet"
            );

            require(depositRequest.sweptAt == 0, "Deposit already swept");

            require(
                isDepositExtraInfoValid(
                    depositKey,
                    depositRequest.depositor,
                    depositExtraInfo
                ),
                "Invalid deposit extra data"
            );

            uint32 depositRefundableTimestamp = BTCUtils.reverseUint32(
                uint32(depositExtraInfo.refundLocktime)
            );
            require(
                /* solhint-disable-next-line not-rely-on-time */
                block.timestamp <
                    depositRefundableTimestamp - depositRefundSafetyMargin,
                "Deposit refund safety margin is not preserved"
            );

            require(
                depositExtraInfo.walletPubKeyHash == proposal.walletPubKeyHash,
                "Deposit controlled by different wallet"
            );

            // Make sure all deposits target the same vault by using the
            // vault of the first deposit as a reference.
            if (i == 0) {
                proposalVault = depositRequest.vault;
            }
            require(
                depositRequest.vault == proposalVault,
                "Deposit targets different vault"
            );
        }
    }

    /// @notice Validates the extra data for the given deposit. This function
    ///         is heavily based on Deposit.revealDeposit function.
    /// @param depositKey Key of the given deposit.
    /// @param depositor Depositor that revealed the deposit.
    /// @param depositExtraInfo Extra data being subject of the validation.
    /// @return True if extra data are valid. False otherwise.
    /// @dev Requirements:
    ///      - The transaction hash computed using `depositExtraInfo.fundingTx`
    ///        must match the `depositKey.fundingTxHash`. This requirement
    ///        ensures the funding transaction data provided in the extra
    ///        data container actually represent the funding transaction of
    ///        the given deposit.
    ///      - The P2(W)SH script inferred from `depositExtraInfo` is actually
    ///        used to lock funds by the `depositKey.fundingOutputIndex` output
    ///        of the `depositExtraInfo.fundingTx` transaction. This requirement
    ///        ensures the reveal data provided in the extra data container
    ///        actually matches the given deposit.
    function isDepositExtraInfoValid(
        DepositKey memory depositKey,
        address depositor,
        DepositExtraInfo memory depositExtraInfo
    ) internal view returns (bool) {
        bytes32 depositExtraFundingTxHash = abi
            .encodePacked(
                depositExtraInfo.fundingTx.version,
                depositExtraInfo.fundingTx.inputVector,
                depositExtraInfo.fundingTx.outputVector,
                depositExtraInfo.fundingTx.locktime
            )
            .hash256View();

        // Make sure the funding tx provided as part of deposit extra data
        // actually matches the deposit referred by the given deposit key.
        if (depositKey.fundingTxHash != depositExtraFundingTxHash) {
            return false;
        }

        bytes memory expectedScript = abi.encodePacked(
            hex"14", // Byte length of depositor Ethereum address.
            depositor,
            hex"75", // OP_DROP
            hex"08", // Byte length of blinding factor value.
            depositExtraInfo.blindingFactor,
            hex"75", // OP_DROP
            hex"76", // OP_DUP
            hex"a9", // OP_HASH160
            hex"14", // Byte length of a compressed Bitcoin public key hash.
            depositExtraInfo.walletPubKeyHash,
            hex"87", // OP_EQUAL
            hex"63", // OP_IF
            hex"ac", // OP_CHECKSIG
            hex"67", // OP_ELSE
            hex"76", // OP_DUP
            hex"a9", // OP_HASH160
            hex"14", // Byte length of a compressed Bitcoin public key hash.
            depositExtraInfo.refundPubKeyHash,
            hex"88", // OP_EQUALVERIFY
            hex"04", // Byte length of refund locktime value.
            depositExtraInfo.refundLocktime,
            hex"b1", // OP_CHECKLOCKTIMEVERIFY
            hex"75", // OP_DROP
            hex"ac", // OP_CHECKSIG
            hex"68" // OP_ENDIF
        );

        bytes memory fundingOutput = depositExtraInfo
            .fundingTx
            .outputVector
            .extractOutputAtIndex(depositKey.fundingOutputIndex);
        bytes memory fundingOutputHash = fundingOutput.extractHash();

        // Path that checks the deposit extra data validity in case the
        // referred deposit is a P2SH.
        if (
            // slither-disable-next-line calls-loop
            fundingOutputHash.length == 20 &&
            fundingOutputHash.slice20(0) == expectedScript.hash160View()
        ) {
            return true;
        }

        // Path that checks the deposit extra data validity in case the
        // referred deposit is a P2WSH.
        if (
            fundingOutputHash.length == 32 &&
            fundingOutputHash.toBytes32() == sha256(expectedScript)
        ) {
            return true;
        }

        return false;
    }
}
