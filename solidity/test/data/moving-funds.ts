import { BigNumberish, BytesLike } from "ethers"
import { walletState } from "../fixtures"

/**
 * Represents a set of data used for the given moving funds scenario.
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

/**
 * `MultipleTargetWalletsButAmountDistributedUnevenly` test data represents a
 * moving funds with the following properties:
 * - 1 main UTXO input
 * - 2 P2PKH and 1 P2WPKH outputs that matches the target wallets from
 *   the commitment
 * - The total transacted amount is distributed unevenly over the target wallets
 * - 6+ on-chain confirmations of the sweep transaction
 * - This is not a valid moving funds transaction that should be rejected
 *   because amounts are not evenly distributed.
 */
export const MultipleTargetWalletsButAmountDistributedUnevenly = {
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
      "0x3ca370f492449e2b413c27fe18b1a139f602d049fc0903595c41441f5a35eaed",
    txOutputIndex: 0,
    txOutputValue: 1279418,
  },

  // https://live.blockcypher.com/btc-testnet/tx/5b362273b9471f62c35b2ef6940c3c13bd2b773626ab5de63efe4e895d56f98c
  movingFundsTx: {
    hash: "0x8cf9565d894efe3ee65dab2636772bbd133c0c94f62e5bc3621f47b97322365b",
    version: "0x01000000",
    inputVector:
      "0x013ca370f492449e2b413c27fe18b1a139f602d049fc0903595c41441f5a35eaed" +
      "0000000000ffffffff",
    outputVector:
      "0x032f760600000000001976a9142cd680318747b720d67bf4246eb7403b476adb34" +
      "88ac30760600000000001600148900de8fc6e4cd1db4c7ab0759d28503b4cb0ab133" +
      "760600000000001976a914af7a841e055fc19bf31acf4cbed5ef548a2cc45388ac",
    locktime: "0x00000000",
  },

  movingFundsProof: {
    merkleProof:
      "0x24c50204f1d2c838e7872dd7f5c3a38bac573cce654620dfec76c6a05e9eb3139d" +
      "b0514e107025c8c055c8a10e83826c244820a32821a3d010880c1b3ab6bcf620fb48" +
      "f188126e2628fb2d3ead8b7bd458c0bc9d2b6d15368831538114901f3bfd9ad0532a" +
      "b93c6f36c1755d3315fbdd146753b2332363cf75b931ddb824e9c3e21676a253e14f" +
      "be05ca546420c7b2e535666129660fb462adde0075114d5e00",
    txIndexInBlock: 2,
    bitcoinHeaders:
      "0x00000020fea86838d788d0c0e2f4c32272ba5dd599c4bd04baa4ff759900000000" +
      "000000b04fb0eaa2f1e39b53c26afdfa726289940864e3a42e06103fc7236aa67b15" +
      "f3d50c50621ec8001a73dc826b04000020b18b27f95a438fd3d1bd571fd5ed10876b" +
      "678f7f29cbb9a3ba000000000000009f9da0db22cc9d10d085502e74e6025e295bef" +
      "3abc1441f7f0986ddadfd97776ce0d50621ec8001a7b784f6200000020e17a6b1a17" +
      "34108e303b47a27ac7ff80a9ce9facc795e5bf8600000000000000e6da2811b1b28d" +
      "b55ac59062c3651798356c5186b92664628eae8bc14f634ec27b0e50621ec8001a2e" +
      "4075860000c020e7021f51166a77246660d627322dc6887cf0a9491f07f3d9430000" +
      "00000000005c5437498047dcc617029442e5493460987ce6a1d186c2562412eae524" +
      "42aa79b20e50621ec8001a02d802c804000020007219023a7eea3691d8091f3e67a2" +
      "c17bbe15da9ae464663c000000000000007e1b1140ada8cb3f240f011243c8da5e4d" +
      "abcd753d22d13c86d7c240413165f6160f50621ec8001a57daeccc0000a020a8597b" +
      "1c1720560be7cc0f3707499f11e05df742c74cb5c99f00000000000000e17e1fc4b6" +
      "70a70c0c67b1ccb183f0e8bf4c3321039d49675aa6886bd2ec691c4e0f50621ec800" +
      "1a59b3b33c000000205058b8dcbbfdfb9e00b30e3f374ec17e1789fc4f3f678f27bf" +
      "000000000000001b329dd98f5f1d79f36d0b74fa3da4a9e82609a424287f6e1de301" +
      "485278b0ce4f1150621ec8001a4b24dd9e",
  },

  chainDifficulty: 21461933,
}

/**
 * `SingleTargetWalletButP2SH` test data represents a moving funds with the
 * following properties:
 * - 1 main UTXO input
 * - 1 P2SH output that matches the target wallet from the commitment
 * - 6+ on-chain confirmations of the sweep transaction
 * - This is not a valid moving funds transaction that should be rejected
 *   because of the illegal P2SH output.
 */
