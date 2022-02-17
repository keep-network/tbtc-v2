import { BytesLike } from "@ethersproject/bytes"
import { BigNumberish } from "ethers"

/**
 * Represents a set of data used for given redemption scenario.
 */
export interface RedemptionTestData {
  /**
   * Wallet that makes the redemption transaction.
   */
  wallet: {
    pubKeyHash: BytesLike
    state: BigNumberish
    pendingRedemptionsValue: BigNumberish
  }

  /**
   * Redemption requests that are handled by the redemption transaction.
   */
  redemptionRequests: {
    redeemer: string
    redeemerOutputHash: BytesLike
    amount: BigNumberish
  }[]

  /**
   * Main UTXO data which are used as `mainUtxo` parameter during
   * `submitRedemptionProof` function call. Main UTXO must exist for given
   * wallet in order to make the redemption proof possible
   */
  mainUtxo: {
    txHash: BytesLike
    txOutputIndex: number
    txOutputValue: BigNumberish
  }

  /**
   * Redemption transaction data passed as `redemptionTx` parameter during
   * `submitRedemptionProof`function call.
   */
  redemptionTx: {
    hash: BytesLike
    version: BytesLike
    inputVector: BytesLike
    outputVector: BytesLike
    locktime: BytesLike
  }

  /**
   * Redemption proof data passed as `redemptionProof` parameter during
   * `submitRedemptionProof` function call.
   */
  redemptionProof: {
    merkleProof: BytesLike
    txIndexInBlock: BigNumberish
    bitcoinHeaders: BytesLike
  }

  /**
   * Chain difficulty which was in force at the moment of Bitcoin transaction
   * execution. It is used to mock the difficulty provided by `Relay` contract
   * with a correct value thus making proof validation possible.
   */
  chainDifficulty: number
}

// TODO: Prepare data and docs.
export const MultiplePendingRequestedRedemptionsWithChange: RedemptionTestData =
  {
    wallet: {
      pubKeyHash: "0x",
      state: 1,
      pendingRedemptionsValue: 0,
    },

    redemptionRequests: [
      {
        redeemer: "0x",
        redeemerOutputHash: "0x",
        amount: 0,
      },
    ],

    mainUtxo: {
      txHash: "0x",
      txOutputIndex: 0,
      txOutputValue: 0,
    },

    redemptionTx: {
      hash: "0x",
      version: "0x",
      inputVector: "0x",
      outputVector: "0x",
      locktime: "0x",
    },

    redemptionProof: {
      merkleProof: "0x",
      txIndexInBlock: 0,
      bitcoinHeaders: "0x",
    },

    chainDifficulty: 0,
  }
