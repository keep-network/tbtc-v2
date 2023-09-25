import {
  Bridge as ContractBridge,
  Deposit as ContractDeposit,
  Redemption as ContractRedemption,
  Wallets,
} from "../../../typechain/Bridge"
import {
  Bridge as ChainBridge,
  GetEvents,
  Identifier as ChainIdentifier,
  WalletRegistry as ChainWalletRegistry,
  NewWalletRegisteredEvent,
  Wallet,
  WalletState,
} from "../contracts"
import {
  DepositRevealedEvent,
  DepositScriptParameters,
  RevealedDeposit,
} from "../../deposit"
import { Event as EthersEvent } from "@ethersproject/contracts"
import { BigNumber, constants, ContractTransaction, utils } from "ethers"
import { backoffRetrier, Hex } from "../utils"
import {
  compressPublicKey,
  computeHash160,
  DecomposedRawTransaction,
  Proof,
  readCompactSizeUint,
  TransactionHash,
  UnspentTransactionOutput,
} from "../bitcoin"
import { RedemptionRequest, RedemptionRequestedEvent } from "../../redemption"
import {
  ContractConfig,
  EthereumContract,
  sendWithRetry,
} from "./contract-handle"
import BridgeDeployment from "@keep-network/tbtc-v2/artifacts/Bridge.json"
import { Address } from "./address"
import { WalletRegistry } from "./wallet-registry"

type ContractDepositRequest = ContractDeposit.DepositRequestStructOutput

type ContractRedemptionRequest =
  ContractRedemption.RedemptionRequestStructOutput

/**
 * Implementation of the Ethereum Bridge handle.
 * @see {ChainBridge} for reference.
 */
