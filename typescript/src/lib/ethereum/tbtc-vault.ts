import { TBTCVault as ContractTBTCVault } from "../../../typechain/TBTCVault"
import {
  GetEvents,
  TBTCVault as ChainTBTCVault,
  OptimisticMintingCancelledEvent,
  OptimisticMintingFinalizedEvent,
  OptimisticMintingRequest,
  OptimisticMintingRequestedEvent,
} from "../contracts"
import { BigNumber, ContractTransaction } from "ethers"
import { BitcoinTxHash } from "../bitcoin"
import { backoffRetrier, Hex } from "../utils"
import TBTCVaultDeployment from "@keep-network/tbtc-v2/artifacts/TBTCVault.json"
import {
  ContractConfig,
  EthereumContract,
  sendWithRetry,
} from "./contract-handle"
import { Address } from "./address"
import { Bridge } from "./bridge"

type ContractOptimisticMintingRequest = {
  requestedAt: BigNumber
  finalizedAt: BigNumber
}

/**
 * Implementation of the Ethereum TBTCVault handle.
 */
export class TBTCVault
  extends EthereumContract<ContractTBTCVault>
  implements ChainTBTCVault
{
  constructor(config: ContractConfig) {
    super(config, TBTCVaultDeployment)
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {ChainTBTCVault#optimisticMintingDelay}
   */
  async optimisticMintingDelay(): Promise<number> {
    const delaySeconds = await backoffRetrier<number>(this._totalRetryAttempts)(
      async () => {
        return await this._instance.optimisticMintingDelay()
      }
    )

    return BigNumber.from(delaySeconds).toNumber()
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {ChainTBTCVault#getMinters}
   */
  async getMinters(): Promise<Address[]> {
    const minters: string[] = await backoffRetrier<string[]>(
      this._totalRetryAttempts
    )(async () => {
      return await this._instance.getMinters()
    })

    return minters.map(Address.from)
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {ChainTBTCVault#isMinter}
   */
  async isMinter(address: Address): Promise<boolean> {
    return await backoffRetrier<boolean>(this._totalRetryAttempts)(async () => {
      return await this._instance.isMinter(`0x${address.identifierHex}`)
    })
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {ChainTBTCVault#isGuardian}
   */
  async isGuardian(address: Address): Promise<boolean> {
    return await backoffRetrier<boolean>(this._totalRetryAttempts)(async () => {
      return await this._instance.isGuardian(`0x${address.identifierHex}`)
    })
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {ChainTBTCVault#requestOptimisticMint}
   */
  async requestOptimisticMint(
    depositTxHash: BitcoinTxHash,
    depositOutputIndex: number
  ): Promise<Hex> {
    const tx = await sendWithRetry<ContractTransaction>(
      async () => {
        return await this._instance.requestOptimisticMint(
          depositTxHash.reverse().toPrefixedString(),
          depositOutputIndex
        )
      },
      this._totalRetryAttempts,
      undefined,
      [
        "Optimistic minting already requested for the deposit",
        "The deposit is already swept",
      ]
    )

    return Hex.from(tx.hash)
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {ChainTBTCVault#cancelOptimisticMint}
   */
  async cancelOptimisticMint(
    depositTxHash: BitcoinTxHash,
    depositOutputIndex: number
  ): Promise<Hex> {
    const tx = await sendWithRetry<ContractTransaction>(
      async () => {
        return await this._instance.cancelOptimisticMint(
          depositTxHash.reverse().toPrefixedString(),
          depositOutputIndex
        )
      },
      this._totalRetryAttempts,
      undefined,
      ["Optimistic minting already finalized for the deposit"]
    )

    return Hex.from(tx.hash)
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {ChainTBTCVault#finalizeOptimisticMint}
   */
  async finalizeOptimisticMint(
    depositTxHash: BitcoinTxHash,
    depositOutputIndex: number
  ): Promise<Hex> {
    const tx = await sendWithRetry<ContractTransaction>(
      async () => {
        return await this._instance.finalizeOptimisticMint(
          depositTxHash.reverse().toPrefixedString(),
          depositOutputIndex
        )
      },
      this._totalRetryAttempts,
      undefined,
      [
        "Optimistic minting already finalized for the deposit",
        "The deposit is already swept",
      ]
    )

    return Hex.from(tx.hash)
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {ChainTBTCVault#optimisticMintingRequests}
   */
  async optimisticMintingRequests(
    depositTxHash: BitcoinTxHash,
    depositOutputIndex: number
  ): Promise<OptimisticMintingRequest> {
    const depositKey = Bridge.buildDepositKey(depositTxHash, depositOutputIndex)

    const request: ContractOptimisticMintingRequest =
      await backoffRetrier<ContractOptimisticMintingRequest>(
        this._totalRetryAttempts
      )(async () => {
        return await this._instance.optimisticMintingRequests(depositKey)
      })
    return this.parseOptimisticMintingRequest(request)
  }

  /**
   * Parses a optimistic minting request using data fetched from the on-chain contract.
   * @param request Data of the optimistic minting request.
   * @returns Parsed optimistic minting request.
   */
  private parseOptimisticMintingRequest(
    request: ContractOptimisticMintingRequest
  ): OptimisticMintingRequest {
    return {
      requestedAt: BigNumber.from(request.requestedAt).toNumber(),
      finalizedAt: BigNumber.from(request.finalizedAt).toNumber(),
    }
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {ChainBridge#getOptimisticMintingRequestedEvents}
   */
  async getOptimisticMintingRequestedEvents(
    options?: GetEvents.Options,
    ...filterArgs: Array<any>
  ): Promise<OptimisticMintingRequestedEvent[]> {
    const events = await this.getEvents(
      "OptimisticMintingRequested",
      options,
      ...filterArgs
    )

    return events.map<OptimisticMintingRequestedEvent>((event) => {
      return {
        blockNumber: BigNumber.from(event.blockNumber).toNumber(),
        blockHash: Hex.from(event.blockHash),
        transactionHash: Hex.from(event.transactionHash),
        minter: new Address(event.args!.minter),
        depositKey: Hex.from(
          BigNumber.from(event.args!.depositKey).toHexString()
        ),
        depositor: new Address(event.args!.depositor),
        amount: BigNumber.from(event.args!.amount),
        fundingTxHash: BitcoinTxHash.from(event.args!.fundingTxHash).reverse(),
        fundingOutputIndex: BigNumber.from(
          event.args!.fundingOutputIndex
        ).toNumber(),
      }
    })
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {ChainBridge#getOptimisticMintingCancelledEvents}
   */
  async getOptimisticMintingCancelledEvents(
    options?: GetEvents.Options,
    ...filterArgs: Array<any>
  ): Promise<OptimisticMintingCancelledEvent[]> {
    const events = await this.getEvents(
      "OptimisticMintingCancelled",
      options,
      ...filterArgs
    )

    return events.map<OptimisticMintingCancelledEvent>((event) => {
      return {
        blockNumber: BigNumber.from(event.blockNumber).toNumber(),
        blockHash: Hex.from(event.blockHash),
        transactionHash: Hex.from(event.transactionHash),
        guardian: new Address(event.args!.guardian),
        depositKey: Hex.from(
          BigNumber.from(event.args!.depositKey).toHexString()
        ),
      }
    })
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {ChainBridge#getOptimisticMintingFinalizedEvents}
   */
  async getOptimisticMintingFinalizedEvents(
    options?: GetEvents.Options,
    ...filterArgs: Array<any>
  ): Promise<OptimisticMintingFinalizedEvent[]> {
    const events = await this.getEvents(
      "OptimisticMintingFinalized",
      options,
      ...filterArgs
    )

    return events.map<OptimisticMintingFinalizedEvent>((event) => {
      return {
        blockNumber: BigNumber.from(event.blockNumber).toNumber(),
        blockHash: Hex.from(event.blockHash),
        transactionHash: Hex.from(event.transactionHash),
        minter: new Address(event.args!.minter),
        depositKey: Hex.from(
          BigNumber.from(event.args!.depositKey).toHexString()
        ),
        depositor: new Address(event.args!.depositor),
        optimisticMintingDebt: BigNumber.from(
          event.args!.optimisticMintingDebt
        ),
      }
    })
  }
}
