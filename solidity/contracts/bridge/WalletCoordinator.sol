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

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "./BitcoinTx.sol";
import "./Bridge.sol";
import "./Deposit.sol";
import "./Wallets.sol";

// TODO: Documentation and unit tests.
contract WalletCoordinator is OwnableUpgradeable {
    using BTCUtils for bytes;
    using BytesLib for bytes;

    struct DepositSweepProposal {
        bytes20 walletPubKeyHash;
        DepositKey[] depositsKeys;
    }

    struct DepositKey {
        bytes32 fundingTxHash;
        uint32 fundingOutputIndex;
    }

    struct DepositExtra {
        BitcoinTx.Info fundingTx;
        bytes8 blindingFactor;
        bytes20 walletPubKeyHash;
        bytes20 refundPubKeyHash;
        bytes4 refundLocktime;
    }

    mapping(address => bool) public isProposalSubmitter;

    mapping(bytes20 => uint32) public walletLock;

    Bridge public bridge;

    uint32 public depositSweepProposalValidity;

    uint16 public depositSweepMaxSize;

    uint32 public depositMinAge;

    event ProposalSubmitterAdded(address indexed proposalSubmitter);

    event ProposalSubmitterRemoved(address indexed proposalSubmitter);

    event DepositSweepProposalValidityUpdated(
        uint32 depositSweepProposalValidity
    );

    event DepositSweepMaxSizeUpdated(uint16 depositSweepMaxSize);

    event DepositMinAgeUpdated(uint32 depositMinAge);

    event DepositSweepProposalSubmitted(
        DepositSweepProposal proposal,
        address indexed proposalSubmitter
    );

    modifier onlyProposalSubmitter() {
        require(
            isProposalSubmitter[msg.sender],
            "Caller is not proposal submitter"
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

    function initialize(Bridge _bridge) external initializer {
        __Ownable_init();

        bridge = _bridge;
        depositSweepProposalValidity = 4 hours;
        depositSweepMaxSize = 5;
        depositMinAge = 2 hours;
    }

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

    function unlockWallet(bytes20 walletPubKeyHash) external onlyOwner {
        // Just in case, allow the owner to unlock the wallet earlier.
        walletLock[walletPubKeyHash] = 0;
    }

    function updateDepositSweepProposalValidity(
        uint32 _depositSweepProposalValidity
    ) external onlyOwner {
        depositSweepProposalValidity = _depositSweepProposalValidity;
        emit DepositSweepProposalValidityUpdated(_depositSweepProposalValidity);
    }

    function updateDepositSweepMaxSize(uint16 _depositSweepMaxSize)
        external
        onlyOwner
    {
        depositSweepMaxSize = _depositSweepMaxSize;
        emit DepositSweepMaxSizeUpdated(_depositSweepMaxSize);
    }

    function updateDepositMinAge(uint32 _depositMinAge) external onlyOwner {
        depositMinAge = _depositMinAge;
        emit DepositMinAgeUpdated(_depositMinAge);
    }

    function submitDepositSweepProposal(DepositSweepProposal calldata proposal)
        external
        onlyProposalSubmitter
        onlyAfterWalletLock(proposal.walletPubKeyHash)
    {
        walletLock[proposal.walletPubKeyHash] =
            /* solhint-disable-next-line not-rely-on-time */
            uint32(block.timestamp) +
            depositSweepProposalValidity;

        emit DepositSweepProposalSubmitted(proposal, msg.sender);
    }

    function validateDepositSweepProposal(
        DepositSweepProposal calldata proposal,
        DepositExtra[] calldata depositsExtras
    ) external view {
        require(
            bridge.wallets(proposal.walletPubKeyHash).state ==
                Wallets.WalletState.Live,
            "Wallet is not in Live state"
        );

        require(
            proposal.depositsKeys.length <= depositSweepMaxSize,
            "Sweep exceeds the max size"
        );

        require(
            proposal.depositsKeys.length == depositsExtras.length,
            "Each deposit key must have matching extra data"
        );

        for (uint256 i = 0; i < proposal.depositsKeys.length; i++) {
            DepositKey memory depositKey = proposal.depositsKeys[i];
            DepositExtra memory depositExtra = depositsExtras[i];

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
                isDepositExtraValid(
                    depositKey,
                    depositRequest.depositor,
                    depositExtra
                ),
                "Invalid deposit extra data"
            );

            // TODO: Check deposit will not become refundable soon.
        }

        // TODO: Make sure all deposits target the same wallet and same vault.
    }

    function isDepositExtraValid(
        DepositKey memory depositKey,
        address depositor,
        DepositExtra memory depositExtra
    ) internal view returns (bool) {
        bytes32 depositExtraFundingTxHash = abi
            .encodePacked(
                depositExtra.fundingTx.version,
                depositExtra.fundingTx.inputVector,
                depositExtra.fundingTx.outputVector,
                depositExtra.fundingTx.locktime
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
            depositExtra.blindingFactor,
            hex"75", // OP_DROP
            hex"76", // OP_DUP
            hex"a9", // OP_HASH160
            hex"14", // Byte length of a compressed Bitcoin public key hash.
            depositExtra.walletPubKeyHash,
            hex"87", // OP_EQUAL
            hex"63", // OP_IF
            hex"ac", // OP_CHECKSIG
            hex"67", // OP_ELSE
            hex"76", // OP_DUP
            hex"a9", // OP_HASH160
            hex"14", // Byte length of a compressed Bitcoin public key hash.
            depositExtra.refundPubKeyHash,
            hex"88", // OP_EQUALVERIFY
            hex"04", // Byte length of refund locktime value.
            depositExtra.refundLocktime,
            hex"b1", // OP_CHECKLOCKTIMEVERIFY
            hex"75", // OP_DROP
            hex"ac", // OP_CHECKSIG
            hex"68" // OP_ENDIF
        );

        bytes memory fundingOutput = depositExtra
            .fundingTx
            .outputVector
            .extractOutputAtIndex(depositKey.fundingOutputIndex);
        bytes memory fundingOutputHash = fundingOutput.extractHash();

        // Path that checks the deposit extra data validity in case the
        // referred deposit is a P2SH.
        if (
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
