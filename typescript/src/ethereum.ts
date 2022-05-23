import { Bridge as ChainBridge, Identifier } from "./chain"
import {
  constants,
  Contract,
  ContractInterface,
  getDefaultProvider,
  utils,
  Wallet,
} from "ethers"
import { abi as BridgeABI } from "@keep-network/tbtc-v2/artifacts/Bridge.json"
import { Deposit } from "./deposit"
import { RedemptionRequest } from "./redemption"
import {
  computeHash160,
  DecomposedRawTransaction,
  Proof,
  UnspentTransactionOutput,
} from "./bitcoin"

/**
 * Represents a config set required to instantiate an Ethereum provider.
 */
export interface ProviderConfig {
  /**
   * Network name, e.g. "homestead" or "ropsten". Can be also a URL to
   * connect to, such as http://localhost:8545 or wss://example.com.
   */
  network: string
  /**
   * Optional parameters passed to the provider.
   */
  options?: any
}

/**
 * Represents a config set required to instantiate an Ethereum signer.
 */
export interface SignerConfig {
  /**
   * Ethereum private key as a 0x-prefixed hex string.
   */
  privateKey: string
}

/**
 * Represents a config set required to connect an Ethereum contract.
 */
export interface ContractConfig {
  /**
   * Address of the Ethereum contract as a 0x-prefixed hex string.
   */
  address: string
  /**
   * Provider config.
   * @see {ProviderConfig}
   */
  provider: ProviderConfig
  /**
   * Optional signer config. If not provided, the contract connection handle
   * will work in the readonly mode.
   * @see {SignerConfig}
   */
  signer?: SignerConfig
}

/**
 * Returns a handle to an Ethereum contract.
 * @param abi ABI of the contract the handle should point to
 * @param config Config of the contract handle
 * @returns A contract handle.
 */
function getContractHandle(
  abi: ContractInterface,
  config: ContractConfig
): Contract {
  const provider = getDefaultProvider(
    config.provider.network,
    config.provider.options
  )

  const signer = config.signer
    ? new Wallet(config.signer.privateKey, provider)
    : null

  return new Contract(config.address, abi, signer || provider)
}

/**
 * Implementation of the Ethereum Bridge handle.
 * @see {ChainBridge} for reference.
 */
export class Bridge implements ChainBridge {
  private _bridge: Contract

  constructor(config: ContractConfig) {
    this._bridge = getContractHandle(`${BridgeABI}`, config)
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {ChainBridge#pendingRedemptions}
   */
  pendingRedemptions(
    walletPubKeyHash: string,
    redeemerOutputScript: string
  ): Promise<RedemptionRequest> {
    // Convert the output script to raw bytes buffer.
    const rawRedeemerOutputScript = Buffer.from(redeemerOutputScript, "hex")
    // Prefix the output script bytes buffer with 0x and its own length.
    const prefixedRawRedeemerOutputScript = `0x${Buffer.concat([
      Buffer.from([rawRedeemerOutputScript.length]),
      rawRedeemerOutputScript,
    ]).toString("hex")}`
    // Build the redemption key by using the 0x-prefixed wallet PKH and
    // prefixed output script.
    const redemptionKey = utils.solidityKeccak256(
      ["bytes20", "bytes"],
      [`0x${walletPubKeyHash}`, prefixedRawRedeemerOutputScript]
    )

    return this._bridge.pendingRedemptions(redemptionKey)
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {ChainBridge#revealDeposit}
   */
  revealDeposit(
    depositTx: DecomposedRawTransaction,
    depositOutputIndex: number,
    deposit: Deposit
  ): Promise<void> {
    const depositTxParam = {
      version: `0x${depositTx.version}`,
      inputVector: `0x${depositTx.inputs}`,
      outputVector: `0x${depositTx.outputs}`,
      locktime: `0x${depositTx.locktime}`,
    }

    const revealParam = {
      fundingOutputIndex: depositOutputIndex,
      depositor: `0x${deposit.depositor.identifierHex}`,
      blindingFactor: `0x${deposit.blindingFactor}`,
      walletPubKeyHash: `0x${computeHash160(deposit.walletPublicKey)}`,
      refundPubKeyHash: `0x${computeHash160(deposit.refundPublicKey)}`,
      refundLocktime: `0x${deposit.refundLocktime}`,
      vault: deposit.vault
        ? `0x${deposit.vault.identifierHex}`
        : constants.AddressZero,
    }

    return this._bridge.revealDeposit(depositTxParam, revealParam)
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {ChainBridge#submitDepositSweepProof}
   */
  submitDepositSweepProof(
    sweepTx: DecomposedRawTransaction,
    sweepProof: Proof,
    mainUtxo: UnspentTransactionOutput,
    vault?: Identifier
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
      txHash: `0x${mainUtxo.transactionHash}`,
      txOutputIndex: mainUtxo.outputIndex,
      txOutputValue: mainUtxo.value,
    }

    const vaultParam = vault
      ? `0x${vault.identifierHex}`
      : constants.AddressZero

    return this._bridge.submitDepositSweepProof(
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
  txProofDifficultyFactor(): Promise<number> {
    return this._bridge.txProofDifficultyFactor()
  }
}
