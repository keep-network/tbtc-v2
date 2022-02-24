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
 * `SinglePendingRequestedRedemption` test data represents a redemption with
 *  the following properties:
 * - 1 redemption request
 * - Redemption dust threshold is 100000 satoshi
 * - Treasury fee for each request is 0% of the requested amount
 * - Maximum transaction fee for each request is 1000 satoshi
 * - Total requested amount for all requests is 1177424 satoshi
 * - Total treasury fee for all requests is 0 satoshi
 * - Total redeemable amount for all requests is 1177424 satoshi
 * - Maximum total transaction fee is 1000 satoshi
 */
export const SinglePendingRequestedRedemption: RedemptionTestData = {
  wallet: {
    pubKeyHash: "0x7ac2d9378a1c47e589dfb8095ca95ed2140d2726",
    state: 1,
    pendingRedemptionsValue: 0,
  },

  redemptionRequests: [
    {
      redeemer: "0x7F62CddE8A86328d63B9517BC70B255017f25EEa",
      redeemerOutputScript:
        // P2SH with address 2N5WZpig3vgpSdjSherS2Lv7GnPuxCvkQjT
        "0x17a91486884e6be1525dab5ae0b451bd2c72cee67dcf4187",
      amount: 1177424, // Accepts outputs in range [1176424, 1177424]
    },
  ],

  mainUtxo: {
    txHash:
      "0xb69a2869840aa6fdfd143136ff4514ca46ea2d876855040892ad74ab8c527422",
    txOutputIndex: 1,
    txOutputValue: 1177424,
  },

  // https://live.blockcypher.com/btc-testnet/tx/70d4182e795ebb0ddd8339ed9c0213d6e48f7cb6c956ced03c49f554a93a5669
  redemptionTx: {
    hash: "0x69563aa954f5493cd0ce56c9b67c8fe4d613029ced3983dd0dbb5e792e18d470",
    version: "0x01000000",
    inputVector:
      "0x01b69a2869840aa6fdfd143136ff4514ca46ea2d876855040892ad74ab8c527422" +
      "0100000000ffffffff",
    outputVector:
      "0x015cf511000000000017a91486884e6be1525dab5ae0b451bd2c72cee67dcf4187",
    locktime: "0x00000000",
  },

  redemptionProof: {
    merkleProof:
      "0xba19ac24192479ac72000fe4500ec87f7b8cf994e90f42c3e66e70f9decfd81aee" +
      "743b1c3a6935e4d157221fc36e6e24182ed94fc23f4f5268d51c9c7625acebc65c9b" +
      "4a0e8e4eb52a89852aeaa1f935058620ccff4ade5fb5e05524ae727dfcaa9004792a" +
      "281959ca2c8b6839135ee645353783f4c6c7d358acf3f4a83f819dec4effe91462dc" +
      "fbc0d0ed6b4cc38e5470eaf5b450481482d9201a4fd870f9ec81aa88378f3e2aab62" +
      "de93105ed1563a8b3fca7995f9828a9042639680d0e49488cb14eabe41276f4ed8f8" +
      "7527690fb7f83b3b9abb170e1aadac941b53c29ec09e85514a6844e864397ded279e" +
      "f4ace9833195f112cff129626f30a1bbc9b22f",
    txIndexInBlock: 33,
    bitcoinHeaders:
      "0x00000020f47db0755dc684d17088c20b5d0cfdd2a637c0c1d611616f9cd868b100" +
      "00000084349634f8489675c4ac31b82f66f3c6ea369f328e8dc08716d245a0a01bfa" +
      "ba1a161662ffff001dab708bb90000002031b92d92aa302ad2a73058eaaa09ebfad1" +
      "4be89cae782709e197b352000000009e5528a66f13a86be6f61937d478d696c9cae9" +
      "ebce6649bf80b0b0be070f3cb1e51a1662ffff001d55d83989",
  },

  chainDifficulty: 1,
}

/**
 * `MultiplePendingRequestedRedemptionsWithChange` test data represents a
 * redemption with the following properties:
 * - 5 redemption requests
 * - Redemption dust threshold is 100000 satoshi
 * - Treasury fee for each request is 0.05% of the requested amount
 * - Maximum transaction fee for each request is 1000 satoshi
 * - Total requested amount for all requests is 6435567 satoshi
 * - Total treasury fee for all requests is 3217 satoshi
 * - Total redeemable amount for all requests is 6432350 satoshi
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
          // P2PKH with address mjc2zGWypwpNyDi4ZxGbBNnUA84bfgiwYc
          "0x1976a9142cd680318747b720d67bf4246eb7403b476adb3488ac",
        amount: 900000, // Accepts outputs in range [898550, 899550]
      },
      {
        redeemer: "0x208fF63189DF8749780917Cb5901183075Dbabc1",
        redeemerOutputScript:
          // P2WPKH with address tb1qumuaw3exkxdhtut0u85latkqfz4ylgwstkdzsx
          "0x160014e6f9d74726b19b75f16fe1e9feaec048aa4fa1d0",
        amount: 1100000, // Accepts outputs in range [1098450, 1099450]
      },
      {
        redeemer: "0x35D54bC29e0a5170c3Ac73E64c7fA539A867f0FE",
        redeemerOutputScript:
          // P2SH with address 2MsM67NLa71fHvTUBqNENW15P68nHB2vVXb
          "0x17a914011beb6fb8499e075a57027fb0a58384f2d3f78487",
        amount: 1901000, // Accepts outputs in range [1899050, 1900050]
      },
      {
        redeemer: "0x462418b7495561bF2872A0786109A11f5d494aA2",
        redeemerOutputScript:
          // P2WSH with address tb1qau95mxzh2249aa3y8exx76ltc2sq0e7kw8hj04936rdcmnynhswqqz02vv
          "0x220020ef0b4d985752aa5ef6243e4c6f6bebc2a007e7d671ef27d4b1d0db8dcc93bc1c",
        amount: 1400000, // Accepts outputs in range [1398300, 1399300]
      },
      {
        redeemer: "0x2219eAC966FbC0454C4A2e122717e4429Dd7608F",
        redeemerOutputScript:
          // P2PKH with address tb1qgzd40jy62dj5wadvmywfsxugq7f40wzek3p2g2
          "0x160014409b57c89a53654775acd91c981b88079357b859",
        amount: 1134567, // Accepts outputs in range [1133000, 1134000]
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