export const SingleTargetWalletButP2SH: MovingFundsTestData = {
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

  targetWalletsCommitment: ["0x86884e6be1525dab5ae0b451bd2c72cee67dcf41"],

  mainUtxo: {
    txHash:
      "0xb69a2869840aa6fdfd143136ff4514ca46ea2d876855040892ad74ab8c527422",
    txOutputIndex: 1,
    txOutputValue: 1177424,
  },

  // https://live.blockcypher.com/btc-testnet/tx/70d4182e795ebb0ddd8339ed9c0213d6e48f7cb6c956ced03c49f554a93a5669
  movingFundsTx: {
    hash: "0x69563aa954f5493cd0ce56c9b67c8fe4d613029ced3983dd0dbb5e792e18d470",
    version: "0x01000000",
    inputVector:
      "0x01b69a2869840aa6fdfd143136ff4514ca46ea2d876855040892ad74ab8c527422" +
      "0100000000ffffffff",
    outputVector:
      "0x015cf511000000000017a91486884e6be1525dab5ae0b451bd2c72cee67dcf4187",
    locktime: "0x00000000",
  },

  movingFundsProof: {
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
 * `SingleProvablyUnspendable` test data represents a moving funds with
 *  the following properties:
 * - 1 main UTXO input
 * - 1 provably unspendable output with value 0 satoshi and index 0.
 * - 6+ on-chain confirmations of the redemption transaction
 */
export const SingleProvablyUnspendable: MovingFundsTestData = {
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

  targetWalletsCommitment: ["0x86884e6be1525dab5ae0b451bd2c72cee67dcf41"],

  mainUtxo: {
    txHash:
      "0xc83c538a70028dd9fd40d7e8be0d05dc414a95927eb52df895e9d0c424786c53",
    txOutputIndex: 0,
    txOutputValue: 1914700,
  },

  // https://live.blockcypher.com/btc-testnet/tx/58a7d94d019aa658d00dfa2b5d5bb6b5d627b71afefff2bda5db501a75981fd3
  movingFundsTx: {
    hash: "0xd31f98751a50dba5bdf2fffe1ab727d6b5b65b5d2bfa0dd058a69a014dd9a758",
    version: "0x01000000",
    inputVector:
      "0x01c83c538a70028dd9fd40d7e8be0d05dc414a95927eb52df895e9d0c424786c53" +
      "0000000000ffffffff",
    outputVector:
      "0x010000000000000000176a0f6d6f6e6579627574746f6e2e636f6d0568656c6c6f",
    locktime: "0x00000000",
  },

  movingFundsProof: {
    merkleProof:
      "0x905ff7ee49bf6e4290d4045f19317130044e77241b4b38fb3c8c1f1413b8a89574" +
      "ebfb6efeabf05d65f5ad9cc1f8355d2a00a4ca22d7c7a0e0cabc0d6a4c6c00db10e3" +
      "b9f542c6eeb6ec38df9acba0726e452cf50d19b285b5ebb60e2faafb24ea8a2604cc" +
      "8f08c7ab494f4619e240bcc91e91174432a07809ffbfa579e931c16ccbdff6587298" +
      "eb5a02da3f1afc3d5f0ccc06ddad31690cae99d9261218fa4f76e3bd2c3157089f5f" +
      "4586201fccd2ebcc75db72b46fc7a026de0ac5dd7a8245",
    txIndexInBlock: 1,
    bitcoinHeaders:
      "0x040000201d7a507f86c714fd747e45078096087c65bcabb8e6defa98b433000000" +
      "000000d27279d16f4ef9b10ab2fd0b20be00cf380f9e1d4409d1577822cffbd65989" +
      "d9cb081e62ed3e031ab61e9f5600000020b811a75ec03812f7a0b8580b73282afd59" +
      "6ed9d2b0a9b1c79700000000000000538ba47e9eade7963da25fa640d87a2234489f" +
      "a60741fb2ba89efab52e442b77810d1e62ffff001de0c4afc504e00020342898739f" +
      "1e6ac6e8fe86dc3584fe8f21e5bef01dc714033a20ad3300000000910830b662c217" +
      "5c9a41b3377d072a2b0290d5e44e8a40e038acae63171d216b140f1e62ed3e031a32" +
      "b4b5e000000020345c4a1f645e26da4ec35cbc52543c6871e526b0a6c52070a30200" +
      "00000000002160037975ec5f355cba38f4e9e2a98d8271bba7844a313fb5cb91709a" +
      "4b4c0ee6131e62ffff001da0bddd2404000020667e4f0e217d2f2dd4d5fdcfb27857" +
      "bdd3ae0c643a036897e762a99600000000f189c5237d6d5e15214a7f4d0ad6b82ac1" +
      "522a1b1ee93bc4c76ab169462f26c308161e62ed3e031af4b78af704e00020968648" +
      "2db903e6880604162d4ecedb113e5e0895131dcb608900000000000000d3d4eeb630" +
      "cc71bb0ebf76822c95e19b3d0046ad01b74b6941507b5beaa1cf67db191e62ed3e03" +
      "1a0040a522040000208d370c6f9d47eaf0c1ab779a5b811838a61403def157972e35" +
      "0300000000000080b93554feec4b0c497738f604526bf990bb8924c538f58f030f3a" +
      "ff72bc0347e91b1e62ed3e031a07543bdf",
  },

  chainDifficulty: 5168815,
}

/**
 * `MultipleInputs` test data represents a moving funds with
 *  the following properties:
 * - 2 inputs where 1 of them points to the main UTXO
 * - 6+ on-chain confirmations of the redemption transaction
 */
export const MultipleInputs: MovingFundsTestData = {
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

  targetWalletsCommitment: ["0x86884e6be1525dab5ae0b451bd2c72cee67dcf41"],

  mainUtxo: {
    txHash:
      "0xc9e58780c6c289c25ae1fe293f85a4db4d0af4f305172f2a1868ddd917458bdf",
    txOutputIndex: 1,
    txOutputValue: 718510,
  },

  // https://live.blockcypher.com/btc-testnet/tx/605edd75ae0b4fa7cfc7aae8f1399119e9d7ecc212e6253156b60d60f4925d44
  movingFundsTx: {
    hash: "0x445d92f4600db6563125e612c2ecd7e9199139f1e8aac7cfa74f0bae75dd5e60",
    version: "0x01000000",
    inputVector:
      "0x0225a666beb7380a3fa2a0a8f64a562c7f1749a131bfee26ff61e4cee07cb3dd" +
      "030100000000ffffffffc9e58780c6c289c25ae1fe293f85a4db4d0af4f305172f" +
      "2a1868ddd917458bdf0100000000ffffffff",
    outputVector:
      "0x03c0900400000000001976a9142cd680318747b720d67bf4246eb7403b476adb" +
      "3488acc090040000000000160014e6f9d74726b19b75f16fe1e9feaec048aa4fa1" +
      "d0041d0800000000001600147ac2d9378a1c47e589dfb8095ca95ed2140d2726",
    locktime: "0x00000000",
  },

  movingFundsProof: {
    merkleProof:
      "0x88269e1c322be70bfbefb31c21880716592b5c50cc05daed725278d574c3e472" +
      "6347cd0825a64a705f72133c93a181547d0a27919605ef110aeafc30a88fefdfc1" +
      "c9d3e01fbb6e628ed67c41b5ea533a112883d5a8672d669fe3739ca7b274b3c1f5" +
      "4765886f2444ef13d4c90d72594920df006793362ec6169ae4840be26af17fb255" +
      "5399b14643436ba75f862e4aac9b5e53c68dddc706720ab18f2f46be59a00211d8" +
      "cf4f8e311f49f2a52177c7a21d421e52748d01114e83e13c21ad4131",
    txIndexInBlock: 1,
    bitcoinHeaders:
      "0x000000208ec76388aa580d8fa32ce9becbfd8f140dc33fc5a91fbc00f9020000" +
      "00000000959305797e5c97c81fe38629d01271d3f583f4cebe878ddb3e93547004" +
      "b29f7961952062ed3e031a6bd3f8050000ff3f42a37a9f0d546b1752e712abf607" +
      "ee0d4f63d65e2590ccef4202000000000000ce9a58c9a6f39c18225afd7a7e5591" +
      "423d77620595d4dd264167d889c4ddb7fa28972062ed3e031a75397f0104e00020" +
      "d9cb8a5f9c012c43e9e0ccb4eb2ef134f3deb03a71ec005c8c0000000000000058" +
      "fd6736c2d43ef0e414e31333f08fda58be1046967f412be7033421e4ca87e03997" +
      "2062ed3e031acd8c3dcb04000020bbcf82f0e7a70b2070f7c32e8ac686fa2bef3c" +
      "f735ea7778030200000000000049926ec1e65124db0045942e5e98a323e8c15a9e" +
      "1c6a43139b79618fc7efcece37972062ed3e031ab38bf0fc00e0002055daa8e180" +
      "320777a0b8d9b27f574513720caa0bd4c6f7ae34030000000000009935ad26c911" +
      "4f4b21781b3509a8d106b2b597af2fa41e19469cca843a1c650b49972062ed3e03" +
      "1a6a3ca59100e0002012ea5dafd8e9e4c149da2e3a896281b68b375eb2ea38cdef" +
      "1403000000000000c9e61160c8367db22bbf0f3a0c07acb29ea15ca44cbc92a2dc" +
      "9ea17a971c2e63ad982062ed3e031a3cfc880f00e00020fc72ae375a8cd436d959" +
      "c96b73323c81e2ef11e31d7c98e72e02000000000000711a4b0d4fadef376c37da" +
      "044aa896ea0e7c64008c2d6c3e3eb2d6f1b58e78b5339a2062ed3e031a9b77f2eb",
  },

  chainDifficulty: 5168815,
}
