import { BigNumberish, BytesLike } from "ethers"
import { walletState } from "../fixtures"

/**
 * Represents a set of data used for given moving funds scenario.
 */
export interface MovingFundsTestData {
  /**
   * Wallet that makes the moving funds transaction.
   */
  wallet: {
    ecdsaWalletID: BytesLike
    pubKeyHash: BytesLike
    state: BigNumberish
  }

  /**
   * List of 20-byte public key hashes of target wallets.
   */
  targetWalletsCommitment: BytesLike[]

  /**
   * Main UTXO data which are used as `mainUtxo` parameter during
   * `submitMovingFundsProof` function call. Main UTXO must exist for given
   * wallet in order to make the moving funds proof possible
   */
  mainUtxo: {
    txHash: BytesLike
    txOutputIndex: number
    txOutputValue: BigNumberish
  }

  /**
   * Moving funds transaction data passed as `movingFundsTx` parameter during
   * `submitMovingFundsProof`function call.
   */
  movingFundsTx: {
    hash: BytesLike
    version: BytesLike
    inputVector: BytesLike
    outputVector: BytesLike
    locktime: BytesLike
  }

  /**
   * Moving funds proof data passed as `movingFundsProof` parameter during
   * `submitMovingFundsProof` function call.
   */
  movingFundsProof: {
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
 * `SingleTargetWallet` test data represents a moving funds with the
 * following properties:
 * - 1 main UTXO input
 * - 1 P2PKH output that matches the target wallet from the commitment
 * - 6+ on-chain confirmations of the sweep transaction
 */
export const SingleTargetWallet: MovingFundsTestData = {
  wallet: {
    // Uncompressed public key for the pubKeyHash `0x7ac2d9378a1c47e589dfb8095ca95ed2140d2726`:
    //    04ee067a0273f2e3ba88d23140a24fdb290f27bbcd0f94117a9c65be3911c5c04efc314aa6ecfea6a43232df446014c41fd7446fe9deed7c2b054f7ea36e396306
    // X: ee067a0273f2e3ba88d23140a24fdb290f27bbcd0f94117a9c65be3911c5c04e
    // Y: fc314aa6ecfea6a43232df446014c41fd7446fe9deed7c2b054f7ea36e396306
    // ecdsaWalletID = keccak256(XY)
    ecdsaWalletID:
      "0x4ad6b3ccbca81645865d8d0d575797a15528e98ced22f29a6f906d3259569863",
    pubKeyHash: "0x7ac2d9378a1c47e589dfb8095ca95ed2140d2726",
    state: walletState.MovingFunds,
  },

  targetWalletsCommitment: ["0x2cd680318747b720d67bf4246eb7403b476adb34"],

  mainUtxo: {
    txHash:
      "0xf8e3d585b2b9b7033e1c37ffca2e3bcc4bbc2c3a64527641f58d872213e5c189",
    txOutputIndex: 1,
    txOutputValue: 1473114,
  },

  // https://live.blockcypher.com/btc-testnet/tx/d078c00d7e78509062fccdecaf85580efe6e2826d8db77341fbc1097ca2955e5
  movingFundsTx: {
    hash: "0xe55529ca9710bc1f3477dbd826286efe0e5885afeccdfc629050787e0dc078d0",
    version: "0x01000000",
    inputVector:
      "0x01f8e3d585b2b9b7033e1c37ffca2e3bcc4bbc2c3a64527641f58d872213e5c189" +
      "0100000000ffffffff",
    outputVector:
      "0x0132571600000000001976a9142cd680318747b720d67bf4246eb7403b476adb34" +
      "88ac",
    locktime: "0x00000000",
  },

  movingFundsProof: {
    merkleProof:
      "0x05ad8fc3f78f756b9b40b72a0eae0c342712193637a8b620d7ae7a4e9898fcd531" +
      "e112414e373eaab60bccf7056cb5508a7a8c981bdc72d05cf3a66b933495c2dc8c20" +
      "b2727e64a216d9c3ede995713f4793b047c048ea38872428f3196e4697a61927e6ec" +
      "044b52e82b32bb1835da47e43b78971f79c61d73821f1cff269f33",
    txIndexInBlock: 1,
    bitcoinHeaders:
      "0x0000602099a892d7a02680a002a55f1da71a5d11866fbd2a8f57e96d3d00000000" +
      "0000009918c5f3417fecf62a9bbc13c4798cdb89e6964af94bd43e78933b9e8c2b9d" +
      "ba17f14e621ec8001a855f095804e00020f10609d9fa1132718327e2bbc0e7ab605d" +
      "3431b27f9c2aa60900000000000000f7aca0f56853ed95f31cc2b3316ce45f1cf7fd" +
      "fdec83564c2cb32278f606753f6ef14e621ec8001ab366ee0a04200020cd4cfc17f9" +
      "0a5301a51da10d10d5f627644883fb65d399652b000000000000007b4bcb4c4d17ed" +
      "f9e5e07c9eb35bf74d7b0dde10e639581754cd8b4afacc220fd3f34e621ec8001a08" +
      "d65ede0000e02030fa568bb77672ce00aa73190b6394f2473e105bacc1edcba30000" +
      "00000000001f61df51e500a4df9b322da069d162fd473bb97ae4999febe7c759b39d" +
      "7779cabcf54e621ec8001a6cee453b000000209ea8ceb25fa3854fc8948255f6d47f" +
      "7c820c5702861ee7e78100000000000000f44e0f8793c2d503817ecc991f1a836e24" +
      "9763ab42936ba98703efde31fedf0518f64e621ec8001a2eb8274d00e0ff3f45dd51" +
      "143f07e88060db80fa4a92e53e8103c138b36b843879000000000000004bbfaeffde" +
      "81470807f3c9a346479172bf02e4ea62d2f51e0c53163737488dc296f64e621ec800" +
      "1a72dc0b16",
  },

  chainDifficulty: 21461933,
}

/**
 * `MultipleTargetWalletsAndIndivisibleAmount` test data represents a moving
 * funds with the following properties:
 * - 1 main UTXO input
 * - 2 P2PKH and 1 P2WPKH outputs that matches the target wallets from
 *   the commitment
 * - The total transacted amount is not divisible by 3 so one wallet obtains
 *   the remainder
 * - 6+ on-chain confirmations of the sweep transaction
 */
export const MultipleTargetWalletsAndIndivisibleAmount = {
  wallet: {
    // Uncompressed public key for the pubKeyHash `0x7ac2d9378a1c47e589dfb8095ca95ed2140d2726`:
    //    04ee067a0273f2e3ba88d23140a24fdb290f27bbcd0f94117a9c65be3911c5c04efc314aa6ecfea6a43232df446014c41fd7446fe9deed7c2b054f7ea36e396306
    // X: ee067a0273f2e3ba88d23140a24fdb290f27bbcd0f94117a9c65be3911c5c04e
    // Y: fc314aa6ecfea6a43232df446014c41fd7446fe9deed7c2b054f7ea36e396306
    // ecdsaWalletID = keccak256(XY)
    ecdsaWalletID:
      "0x4ad6b3ccbca81645865d8d0d575797a15528e98ced22f29a6f906d3259569863",
    pubKeyHash: "0x7ac2d9378a1c47e589dfb8095ca95ed2140d2726",
    state: walletState.MovingFunds,
  },

  targetWalletsCommitment: [
    "0x2cd680318747b720d67bf4246eb7403b476adb34",
    "0x8900de8fc6e4cd1db4c7ab0759d28503b4cb0ab1",
    "0xaf7a841e055fc19bf31acf4cbed5ef548a2cc453",
  ],

  mainUtxo: {
    txHash:
      "0x80653f6e07dabddae14cf08d45475388343763100e4548914d811f373465a42e",
    txOutputIndex: 1,
    txOutputValue: 1795453,
  },

  // https://live.blockcypher.com/btc-testnet/tx/e6218018ed1874e73b78e16a8cf4f5016cbc666a3f9179557a84083e3e66ff7c
  movingFundsTx: {
    hash: "0x7cff663e3e08847a5579913f6a66bc6c01f5f48c6ae1783be77418ed188021e6",
    version: "0x01000000",
    inputVector:
      "0x0180653f6e07dabddae14cf08d45475388343763100e4548914d811f373465a42e" +
      "0100000000ffffffff",
    outputVector:
      "0x031c160900000000001976a9142cd680318747b720d67bf4246eb7403b476adb34" +
      "88ac1d160900000000001600148900de8fc6e4cd1db4c7ab0759d28503b4cb0ab11c" +
      "160900000000001976a914af7a841e055fc19bf31acf4cbed5ef548a2cc45388ac",
    locktime: "0x00000000",
  },

  movingFundsProof: {
    merkleProof:
      "0x4880d00e942d1e54b9281b138ebe684d82067bd3cc55fbb54a4fe5f441f387b370" +
      "029b1360cd2fff4bd5ce292e35ab1650ee349017a25c6c5c47adfb59a41a6d707207" +
      "bebf7f0449f03b9c068ac503030f77a12b780806567c16c8f7082c85f9c2217e059c" +
      "48d928ee7c0ba8ee7c990e0fbf901826a41e33be7f3285073b00e8002facdc932c69" +
      "016325366f73981195c32096c3a35639cd995779eeeecb2ede16dc684bd43380af42" +
      "f7d20e352ff647a80f628bdeed12c9c229de6c8359c6ef44d02180f40038258359fa" +
      "c75124826493e35533c6a930a1bc7b1f78d40cdd65",
    txIndexInBlock: 14,
    bitcoinHeaders:
      "0x04200020cd4cfc17f90a5301a51da10d10d5f627644883fb65d399652b00000000" +
      "0000007b4bcb4c4d17edf9e5e07c9eb35bf74d7b0dde10e639581754cd8b4afacc22" +
      "0fd3f34e621ec8001a08d65ede0000e02030fa568bb77672ce00aa73190b6394f247" +
      "3e105bacc1edcba3000000000000001f61df51e500a4df9b322da069d162fd473bb9" +
      "7ae4999febe7c759b39d7779cabcf54e621ec8001a6cee453b000000209ea8ceb25f" +
      "a3854fc8948255f6d47f7c820c5702861ee7e78100000000000000f44e0f8793c2d5" +
      "03817ecc991f1a836e249763ab42936ba98703efde31fedf0518f64e621ec8001a2e" +
      "b8274d00e0ff3f45dd51143f07e88060db80fa4a92e53e8103c138b36b8438790000" +
      "00000000004bbfaeffde81470807f3c9a346479172bf02e4ea62d2f51e0c53163737" +
      "488dc296f64e621ec8001a72dc0b16000000205442a6fc93ed4586bd29360d359c82" +
      "4d1edae51ba1fccb2b2600000000000000853aa96dab6e2e2049b27f0e47157b84b9" +
      "b28e451550cf257b7f929db049686906f74e621ec8001a36e620b104200020e0a49a" +
      "c7a66b57a3a3d6c179ec95ecc62779fe8d9e50115196000000000000005b3438c4f0" +
      "1b35a067f30d26d2ef1c4c5f1d7245e1146402fcba2d0ee9ac9a181af84e621ec800" +
      "1a827753500000c020134645f88ef4c28e11dc8c9cb29eb4a679b9793d6c3b75c4a3" +
      "00000000000000753631af53921164be60b8aee0eb1d76c706ea9bb9cf4f53b8cb65" +
      "830a3e982732f84e621ec8001a10de64d4",
  },

  chainDifficulty: 21461933,
}

/**
 * `MultipleTargetWalletsAndDivisibleAmount` test data represents a moving
 * funds with the following properties:
 * - 1 main UTXO input
 * - 2 P2PKH and 1 P2WPKH outputs that matches the target wallets from
 *   the commitment
 * - The total transacted amount is divisible by 3 so all wallets obtain
 *   exactly the same amount.
 * - 6+ on-chain confirmations of the sweep transaction
 */
export const MultipleTargetWalletsAndDivisibleAmount = {
  wallet: {
    // Uncompressed public key for the pubKeyHash `0x7ac2d9378a1c47e589dfb8095ca95ed2140d2726`:
    //    04ee067a0273f2e3ba88d23140a24fdb290f27bbcd0f94117a9c65be3911c5c04efc314aa6ecfea6a43232df446014c41fd7446fe9deed7c2b054f7ea36e396306
    // X: ee067a0273f2e3ba88d23140a24fdb290f27bbcd0f94117a9c65be3911c5c04e
    // Y: fc314aa6ecfea6a43232df446014c41fd7446fe9deed7c2b054f7ea36e396306
    // ecdsaWalletID = keccak256(XY)
    ecdsaWalletID:
      "0x4ad6b3ccbca81645865d8d0d575797a15528e98ced22f29a6f906d3259569863",
    pubKeyHash: "0x7ac2d9378a1c47e589dfb8095ca95ed2140d2726",
    state: walletState.MovingFunds,
  },

  targetWalletsCommitment: [
    "0x2cd680318747b720d67bf4246eb7403b476adb34",
    "0x8900de8fc6e4cd1db4c7ab0759d28503b4cb0ab1",
    "0xaf7a841e055fc19bf31acf4cbed5ef548a2cc453",
  ],

  mainUtxo: {
    txHash:
      "0x9b71b2b9011e42b6dcb0c35ae11924c6492b20f7d851128abacc92864e362b7a",
    txOutputIndex: 1,
    txOutputValue: 1180947,
  },

  // https://live.blockcypher.com/btc-testnet/tx/16e97fcafef86aef46b056ebbf0be50b454d826ffaf0a4c528a16e1b61937ae8
  movingFundsTx: {
    hash: "0xe87a93611b6ea128c5a4f0fa6f824d450be50bbfeb56b046ef6af8feca7fe916",
    version: "0x01000000",
    inputVector:
      "0x019b71b2b9011e42b6dcb0c35ae11924c6492b20f7d851128abacc92864e362b7a" +
      "0100000000ffffffff",
    outputVector:
      "0x03f9f50500000000001976a9142cd680318747b720d67bf4246eb7403b476adb34" +
      "88acf9f50500000000001600148900de8fc6e4cd1db4c7ab0759d28503b4cb0ab1f9" +
      "f50500000000001976a914af7a841e055fc19bf31acf4cbed5ef548a2cc45388ac",
    locktime: "0x00000000",
  },

  movingFundsProof: {
    merkleProof:
      "0xac8ba8a6e34fbbffda8372ce6aa213499a98e324ab5e876b3b5a5b39293ca2de3b" +
      "ff933268c91c05241541b557b7d9400f2fa2129480dd1813bb926419c56d886454bc" +
      "6cc16b641f6824f89093a4c9abfa4245ea182dc745e12080fe987d1c93bcae141087" +
      "33d865392c5e0c04582fea7467b362b0c0a604caa59f65b9578bb133aefc47b304e6" +
      "2a83d5aec7954e75d827fbd7b46084f231db6e36e6b61c6f35b38a557b15d553bed7" +
      "878bacd99803f9fff7e0ec4b0a97f13a9144fc162dec36",
    txIndexInBlock: 12,
    bitcoinHeaders:
      "0x0000e02030fa568bb77672ce00aa73190b6394f2473e105bacc1edcba300000000" +
      "0000001f61df51e500a4df9b322da069d162fd473bb97ae4999febe7c759b39d7779" +
      "cabcf54e621ec8001a6cee453b000000209ea8ceb25fa3854fc8948255f6d47f7c82" +
      "0c5702861ee7e78100000000000000f44e0f8793c2d503817ecc991f1a836e249763" +
      "ab42936ba98703efde31fedf0518f64e621ec8001a2eb8274d00e0ff3f45dd51143f" +
      "07e88060db80fa4a92e53e8103c138b36b843879000000000000004bbfaeffde8147" +
      "0807f3c9a346479172bf02e4ea62d2f51e0c53163737488dc296f64e621ec8001a72" +
      "dc0b16000000205442a6fc93ed4586bd29360d359c824d1edae51ba1fccb2b260000" +
      "0000000000853aa96dab6e2e2049b27f0e47157b84b9b28e451550cf257b7f929db0" +
      "49686906f74e621ec8001a36e620b104200020e0a49ac7a66b57a3a3d6c179ec95ec" +
      "c62779fe8d9e50115196000000000000005b3438c4f01b35a067f30d26d2ef1c4c5f" +
      "1d7245e1146402fcba2d0ee9ac9a181af84e621ec8001a827753500000c020134645" +
      "f88ef4c28e11dc8c9cb29eb4a679b9793d6c3b75c4a300000000000000753631af53" +
      "921164be60b8aee0eb1d76c706ea9bb9cf4f53b8cb65830a3e982732f84e621ec800" +
      "1a10de64d4000060202b62c803c2129fbbf533f35de3e84694ed475aab83dfe11ba0" +
      "000000000000000de368e3dfdf42f498e8dea274f4c277547844bb07c28340a1a288" +
      "c86ea38d1113f94e621ec8001a7372433c",
  },

  chainDifficulty: 21461933,
}
