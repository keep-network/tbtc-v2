import { Bridge as ChainBridge, Identifier as ChainIdentifier } from "./chain"
import {
  BigNumber,
  constants,
  Contract as EthersContract,
  providers,
  Signer,
  utils,
} from "ethers"
import BridgeDeployment from "@keep-network/tbtc-v2/artifacts/Bridge.json"
import WalletRegistryDeployment from "@keep-network/ecdsa/artifacts/WalletRegistry.json"
import { DepositScriptParameters, RevealedDeposit } from "./deposit"
import { RedemptionRequest } from "./redemption"
import {
  compressPublicKey,
  computeHash160,
  DecomposedRawTransaction,
  Proof,
  TransactionHash,
  UnspentTransactionOutput,
} from "./bitcoin"

import type { Bridge as ContractBridge } from "../typechain/Bridge"
import type { WalletRegistry as ContractWalletRegistry } from "../typechain/WalletRegistry"

/**
 * Contract deployment artifact.
 * @see [hardhat-deploy#Deployment](https://github.com/wighawag/hardhat-deploy/blob/0c969e9a27b4eeff9f5ccac7e19721ef2329eed2/types.ts#L358)}
 */
export interface Deployment {
  /**
   * Address of the deployed contract.
   */
  address: string
  /**
   * Contract's ABI.
   */
  abi: any[]
  /**
   * Deployment transaction receipt.
   */
  receipt: {
    /**
     * Number of block in which the contract was deployed.
     */
    blockNumber: number
  }
}

/**
 * Represents an Ethereum address.
 */
export class Address implements ChainIdentifier {
  readonly identifierHex: string

  constructor(address: string) {
    let validAddress: string

    try {
      validAddress = utils.getAddress(address)
    } catch (e) {
      throw new Error(`Invalid Ethereum address`)
    }

    this.identifierHex = validAddress.substring(2).toLowerCase()
  }
}

/**
 * Represents a config set required to connect an Ethereum contract.
 */
export interface ContractConfig {
  /**
   * Address of the Ethereum contract as a 0x-prefixed hex string.
   * Optional parameter, if not provided the value will be resolved from the
   * contract artifact.
   */
  address?: string
  /**
   * Signer - will return a Contract which will act on behalf of that signer. The signer will sign all contract transactions.
   * Provider - will return a downgraded Contract which only has read-only access (i.e. constant calls)
   */
  signerOrProvider: Signer | providers.Provider
  /**
   * Number of a block in which the contract was deployed.
   * Optional parameter, if not provided the value will be resolved from the
   * contract artifact.
   */
  deployedAtBlockNumber?: number
}

/**
 * Deployed Ethereum contract
 */
class EthereumContract<T> {
  /**
   * Ethers instance of the deployed contract.
   */
  protected readonly _instance: T
  /**
   * Number of a block within which the contract was deployed. Value is read from
   * the contract deployment artifact. It can be overwritten by setting a
   * {@link ContractConfig.deployedAtBlockNumber} property.
   */
  protected readonly _deployedAtBlockNumber: number

  /**
   * @param config Configuration for contract instance initialization.
   * @param deployment Contract Deployment artifact.
   */
  constructor(config: ContractConfig, deployment: Deployment) {
    this._instance = new EthersContract(
      config.address ?? utils.getAddress(deployment.address),
      `${JSON.stringify(deployment.abi)}`,
      config.signerOrProvider
    ) as T

    this._deployedAtBlockNumber =
      config.deployedAtBlockNumber ?? deployment.receipt.blockNumber
  }
}

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
   * @see {ChainBridge#pendingRedemptions}
   */
  async pendingRedemptions(
    walletPublicKey: string,
    redeemerOutputScript: string
  ): Promise<RedemptionRequest> {
    const redemptionKey = this.buildRedemptionKey(
      computeHash160(walletPublicKey),
      redeemerOutputScript
    )

    const request = await this._instance.pendingRedemptions(redemptionKey)

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
    const redemptionKey = this.buildRedemptionKey(
      computeHash160(walletPublicKey),
      redeemerOutputScript
    )

    const request = await this._instance.timedOutRedemptions(redemptionKey)

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
  private buildRedemptionKey(
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
    request: any,
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

    const tx = await this._instance.revealDeposit(depositTxParam, revealParam)

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

    await this._instance.submitDepositSweepProof(
      sweepTxParam,
      sweepProofParam,
      mainUtxoParam,
      vaultParam
    )
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {ChainBridge#txProofDifficultyFactor}
   */
  async txProofDifficultyFactor(): Promise<number> {
    const txProofDifficultyFactor: BigNumber =
      await this._instance.txProofDifficultyFactor()
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

    await this._instance.requestRedemption(
      walletPublicKeyHash,
      mainUtxoParam,
      prefixedRawRedeemerOutputScript,
      amount
    )
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

    await this._instance.submitRedemptionProof(
      redemptionTxParam,
      redemptionProofParam,
      mainUtxoParam,
      walletPublicKeyHash
    )
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

    const deposit = await this._instance.deposits(depositKey)

    return this.parseRevealedDeposit(deposit)
  }

  /**
   * Builds the deposit key required to refer a revealed deposit.
   * @param depositTxHash The revealed deposit transaction's hash.
   * @param depositOutputIndex Index of the deposit transaction output that
   *        funds the revealed deposit.
   * @returns Revealed deposit data.
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
  private parseRevealedDeposit(deposit: any): RevealedDeposit {
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
    const activeWalletPublicKeyHash =
      await this._instance.activeWalletPubKeyHash()

    if (
      activeWalletPublicKeyHash === "0x0000000000000000000000000000000000000000"
    ) {
      // If there is no active wallet currently, return undefined.
      return undefined
    }

    const { ecdsaWalletID } = await this._instance.wallets(
      activeWalletPublicKeyHash
    )

    const walletRegistry = await this.walletRegistry()
    const uncompressedPublicKey = await walletRegistry.getWalletPublicKey(
      ecdsaWalletID
    )

    return compressPublicKey(uncompressedPublicKey)
  }

  private async walletRegistry(): Promise<WalletRegistry> {
    const { ecdsaWalletRegistry } = await this._instance.contractReferences()

    return new WalletRegistry({
      address: ecdsaWalletRegistry,
      signerOrProvider: this._instance.signer,
    })
  }
}

/**
 * Implementation of the Ethereum WalletRegistry handle.
 */
class WalletRegistry extends EthereumContract<ContractWalletRegistry> {
  constructor(config: ContractConfig) {
    super(config, WalletRegistryDeployment)
  }

  /**
   * Gets the public key for the given wallet.
   * @param walletID ID of the wallet.
   * @returns Uncompressed wallet public key as an unprefixed (neither 0x nor 04)
   *          hex string.
   */
  async getWalletPublicKey(walletID: string): Promise<string> {
    const publicKey = await this._instance.getWalletPublicKey(walletID)
    return publicKey.substring(2)
  }
}