export class Bridge
  extends EthereumContract<ContractBridge>
  implements ChainBridge
{
  constructor(config: ContractConfig) {
    super(config, BridgeDeployment)
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {ChainBridge#getDepositRevealedEvents}
   */
  async getDepositRevealedEvents(
    options?: GetEvents.Options,
    ...filterArgs: Array<unknown>
  ): Promise<DepositRevealedEvent[]> {
    const events: EthersEvent[] = await this.getEvents(
      "DepositRevealed",
      options,
      ...filterArgs
    )

    return events.map<DepositRevealedEvent>((event) => {
      return {
        blockNumber: BigNumber.from(event.blockNumber).toNumber(),
        blockHash: Hex.from(event.blockHash),
        transactionHash: Hex.from(event.transactionHash),
        fundingTxHash: TransactionHash.from(
          event.args!.fundingTxHash
        ).reverse(),
        fundingOutputIndex: BigNumber.from(
          event.args!.fundingOutputIndex
        ).toNumber(),
        depositor: new Address(event.args!.depositor),
        amount: BigNumber.from(event.args!.amount),
        blindingFactor: Hex.from(event.args!.blindingFactor).toString(),
        walletPublicKeyHash: Hex.from(event.args!.walletPubKeyHash).toString(),
        refundPublicKeyHash: Hex.from(event.args!.refundPubKeyHash).toString(),
        refundLocktime: Hex.from(event.args!.refundLocktime).toString(),
        vault:
          event.args!.vault === constants.AddressZero
            ? undefined
            : new Address(event.args!.vault),
      }
    })
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {ChainBridge#pendingRedemptions}
   */
  async pendingRedemptions(
    walletPublicKey: string,
    redeemerOutputScript: string
  ): Promise<RedemptionRequest> {
    const redemptionKey = Bridge.buildRedemptionKey(
      computeHash160(walletPublicKey),
      redeemerOutputScript
    )

    const request: ContractRedemptionRequest =
      await backoffRetrier<ContractRedemptionRequest>(this._totalRetryAttempts)(
        async () => {
          return await this._instance.pendingRedemptions(redemptionKey)
        }
      )

    return this.parseRedemptionRequest(request, redeemerOutputScript)
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {ChainBridge#timedOutRedemptions}
   */
  async timedOutRedemptions(
    walletPublicKey: string,
    redeemerOutputScript: string
  ): Promise<RedemptionRequest> {
    const redemptionKey = Bridge.buildRedemptionKey(
      computeHash160(walletPublicKey),
      redeemerOutputScript
    )

    const request: ContractRedemptionRequest =
      await backoffRetrier<ContractRedemptionRequest>(this._totalRetryAttempts)(
        async () => {
          return await this._instance.timedOutRedemptions(redemptionKey)
        }
      )

    return this.parseRedemptionRequest(request, redeemerOutputScript)
  }

  /**
   * Builds a redemption key required to refer a redemption request.
   * @param walletPublicKeyHash The wallet public key hash that identifies the
   *        pending redemption (along with the redeemer output script). Must be
   *        unprefixed.
   * @param redeemerOutputScript The redeemer output script that identifies the
   *        pending redemption (along with the wallet public key hash). Must be
   *        un-prefixed and not prepended with length.
   * @returns The redemption key.
   */
  static buildRedemptionKey(
    walletPublicKeyHash: string,
    redeemerOutputScript: string
  ): string {
    // Convert the output script to raw bytes buffer.
    const rawRedeemerOutputScript = Buffer.from(redeemerOutputScript, "hex")
    // Prefix the output script bytes buffer with 0x and its own length.
    const prefixedRawRedeemerOutputScript = `0x${Buffer.concat([
      Buffer.from([rawRedeemerOutputScript.length]),
      rawRedeemerOutputScript,
    ]).toString("hex")}`
    // Build the redemption key by using the 0x-prefixed wallet PKH and
    // prefixed output script.
    return utils.solidityKeccak256(
      ["bytes32", "bytes20"],
      [
        utils.solidityKeccak256(["bytes"], [prefixedRawRedeemerOutputScript]),
        `0x${walletPublicKeyHash}`,
      ]
    )
  }

  /**
   * Parses a redemption request using data fetched from the on-chain contract.
   * @param request Data of the request.
   * @param redeemerOutputScript The redeemer output script that identifies the
   *        pending redemption (along with the wallet public key hash). Must be
   *        un-prefixed and not prepended with length.
   * @returns Parsed redemption request.
   */
  private parseRedemptionRequest(
    request: ContractRedemptionRequest,
    redeemerOutputScript: string
  ): RedemptionRequest {
    return {
      redeemer: new Address(request.redeemer),
      redeemerOutputScript: redeemerOutputScript,
      requestedAmount: BigNumber.from(request.requestedAmount),
      treasuryFee: BigNumber.from(request.treasuryFee),
      txMaxFee: BigNumber.from(request.txMaxFee),
      requestedAt: BigNumber.from(request.requestedAt).toNumber(),
    }
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {ChainBridge#revealDeposit}
   */
  async revealDeposit(
    depositTx: DecomposedRawTransaction,
    depositOutputIndex: number,
    deposit: DepositScriptParameters,
    vault?: ChainIdentifier
  ): Promise<string> {
    const depositTxParam = {
      version: `0x${depositTx.version}`,
      inputVector: `0x${depositTx.inputs}`,
      outputVector: `0x${depositTx.outputs}`,
      locktime: `0x${depositTx.locktime}`,
    }

    const revealParam = {
      fundingOutputIndex: depositOutputIndex,
      blindingFactor: `0x${deposit.blindingFactor}`,
      walletPubKeyHash: `0x${deposit.walletPublicKeyHash}`,
      refundPubKeyHash: `0x${deposit.refundPublicKeyHash}`,
      refundLocktime: `0x${deposit.refundLocktime}`,
      vault: vault ? `0x${vault.identifierHex}` : constants.AddressZero,
    }

    const tx = await sendWithRetry<ContractTransaction>(
      async () => {
        return await this._instance.revealDeposit(depositTxParam, revealParam)
      },
      this._totalRetryAttempts,
      undefined,
      ["Deposit already revealed"]
    )

    return tx.hash
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {ChainBridge#submitDepositSweepProof}
   */
  async submitDepositSweepProof(
    sweepTx: DecomposedRawTransaction,
    sweepProof: Proof,
    mainUtxo: UnspentTransactionOutput,
    vault?: ChainIdentifier
  ): Promise<void> {
    const sweepTxParam = {
      version: `0x${sweepTx.version}`,
      inputVector: `0x${sweepTx.inputs}`,
      outputVector: `0x${sweepTx.outputs}`,
      locktime: `0x${sweepTx.locktime}`,
    }

    const sweepProofParam = {
      merkleProof: `0x${sweepProof.merkleProof}`,
      txIndexInBlock: sweepProof.txIndexInBlock,
      bitcoinHeaders: `0x${sweepProof.bitcoinHeaders}`,
    }

    const mainUtxoParam = {
      // The Ethereum Bridge expects this hash to be in the Bitcoin internal
      // byte order.
      txHash: mainUtxo.transactionHash.reverse().toPrefixedString(),
      txOutputIndex: mainUtxo.outputIndex,
      txOutputValue: mainUtxo.value,
    }

    const vaultParam = vault
      ? `0x${vault.identifierHex}`
      : constants.AddressZero

    await sendWithRetry<ContractTransaction>(async () => {
      return await this._instance.submitDepositSweepProof(
        sweepTxParam,
        sweepProofParam,
        mainUtxoParam,
        vaultParam
      )
    }, this._totalRetryAttempts)
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {ChainBridge#txProofDifficultyFactor}
   */
  async txProofDifficultyFactor(): Promise<number> {
    const txProofDifficultyFactor: BigNumber = await backoffRetrier<BigNumber>(
      this._totalRetryAttempts
    )(async () => {
      return await this._instance.txProofDifficultyFactor()
    })

    return txProofDifficultyFactor.toNumber()
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {ChainBridge#requestRedemption}
   */
  async requestRedemption(
    walletPublicKey: string,
    mainUtxo: UnspentTransactionOutput,
    redeemerOutputScript: string,
    amount: BigNumber
  ): Promise<void> {
    const walletPublicKeyHash = `0x${computeHash160(walletPublicKey)}`

    const mainUtxoParam = {
      // The Ethereum Bridge expects this hash to be in the Bitcoin internal
      // byte order.
      txHash: mainUtxo.transactionHash.reverse().toPrefixedString(),
      txOutputIndex: mainUtxo.outputIndex,
      txOutputValue: mainUtxo.value,
    }

    // Convert the output script to raw bytes buffer.
    const rawRedeemerOutputScript = Buffer.from(redeemerOutputScript, "hex")
    // Prefix the output script bytes buffer with 0x and its own length.
    const prefixedRawRedeemerOutputScript = `0x${Buffer.concat([
      Buffer.from([rawRedeemerOutputScript.length]),
      rawRedeemerOutputScript,
    ]).toString("hex")}`

    await sendWithRetry<ContractTransaction>(async () => {
      return await this._instance.requestRedemption(
        walletPublicKeyHash,
        mainUtxoParam,
        prefixedRawRedeemerOutputScript,
        amount
      )
    }, this._totalRetryAttempts)
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {ChainBridge#submitRedemptionProof}
   */
  async submitRedemptionProof(
    redemptionTx: DecomposedRawTransaction,
    redemptionProof: Proof,
    mainUtxo: UnspentTransactionOutput,
    walletPublicKey: string
  ): Promise<void> {
    const redemptionTxParam = {
      version: `0x${redemptionTx.version}`,
      inputVector: `0x${redemptionTx.inputs}`,
      outputVector: `0x${redemptionTx.outputs}`,
      locktime: `0x${redemptionTx.locktime}`,
    }

    const redemptionProofParam = {
      merkleProof: `0x${redemptionProof.merkleProof}`,
      txIndexInBlock: redemptionProof.txIndexInBlock,
      bitcoinHeaders: `0x${redemptionProof.bitcoinHeaders}`,
    }

    const mainUtxoParam = {
      // The Ethereum Bridge expects this hash to be in the Bitcoin internal
      // byte order.
      txHash: mainUtxo.transactionHash.reverse().toPrefixedString(),
      txOutputIndex: mainUtxo.outputIndex,
      txOutputValue: mainUtxo.value,
    }

    const walletPublicKeyHash = `0x${computeHash160(walletPublicKey)}`

    await sendWithRetry<ContractTransaction>(async () => {
      return await this._instance.submitRedemptionProof(
        redemptionTxParam,
        redemptionProofParam,
        mainUtxoParam,
        walletPublicKeyHash
      )
    }, this._totalRetryAttempts)
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {ChainBridge#deposits}
   */
  async deposits(
    depositTxHash: TransactionHash,
    depositOutputIndex: number
  ): Promise<RevealedDeposit> {
    const depositKey = Bridge.buildDepositKey(depositTxHash, depositOutputIndex)

    const deposit: ContractDepositRequest =
      await backoffRetrier<ContractDepositRequest>(this._totalRetryAttempts)(
        async () => {
          return await this._instance.deposits(depositKey)
        }
      )

    return this.parseRevealedDeposit(deposit)
  }

  /**
   * Builds the deposit key required to refer a revealed deposit.
   * @param depositTxHash The revealed deposit transaction's hash.
   * @param depositOutputIndex Index of the deposit transaction output that
   *        funds the revealed deposit.
   * @returns Deposit key.
   */
  static buildDepositKey(
    depositTxHash: TransactionHash,
    depositOutputIndex: number
  ): string {
    const prefixedReversedDepositTxHash = depositTxHash
      .reverse()
      .toPrefixedString()

    return utils.solidityKeccak256(
      ["bytes32", "uint32"],
      [prefixedReversedDepositTxHash, depositOutputIndex]
    )
  }

  /**
   * Parses a revealed deposit using data fetched from the on-chain contract.
   * @param deposit Data of the revealed deposit.
   * @returns Parsed revealed deposit.
   */
  private parseRevealedDeposit(
    deposit: ContractDepositRequest
  ): RevealedDeposit {
    return {
      depositor: new Address(deposit.depositor),
      amount: BigNumber.from(deposit.amount),
      vault:
        deposit.vault === constants.AddressZero
          ? undefined
          : new Address(deposit.vault),
      revealedAt: BigNumber.from(deposit.revealedAt).toNumber(),
      sweptAt: BigNumber.from(deposit.sweptAt).toNumber(),
      treasuryFee: BigNumber.from(deposit.treasuryFee),
    }
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {ChainBridge#activeWalletPublicKey}
   */
  async activeWalletPublicKey(): Promise<string | undefined> {
    const activeWalletPublicKeyHash: string = await backoffRetrier<string>(
      this._totalRetryAttempts
    )(async () => {
      return await this._instance.activeWalletPubKeyHash()
    })

    if (
      activeWalletPublicKeyHash === "0x0000000000000000000000000000000000000000"
    ) {
      // If there is no active wallet currently, return undefined.
      return undefined
    }

    const { walletPublicKey } = await this.wallets(
      Hex.from(activeWalletPublicKeyHash)
    )

    return walletPublicKey.toString()
  }

  private async getWalletCompressedPublicKey(ecdsaWalletID: Hex): Promise<Hex> {
    const walletRegistry = await this.walletRegistry()
    const uncompressedPublicKey = await walletRegistry.getWalletPublicKey(
      ecdsaWalletID
    )

    return Hex.from(compressPublicKey(uncompressedPublicKey))
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {ChainBridge#getNewWalletRegisteredEvents}
   */
  async getNewWalletRegisteredEvents(
    options?: GetEvents.Options,
    ...filterArgs: Array<unknown>
  ): Promise<NewWalletRegisteredEvent[]> {
    const events: EthersEvent[] = await this.getEvents(
      "NewWalletRegistered",
      options,
      ...filterArgs
    )

    return events.map<NewWalletRegisteredEvent>((event) => {
      return {
        blockNumber: BigNumber.from(event.blockNumber).toNumber(),
        blockHash: Hex.from(event.blockHash),
        transactionHash: Hex.from(event.transactionHash),
        ecdsaWalletID: Hex.from(event.args!.ecdsaWalletID),
        walletPublicKeyHash: Hex.from(event.args!.walletPubKeyHash),
      }
    })
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {ChainBridge#walletRegistry}
   */
  async walletRegistry(): Promise<ChainWalletRegistry> {
    const { ecdsaWalletRegistry } = await backoffRetrier<{
      ecdsaWalletRegistry: string
    }>(this._totalRetryAttempts)(async () => {
      return await this._instance.contractReferences()
    })

    return new WalletRegistry({
      address: ecdsaWalletRegistry,
      signerOrProvider: this._instance.signer || this._instance.provider,
    })
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {ChainBridge#wallets}
   */
  async wallets(walletPublicKeyHash: Hex): Promise<Wallet> {
    const wallet = await backoffRetrier<Wallets.WalletStructOutput>(
      this._totalRetryAttempts
    )(async () => {
      return await this._instance.wallets(
        walletPublicKeyHash.toPrefixedString()
      )
    })

    return this.parseWalletDetails(wallet)
  }

  /**
   * Parses a wallet data using data fetched from the on-chain contract.
   * @param wallet Data of the wallet.
   * @returns Parsed wallet data.
   */
  private async parseWalletDetails(
    wallet: Wallets.WalletStructOutput
  ): Promise<Wallet> {
    const ecdsaWalletID = Hex.from(wallet.ecdsaWalletID)

    return {
      ecdsaWalletID,
      walletPublicKey: await this.getWalletCompressedPublicKey(ecdsaWalletID),
      mainUtxoHash: Hex.from(wallet.mainUtxoHash),
      pendingRedemptionsValue: wallet.pendingRedemptionsValue,
      createdAt: wallet.createdAt,
      movingFundsRequestedAt: wallet.movingFundsRequestedAt,
      closingStartedAt: wallet.closingStartedAt,
      pendingMovedFundsSweepRequestsCount:
        wallet.pendingMovedFundsSweepRequestsCount,
      state: WalletState.parse(wallet.state),
      movingFundsTargetWalletsCommitmentHash: Hex.from(
        wallet.movingFundsTargetWalletsCommitmentHash
      ),
    }
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * Builds the UTXO hash based on the UTXO components. UTXO hash is computed as
   * `keccak256(txHash | txOutputIndex | txOutputValue)`.
   *
   * @see {ChainBridge#buildUtxoHash}
   */
  buildUtxoHash(utxo: UnspentTransactionOutput): Hex {
    return Hex.from(
      utils.solidityKeccak256(
        ["bytes32", "uint32", "uint64"],
        [
          utxo.transactionHash.reverse().toPrefixedString(),
          utxo.outputIndex,
          utxo.value,
        ]
      )
    )
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {ChainBridge#getDepositRevealedEvents}
   */
  async getRedemptionRequestedEvents(
    options?: GetEvents.Options,
    ...filterArgs: Array<unknown>
  ): Promise<RedemptionRequestedEvent[]> {
    // FIXME: Filtering by indexed walletPubKeyHash field may not work
    //        until https://github.com/ethers-io/ethers.js/pull/4244 is
    //        included in the currently used version of ethers.js.
    //        Ultimately, we should upgrade ethers.js to include that fix.
    //        Short-term, we can workaround the problem as presented in:
    //        https://github.com/threshold-network/token-dashboard/blob/main/src/threshold-ts/tbtc/index.ts#L1041C1-L1093C1
    const events: EthersEvent[] = await this.getEvents(
      "RedemptionRequested",
      options,
      ...filterArgs
    )

    return events.map<RedemptionRequestedEvent>((event) => {
      const prefixedRedeemerOutputScript = Hex.from(
        event.args!.redeemerOutputScript
      )
      const redeemerOutputScript = prefixedRedeemerOutputScript
        .toString()
        .slice(readCompactSizeUint(prefixedRedeemerOutputScript).byteLength * 2)

      return {
        blockNumber: BigNumber.from(event.blockNumber).toNumber(),
        blockHash: Hex.from(event.blockHash),
        transactionHash: Hex.from(event.transactionHash),
        walletPublicKeyHash: Hex.from(event.args!.walletPubKeyHash).toString(),
        redeemer: new Address(event.args!.redeemer),
        redeemerOutputScript: redeemerOutputScript,
        requestedAmount: BigNumber.from(event.args!.requestedAmount),
        treasuryFee: BigNumber.from(event.args!.treasuryFee),
        txMaxFee: BigNumber.from(event.args!.txMaxFee),
      }
    })
  }
}
