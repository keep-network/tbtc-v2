import { BytesLike } from "@ethersproject/bytes"
import { BigNumber, BigNumberish } from "ethers"

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
    redeemerOutputScript: BytesLike
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

/**
 * Container for TBTC balance change during redemption test scenario.
 */
export interface RedemptionBalanceChange {
  beforeProof: BigNumber
  afterProof: BigNumber
}

/**
 * `MultiplePendingRequestedRedemptionsWithChange` test data represents a
 * redemption with the following properties:
 * - 5 redemption requests
 * - Redemption dust threshold is 1000000 satoshi
 * - Treasury fee for each request is 100000 satoshi
 * - Maximum transaction fee for each request is 1000 satoshi
 * - Total requested amount for all requests is 6934567 satoshi
 * - Total treasury fee for all requests is 500000 satoshi
 * - Total redeemable amount for all requests is 6434567 satoshi
 * - Maximum total transaction fee is 5000 satoshi
 */
export const MultiplePendingRequestedRedemptionsWithChange: RedemptionTestData =
  {
    wallet: {
      pubKeyHash: "0x7ac2d9378a1c47e589dfb8095ca95ed2140d2726",
      state: 1,
      pendingRedemptionsValue: 0,
    },

    redemptionRequests: [
      {
        redeemer: "0x7F62CddE8A86328d63B9517BC70B255017f25EEa",
        redeemerOutputScript:
          "0x1976a9142cd680318747b720d67bf4246eb7403b476adb3488ac", // P2PKH
        amount: 1000000, // Accepts outputs in range [900000, 899000]
      },
      {
        redeemer: "0x208fF63189DF8749780917Cb5901183075Dbabc1",
        redeemerOutputScript:
          "0x160014e6f9d74726b19b75f16fe1e9feaec048aa4fa1d0", // P2WPKH
        amount: 1200000, // Accepts outputs in range [1100000, 1099000]
      },
      {
        redeemer: "0x35D54bC29e0a5170c3Ac73E64c7fA539A867f0FE",
        redeemerOutputScript:
          "0x17a914011beb6fb8499e075a57027fb0a58384f2d3f78487", // P2SH
        amount: 2000000, // Accepts outputs in range [1900000, 1899000]
      },
      {
        redeemer: "0x462418b7495561bF2872A0786109A11f5d494aA2",
        redeemerOutputScript:
          "0x220020ef0b4d985752aa5ef6243e4c6f6bebc2a007e7d671ef27d4b1d0db8dcc93bc1c", // P2WSH
        amount: 1500000, // Accepts outputs in range [1400000, 1399000]
      },
      {
        redeemer: "0x2219eAC966FbC0454C4A2e122717e4429Dd7608F",
        redeemerOutputScript:
          "0x160014409b57c89a53654775acd91c981b88079357b859", // P2PKH
        amount: 1234567, // Accepts outputs in range [1134567, 1133567]
      },
    ],

    mainUtxo: {
      txHash:
        "0x089bd0671a4481c3584919b4b9b6751cb3f8586dab41cb157adec43fd10ccc00",
      txOutputIndex: 5,
      txOutputValue: 143565433,
    },

    // https://live.blockcypher.com/btc-testnet/tx/05dabb0291c0a6aa522de5ded5cb6d14ee2159e7ff109d3ef0f21de128b56b94
    redemptionTx: {
      hash: "0x946bb528e11df2f03e9d10ffe75921ee146dcbd5dee52d52aaa6c09102bbda05",
      version: "0x01000000",
      inputVector:
        "0x01089bd0671a4481c3584919b4b9b6751cb3f8586dab41cb157adec43fd10ccc" +
        "000500000000ffffffff",
      outputVector:
        "0x0680b80d00000000001976a9142cd680318747b720d67bf4246eb7403b476adb" +
        "3488acc0c5100000000000160014e6f9d74726b19b75f16fe1e9feaec048aa4fa1" +
        "d0c0fa1c000000000017a914011beb6fb8499e075a57027fb0a58384f2d3f78487" +
        "a059150000000000220020ef0b4d985752aa5ef6243e4c6f6bebc2a007e7d671ef" +
        "27d4b1d0db8dcc93bc1cc74c110000000000160014409b57c89a53654775acd91c" +
        "981b88079357b85972732c08000000001600147ac2d9378a1c47e589dfb8095ca9" +
        "5ed2140d2726",
      locktime: "0x00000000",
    },

    redemptionProof: {
      merkleProof:
        "0xb7b0a73b2881faf82b260dd5caee7ff9029dd21ee7954ba24a56a67c7b30a70c" +
        "20dcda19b54058448a427c6bf5c5fd4461dbace7f696bd86075b3638cb1c72c73f" +
        "3f1fbe47db0dc97dc7fbe31897f6b90029a2d34c6cbf5690ae1de9b6ff102f9140" +
        "a49dc08c454650297a2c8a60358aab4e81f52bc2fa1086ca29355c96940c",
      txIndexInBlock: 4,
      bitcoinHeaders:
        "0x0400002083e03e3c0c35fa762ece0064ccbb5c06e13d7aba7f07e303f1060000" +
        "0000000081b2e32fb8c258f68fd45fdd940ac23a03b86cb0e5e19c2fdb25229b77" +
        "70ac6d55720e6240b2321aeb12850604e0ff3fe631eefef3624c82ef84af1f3886" +
        "613c5a82c6523ab166b30a1000000000000038978553eace4776a2e57ff1443588" +
        "da6db64a656f99001925218aaf1b42f96e8e720e6240b2321a25c49ab704000020" +
        "8e3e4b82b0a7a6b170299ffbb7f4ffa59fe2882706bd7797f90400000000000058" +
        "fe1967710734d20a222b61a16884a27ce2f0c51638481b6ef4747061346647a672" +
        "0e6240b2321a2fffd42304e0ff2f5cb48be2329a7b7938506f3b4186784a89dac5" +
        "778565e7724e2e000000000000e97ecb1681efad3dae8ed580a23198f418bec19b" +
        "905637d9a77b546e1d6ff6f3ac720e6240b2321a505f792a04e0ff2fc27a057424" +
        "ddc6c5d0709b3c6c0e26cc0eb6b899eb788445bb1b000000000000d6f879319e59" +
        "1caf6498ddd884569f5669699716e684154bedd1ecb1c5ab55c0e4720e6240b232" +
        "1acdd9988904e0ff3fbc46c4f4e9351ec418b7f13dc1e542712efa97071f90ba5c" +
        "ee2e0000000000007805d109ea75113c91759d9d14ed26c0bff6fcb572dc0fdb63" +
        "8c862922ec2b9a05730e6240b2321ab9426ecc",
    },

    chainDifficulty: 330930,
  }
