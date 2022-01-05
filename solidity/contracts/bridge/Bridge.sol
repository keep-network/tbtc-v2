pragma solidity 0.8.4;

import {BTCUtils} from "./BTCUtils.sol";
import {BytesLib} from "./BytesLib.sol";

/// @title BTC Bridge
/// @notice Bridge manages BTC deposit and redemption and is increasing and
///         decreasing balances in the Bank as a result of BTC deposit and
///         redemption operations.
///
///         Depositors send BTC funds to the most-recently-created-wallet of the
///         bridge using pay-to-script-hash (P2SH) which contains hashed
///         information about the depositor’s minting Ethereum address. Then,
///         the depositor reveals their desired Ethereum minting address to the
///         Ethereum chain. The Bridge listens for these sorts of messages and
///         when it gets one, it checks the Bitcoin network to make sure the
///         funds line up. If they do, the off-chain wallet may decide to pick
///         this transaction for sweeping, and when the sweep operation is
///         confirmed on the Bitcoin network, the wallet informs the Bridge
///         about the sweep increasing appropriate balances in the Bank.
/// @dev Bridge is an upgradeable component of the Bank.
contract Bridge {
    // TODO: Consider using a custom fork of Summa libs adjusted to Solidity 8.
    using BTCUtils for bytes;

    struct TxInfo {
        bytes4 version;
        bytes inputVector;
        bytes outputVector;
        bytes4 locktime;
    }

    struct RevealInfo {
        uint8 fundingOutputIndex;
        address depositor;
        bytes8 blindingFactor;
        bytes walletPubKey;
        bytes refundPubKey;
        bytes4 refundLocktime;
    }

    struct DepositInfo {
        address depositor;
        uint64 amount;
        uint32 revealedAt;
        address vault;
    }

    /// @notice Collection of all unswept deposits indexed by
    ///         keccak256(fundingTxHash | fundingOutputIndex).
    ///         This mapping may contain valid and invalid deposits and the
    ///         wallet is responsible for validating them before attempting to
    ///         execute a sweep.
    mapping(uint256 => DepositInfo) public unswept;

    event DepositRevealed(
        bytes32 fundingTxHash,
        uint8 fundingOutputIndex,
        address depositor,
        bytes8 blindingFactor,
        bytes walletPubKey,
        bytes refundPubKey,
        bytes4 refundLocktime,
        uint64 amount,
        address vault
    );

    /// TODO: Documentation.
    function revealDeposit(
        TxInfo calldata fundingTx,
        RevealInfo calldata reveal,
        address vault
    ) external {
        // TODO: The .hash160() will work only for P2SH deposits. For P2WSH,
        //       .hash256() must be done.
        bytes memory expectedScriptHash =
            abi
                .encodePacked(
                hex"14", // Byte length of depositor Ethereum address.
                reveal
                    .depositor,
                hex"75", // OP_DROP
                hex"08", // Byte length of blinding factor value.
                reveal
                    .blindingFactor,
                hex"75", // OP_DROP
                hex"76", // OP_DUP
                hex"a9", // OP_HASH160
                hex"21", // Byte length of a compressed Bitcoin public key.
                reveal
                    .walletPubKey,
                hex"87", // OP_EQUAL
                hex"63", // OP_IF
                hex"ac", // OP_CHECKSIG
                hex"67", // OP_ELSE
                hex"76", // OP_DUP
                hex"a9", // OP_HASH160
                hex"21", // Byte length of a compressed Bitcoin public key.
                reveal
                    .refundPubKey,
                hex"88", // OP_EQUALVERIFY
                hex"04", // Byte length of refund locktime value.
                reveal
                    .refundLocktime,
                hex"b1", // OP_CHECKLOCKTIMEVERIFY
                hex"75", // OP_DROP
                hex"ac", // OP_CHECKSIG
                hex"68" // OP_ENDIF
            )
                .hash160();

        bytes memory fundingOutput =
            fundingTx.outputVector.extractOutputAtIndex(
                reveal.fundingOutputIndex
            );

        require(
            keccak256(fundingOutput.extractHash()) ==
                keccak256(expectedScriptHash),
            "Wrong script hash"
        );

        // Resulting TX hash is in native Bitcoin little-endian format.
        bytes32 fundingTxHash =
            abi
                .encodePacked(
                fundingTx
                    .version,
                fundingTx
                    .inputVector,
                fundingTx
                    .outputVector,
                fundingTx
                    .locktime
            )
                .hash256();

        DepositInfo storage deposit =
            unswept[
                uint256(
                    keccak256(
                        abi.encodePacked(
                            fundingTxHash,
                            reveal.fundingOutputIndex
                        )
                    )
                )
            ];
        require(deposit.revealedAt == 0, "Deposit already revealed");

        deposit.depositor = reveal.depositor;
        deposit.amount = fundingOutput.extractValue();
        /* solhint-disable-next-line not-rely-on-time */
        deposit.revealedAt = uint32(block.timestamp);
        deposit.vault = vault;

        emit DepositRevealed(
            fundingTxHash,
            reveal.fundingOutputIndex,
            reveal.depositor,
            reveal.blindingFactor,
            reveal.walletPubKey,
            reveal.refundPubKey,
            reveal.refundLocktime,
            deposit.amount,
            vault
        );
    }

    /// @notice Used by the wallet to prove the BTC deposit sweep transaction
    ///         and to update Bank balances accordingly. Sweep is only accepted
    ///         if it satisfies SPV proof.
    ///
    ///         The function is performing Bank balance updates by first
    ///         computing the Bitcoin fee for the sweep transaction. The fee is
    ///         divided evenly between all swept deposits. Each depositor
    ///         receives a balance in the bank equal to the amount they have
    ///         declared during the reveal transaction, minus their fee share.
    ///
    ///         It is possible to prove the given sweep only one time.
    /// @param txVersion Transaction version number (4-byte LE)
    /// @param txInputVector All transaction inputs prepended by the number of
    ///                      inputs encoded as a VarInt, max 0xFC(252) inputs
    /// @param txOutput Single sweep transaction output
    /// @param txLocktime Final 4 bytes of the transaction
    /// @param merkleProof The merkle proof of transaction inclusion in a block
    /// @param txIndexInBlock Transaction index in the block (0-indexed)
    /// @param bitcoinHeaders Single bytestring of 80-byte bitcoin headers,
    ///                       lowest height first
    function sweep(
        bytes4 txVersion,
        bytes memory txInputVector,
        bytes memory txOutput,
        bytes4 txLocktime,
        bytes memory merkleProof,
        uint256 txIndexInBlock,
        bytes memory bitcoinHeaders
    ) external {
        // TODO We need to read `fundingTxHash`, `fundingOutputIndex` and
        //      P2SH script depositor address from `txInputVector`.
        //      We then hash them to obtain deposit identifier and read
        //      DepositInfo. From DepositInfo we know what amount was declared
        //      by the depositor in their reveal transaction and we use that
        //      amount to update their Bank balance, minus fee.
        //
        // TODO We need to validate if the sum in the output minus the
        //      amount from the previous wallet balance input minus fees is
        //      equal to the amount by which Bank balances were increased.
        //
        // TODO We need to validate txOutput to see if the balance was not
        //      transferred away from the wallet before increasing balances in
        //      the bank.
        //
        // TODO Delete deposit from unswept mapping or mark it as swept
        //      depending on the gas costs. Alternativly, do not allow to
        //      use the same TX input vector twice. Sweep should be provable
        //      only one time.
    }

    // TODO It is possible a malicious wallet can sweep deposits that can not
    //      be later proved on Ethereum. For example, a deposit with
    //      an incorrect amount revealed. We need to provide a function for honest
    //      depositors, next to sweep, to prove their swept balances on Ethereum
    //      selectively, based on deposits they have earlier received.
}
