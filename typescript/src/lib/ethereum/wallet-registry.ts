import { WalletRegistry as WalletRegistryTypechain } from "../../../typechain/WalletRegistry"
import {
  GetChainEvents,
  WalletRegistry,
  DkgResultApprovedEvent,
  DkgResultChallengedEvent,
  DkgResultSubmittedEvent,
} from "../contracts"
import { backoffRetrier, Hex } from "../utils"
import { Event as EthersEvent } from "@ethersproject/contracts"
import { BigNumber } from "ethers"
import WalletRegistryDeployment from "@keep-network/ecdsa/artifacts/WalletRegistry.json"
import { EthersContractConfig, EthersContractHandle } from "./adapter"
import { EthereumAddress } from "./address"

/**
 * Implementation of the Ethereum WalletRegistry handle.
 * @see {WalletRegistry} for reference.
 */
export class EthereumWalletRegistry
  extends EthersContractHandle<WalletRegistryTypechain>
  implements WalletRegistry
{
  constructor(config: EthersContractConfig) {
    super(config, WalletRegistryDeployment)
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {WalletRegistry#getWalletPublicKey}
   */
  async getWalletPublicKey(walletID: Hex): Promise<Hex> {
    const publicKey = await backoffRetrier<string>(this._totalRetryAttempts)(
      async () => {
        return await this._instance.getWalletPublicKey(
          walletID.toPrefixedString()
        )
      }
    )
    return Hex.from(publicKey.substring(2))
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {WalletRegistry#getDkgResultSubmittedEvents}
   */
  async getDkgResultSubmittedEvents(
    options?: GetChainEvents.Options,
    ...filterArgs: Array<unknown>
  ): Promise<DkgResultSubmittedEvent[]> {
    const events: EthersEvent[] = await this.getEvents(
      "DkgResultSubmitted",
      options,
      ...filterArgs
    )

    return events.map<DkgResultSubmittedEvent>((event) => {
      return {
        blockNumber: BigNumber.from(event.blockNumber).toNumber(),
        blockHash: Hex.from(event.blockHash),
        transactionHash: Hex.from(event.transactionHash),
        resultHash: Hex.from(event.args!.resultHash),
        seed: Hex.from(BigNumber.from(event.args!.seed).toHexString()),
        result: {
          submitterMemberIndex: BigNumber.from(
            event.args!.result.submitterMemberIndex
          ),
          groupPubKey: Hex.from(event.args!.result.groupPubKey),
          misbehavedMembersIndices:
            event.args!.result.misbehavedMembersIndices.map((mmi: unknown) =>
              BigNumber.from(mmi).toNumber()
            ),
          signatures: Hex.from(event.args!.result.signatures),
          signingMembersIndices: event.args!.result.signingMembersIndices.map(
            BigNumber.from
          ),
          members: event.args!.result.members.map((m: unknown) =>
            BigNumber.from(m).toNumber()
          ),
          membersHash: Hex.from(event.args!.result.membersHash),
        },
      }
    })
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {WalletRegistry#getDkgResultApprovedEvents}
   */
  async getDkgResultApprovedEvents(
    options?: GetChainEvents.Options,
    ...filterArgs: Array<unknown>
  ): Promise<DkgResultApprovedEvent[]> {
    const events: EthersEvent[] = await this.getEvents(
      "DkgResultApproved",
      options,
      ...filterArgs
    )

    return events.map<DkgResultApprovedEvent>((event) => {
      return {
        blockNumber: BigNumber.from(event.blockNumber).toNumber(),
        blockHash: Hex.from(event.blockHash),
        transactionHash: Hex.from(event.transactionHash),
        resultHash: Hex.from(event.args!.resultHash),
        approver: EthereumAddress.from(event.args!.approver),
      }
    })
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {WalletRegistry#getDkgResultChallengedEvents}
   */
  async getDkgResultChallengedEvents(
    options?: GetChainEvents.Options,
    ...filterArgs: Array<unknown>
  ): Promise<DkgResultChallengedEvent[]> {
    const events: EthersEvent[] = await this.getEvents(
      "DkgResultChallenged",
      options,
      ...filterArgs
    )

    return events.map<DkgResultChallengedEvent>((event) => {
      return {
        blockNumber: BigNumber.from(event.blockNumber).toNumber(),
        blockHash: Hex.from(event.blockHash),
        transactionHash: Hex.from(event.transactionHash),
        resultHash: Hex.from(event.args!.resultHash),
        challenger: EthereumAddress.from(event.args!.challenger),
        reason: event.args!.reason,
      }
    })
  }
}
