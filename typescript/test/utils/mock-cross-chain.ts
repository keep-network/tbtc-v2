import {
  ChainIdentifier,
  DestinationChainTBTCToken,
  L1BitcoinDepositor,
  BitcoinDepositor,
  CrossChainExtraDataEncoder,
  BitcoinRawTxVectors,
  DepositReceipt,
  Hex,
  DepositState,
  DestinationChainName,
} from "../../src"
import { BigNumber } from "ethers"

export class MockL2TBTCToken implements DestinationChainTBTCToken {
  balanceOf(identifier: ChainIdentifier): Promise<BigNumber> {
    throw new Error("Not supported")
  }

  getChainIdentifier(): ChainIdentifier {
    throw new Error("Not supported")
  }
}

export class MockL2BitcoinDepositor implements BitcoinDepositor {
  readonly #chainIdentifier: ChainIdentifier
  readonly #encoder: CrossChainExtraDataEncoder
  #depositOwner: ChainIdentifier | undefined
  public readonly initializeDepositCalls: InitializeDepositCall[] = []

  constructor(
    chainIdentifier: ChainIdentifier,
    encoder: CrossChainExtraDataEncoder
  ) {
    this.#chainIdentifier = chainIdentifier
    this.#encoder = encoder
  }

  extraDataEncoder(): CrossChainExtraDataEncoder {
    return this.#encoder
  }

  getChainIdentifier(): ChainIdentifier {
    return this.#chainIdentifier
  }

  getDepositOwner(): ChainIdentifier | undefined {
    return this.#depositOwner
  }

  setDepositOwner(depositOwner: ChainIdentifier): void {
    this.#depositOwner = depositOwner
  }

  initializeDeposit(
    depositTx: BitcoinRawTxVectors,
    depositOutputIndex: number,
    deposit: DepositReceipt,
    vault?: ChainIdentifier
  ): Promise<Hex> {
    this.initializeDepositCalls.push({
      depositTx,
      depositOutputIndex,
      deposit,
      vault,
    })

    return Promise.resolve(Hex.from("0x02"))
  }
}

export class MockL1BitcoinDepositor implements L1BitcoinDepositor {
  readonly #chainIdentifier: ChainIdentifier
  readonly #encoder: CrossChainExtraDataEncoder
  public readonly initializeDepositCalls: InitializeDepositCall[] = []

  constructor(
    chainIdentifier: ChainIdentifier,
    encoder: CrossChainExtraDataEncoder
  ) {
    this.#chainIdentifier = chainIdentifier
    this.#encoder = encoder
  }

  getDepositOwner(): ChainIdentifier | undefined {
    throw new Error("Not supported")
  }

  setDepositOwner(depositOwner: ChainIdentifier | undefined): void {
    throw new Error("Not supported")
  }

  getDepositState(depositId: string): Promise<DepositState> {
    throw new Error("Not supported")
  }

  extraDataEncoder(): CrossChainExtraDataEncoder {
    return this.#encoder
  }

  getChainIdentifier(): ChainIdentifier {
    return this.#chainIdentifier
  }

  initializeDeposit(
    depositTx: BitcoinRawTxVectors,
    depositOutputIndex: number,
    deposit: DepositReceipt,
    vault?: ChainIdentifier
  ): Promise<Hex> {
    this.initializeDepositCalls.push({
      depositTx,
      depositOutputIndex,
      deposit,
      vault,
    })

    return Promise.resolve(Hex.from("0x01"))
  }
}

export class MockCrossChainExtraDataEncoder extends CrossChainExtraDataEncoder {
  #encodings: Map<string, Hex> = new Map()

  constructor(destinationChainName: DestinationChainName = "Base") {
    super(destinationChainName)
  }

  setEncoding(depositOwner: ChainIdentifier, extraData: Hex): void {
    this.#encodings.set(depositOwner.identifierHex, extraData)
  }

  override encodeDepositOwner(depositOwner: ChainIdentifier): Hex {
    const extraData = this.#encodings.get(depositOwner.identifierHex)
    if (!extraData) {
      throw new Error("Encoding not found for mock")
    }
    return extraData
  }

  override decodeDepositOwner(data: Hex): ChainIdentifier {
    console.warn(
      "MockCrossChainExtraDataEncoder.decodeDepositOwner called with:",
      data
    )
    throw new Error("decodeDepositOwner is not implemented in mock")
  }
}

type InitializeDepositCall = {
  depositTx: BitcoinRawTxVectors
  depositOutputIndex: number
  deposit: DepositReceipt
  vault?: ChainIdentifier
}
