import {
  ChainIdentifier,
  CrossChainContracts,
  CrossChainExtraDataEncoder,
  DepositorProxy,
  DepositReceipt,
} from "../../lib/contracts"
import { BitcoinRawTxVectors } from "../../lib/bitcoin"
import { Hex } from "../../lib/utils"

/**
 * Mode of operation for the cross-chain depositor proxy:
 * - [L2Transaction]: The proxy will reveal the deposit using a transaction on
 *   the L2 chain. The tBTC system is responsible for relaying the deposit to
 *   the tBTC L1 chain.
 * - [L1Transaction]: The proxy will directly reveal the deposit using a
 *   transaction on the tBTC L1 chain.
 */
export type CrossChainDepositorMode = "L2Transaction" | "L1Transaction"

/**
 * Implementation of the cross chain depositor proxy. This component is used to
 * reveal cross-chain deposits whose target chain is not the same as the L1
 * chain the tBTC system is deployed on.
 * @see {DepositorProxy} for reference.
 */
export class CrossChainDepositor implements DepositorProxy {
  readonly #crossChainContracts: CrossChainContracts
  readonly #revealMode: CrossChainDepositorMode

  constructor(
    crossChainContracts: CrossChainContracts,
    revealMode: CrossChainDepositorMode = "L2Transaction"
  ) {
    this.#crossChainContracts = crossChainContracts
    this.#revealMode = revealMode
  }

  /**
   * @returns The chain-specific identifier of the contract that will be
   *          used as the actual L1 depositor embedded in the deposit script.
   *          In this case, the depositor must be the L1BitcoinDepositor contract
   *          corresponding to the given L2 chain the deposit is targeting.
   *          This is because the L1BitcoinDepositor contract reveals the deposit to
   *          the Bridge contract (on L1) and transfers minted TBTC token to the
   *          target L2 chain once the deposit is processed.
   * @see {DepositorProxy#getChainIdentifier}
   */
  getChainIdentifier(): ChainIdentifier {
    return this.#crossChainContracts.l1BitcoinDepositor.getChainIdentifier()
  }

  /**
   * @returns Extra data for the cross-chain deposit script. Actually, this is
   *          the L2 deposit owner identifier took from the L2BitcoinDepositor
   *          contract.
   * @throws Throws if the L2 deposit owner cannot be resolved. This
   *         typically happens if the L2BitcoinDepositor operates with
   *         a read-only signer whose address cannot be resolved.
   */
  extraData(): Hex {
    const depositOwner =
      this.#crossChainContracts.l2BitcoinDepositor.getDepositOwner()

    if (!depositOwner) {
      throw new Error("Cannot resolve L2 deposit owner")
    }

    return this.#extraDataEncoder().encodeDepositOwner(depositOwner)
  }

  #extraDataEncoder(): CrossChainExtraDataEncoder {
    switch (this.#revealMode) {
      case "L2Transaction":
        return this.#crossChainContracts.l2BitcoinDepositor.extraDataEncoder()
      case "L1Transaction":
        return this.#crossChainContracts.l1BitcoinDepositor.extraDataEncoder()
    }
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * Reveals the given deposit depending on the reveal mode.
   * @see {CrossChainDepositorMode} for reveal modes description.
   * @see {DepositorProxy#revealDeposit}
   */
  revealDeposit(
    depositTx: BitcoinRawTxVectors,
    depositOutputIndex: number,
    deposit: DepositReceipt,
    vault?: ChainIdentifier
  ): Promise<Hex> {
    switch (this.#revealMode) {
      case "L2Transaction":
        return this.#crossChainContracts.l2BitcoinDepositor.initializeDeposit(
          depositTx,
          depositOutputIndex,
          deposit,
          vault
        )
      case "L1Transaction":
        return this.#crossChainContracts.l1BitcoinDepositor.initializeDeposit(
          depositTx,
          depositOutputIndex,
          deposit,
          vault
        )
    }
  }
}
