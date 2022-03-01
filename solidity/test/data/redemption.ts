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
 * - No change output
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
 * `SingleNonRequestedRedemption` test data represents a redemption with
 *  the following properties:
 * - 0 redemption requests
 * - 1 P2SH output with value 1176924 satoshi and index 0, pointing to a
 *   non-requested output script.
 *
 * Basically, this is the `SinglePendingRequestedRedemption` data set with
 * empty `redemptionRequests` array to simulate the situation where the
 * redemption transaction output is non-requested.
 */
export const SingleNonRequestedRedemption: RedemptionTestData = {
  ...SinglePendingRequestedRedemption,
  redemptionRequests: [],
}

/**
 * `SingleChangeP2PKH` test data represents a redemption with
 *  the following properties:
 * - 0 redemption requests
 * - 1 P2PKH change output with value 1860981 satoshi and index 0.
 */
export const SingleChangeP2PKH: RedemptionTestData = {
  wallet: {
    pubKeyHash: "0x7ac2d9378a1c47e589dfb8095ca95ed2140d2726",
    state: 1,
    pendingRedemptionsValue: 0,
  },

  redemptionRequests: [],

  mainUtxo: {
    txHash:
      "0x21dd23c4f92f2438dbd793abe8f9614b95c62ec9b3987167414cfb76437d658d",
    txOutputIndex: 0,
    txOutputValue: 1865981,
  },

  // https://live.blockcypher.com/btc-testnet/tx/37a56c64e1c2f98f68445fc4a788e9de14f02d521b6fd2eb9bac7fd9e5c8bf3a
  redemptionTx: {
    hash: "0x3abfc8e5d97fac9bebd26f1b522df014dee988a7c45f44688ff9c2e1646ca537",
    version: "0x01000000",
    inputVector:
      "0x0121dd23c4f92f2438dbd793abe8f9614b95c62ec9b3987167414cfb76437d658d" +
      "0000000000ffffffff",
    outputVector:
      "0x0175651c00000000001976a9147ac2d9378a1c47e589dfb8095ca95ed2140d2726" +
      "88ac",
    locktime: "0x00000000",
  },

  redemptionProof: {
    merkleProof:
      "0x8173541bf1b41a149d5e3af1a03924ac63fd603453bd26ee3a0e1bfc4c7272402b" +
      "aeaf690b864662b21f859e7306d62b0f7217c5534513310627e879c81b9ef3a760cb" +
      "a8efb31548ccba301a743cf2191593cd6aee7c0f46c659a88730fbcbd93d869e69dd" +
      "3d5ea610e6e3a5a7532cb7dfd7ce4178b027ad7b6a43f224139a35f1e379ae391326" +
      "4e23e771f8023a368933dc7701d743b031d53c38d853bedb84a4ad8bb7f8914887f5" +
      "d005fabf461a9fa4bec297bfd9c0b97e4351f9b24f9b6767aa0c6f356050fd9f4f60" +
      "13d3de554b7ea41170c84d6796becfeca6219bce6e",
    txIndexInBlock: 4,
    bitcoinHeaders:
      "0x0400002018bdadfc1236dfb54cb41536f32a89c374b3758f3f73258ce701000000" +
      "0000006e1ef1198d8ab725c9e56673b975e0e120552635040f809030c40b537b2218" +
      "15329e1c62ed3e031a5a6c5ee3040000209c3a847816fd334498120ef00b9375cf63" +
      "ae0fe8312799b09601000000000000c59b48b799e40b3e33bb52e4c05090e4da777d" +
      "bfb6cfa5bdfa9745a4f70758a0bca11c62ed3e031a50e50bb0040000203d750b7791" +
      "e966eaff01bb37f805bf33bc1416d2761b2ed0d902000000000000ebd895e4c2d055" +
      "f159e4ea620b92d82f6f9138c40342bb98138b1f47130a2917fba21c62ed3e031aec" +
      "283a06040000207df899accdbcd2d34fad622e9322e37de0d97ed833c9a90c9a0000" +
      "0000000000338ff96ba92b753253d31c12fa4c5729c0c40fd9198bdcabc22d97e2cb" +
      "4255945fa51c62ed3e031a2b928d570400002025141e65f673c2fb018d715d56357e" +
      "86c67f14c7993e3dcce402000000000000288854f0aef4ca27bffceacbd14124d697" +
      "3a6ab31fb49044344b6131dc52dfd7eca81c62ed3e031a8188640004e00020176fb6" +
      "202fac66facb3155eebc5d9f26155c5f6074d0d298af01000000000000175ff6b2d5" +
      "fd0ec570f00de4b5b8e45862280926762546123a8c70241e069e50d4ad1c62ffff00" +
      "1d7609709f00000020d6a19088bdad8792c1cbc9323b39b5e18fc70742a12bae4397" +
      "65000000000000606a7bf8e8cc10bb75f3b404adaf02ca5cc39b94cddf6cc56c6008" +
      "1dd5012ffe85b21c62ffff001d0178353b",
  },

  chainDifficulty: 5168815,
}

/**
 * `SingleChangeP2WPKH` test data represents a redemption with
 *  the following properties:
 * - 0 redemption requests
 * - 1 P2WPKH change output with value 1669207 satoshi and index 0.
 */
export const SingleChangeP2WPKH: RedemptionTestData = {
  wallet: {
    pubKeyHash: "0x7ac2d9378a1c47e589dfb8095ca95ed2140d2726",
    state: 1,
    pendingRedemptionsValue: 0,
  },

  redemptionRequests: [],

  mainUtxo: {
    txHash:
      "0x4ea443470719332172aad3106f64bb84746a4c7749619106912f70b2999ee674",
    txOutputIndex: 1,
    txOutputValue: 1674207,
  },

  // https://live.blockcypher.com/btc-testnet/tx/6b23f63b19510d2ea6c115757a791ccf196e36c14ae82cd1f9970293af186542
  redemptionTx: {
    hash: "0x426518af930297f9d12ce84ac1366e19cf1c797a7515c1a62e0d51193bf6236b",
    version: "0x01000000",
    inputVector:
      "0x014ea443470719332172aad3106f64bb84746a4c7749619106912f70b2999ee674" +
      "0100000000ffffffff",
    outputVector:
      "0x0157781900000000001600147ac2d9378a1c47e589dfb8095ca95ed2140d2726",
    locktime: "0x00000000",
  },

  redemptionProof: {
    merkleProof:
      "0x6f259cb4f10f7ebc91cd3a35cda5b8556e4ec5a917c508735db4b44c81ad19ec2d" +
      "eba03ae759d417a88f6a0c32effe91887026ceb0b6d4e0dccb7bfe93aeb1d6232ff0" +
      "ab7143ecb80f6f0f105cfd1a9dfbff1f8c044859b9b0978ba4029a8941d1336f6737" +
      "a694d5bb331e9af4a30d2802b2554d9cae8a42db6f3ebeb82fb016c03995af265559" +
      "b2da3a6aa71280db9ba200ba388138903ff9b6424a9712cc24b7f47dd86fe601e56b" +
      "a3924f08419e394895420a8af4230fa278d82d3acba2fb23926f8cc44b7c955d0473" +
      "694be2b1361431507e3092134e6ce1ce2d3a5d6595",
    txIndexInBlock: 3,
    bitcoinHeaders:
      "0x040000209c3a847816fd334498120ef00b9375cf63ae0fe8312799b09601000000" +
      "000000c59b48b799e40b3e33bb52e4c05090e4da777dbfb6cfa5bdfa9745a4f70758" +
      "a0bca11c62ed3e031a50e50bb0040000203d750b7791e966eaff01bb37f805bf33bc" +
      "1416d2761b2ed0d902000000000000ebd895e4c2d055f159e4ea620b92d82f6f9138" +
      "c40342bb98138b1f47130a2917fba21c62ed3e031aec283a06040000207df899accd" +
      "bcd2d34fad622e9322e37de0d97ed833c9a90c9a00000000000000338ff96ba92b75" +
      "3253d31c12fa4c5729c0c40fd9198bdcabc22d97e2cb4255945fa51c62ed3e031a2b" +
      "928d570400002025141e65f673c2fb018d715d56357e86c67f14c7993e3dcce40200" +
      "0000000000288854f0aef4ca27bffceacbd14124d6973a6ab31fb49044344b6131dc" +
      "52dfd7eca81c62ed3e031a8188640004e00020176fb6202fac66facb3155eebc5d9f" +
      "26155c5f6074d0d298af01000000000000175ff6b2d5fd0ec570f00de4b5b8e45862" +
      "280926762546123a8c70241e069e50d4ad1c62ffff001d7609709f00000020d6a190" +
      "88bdad8792c1cbc9323b39b5e18fc70742a12bae439765000000000000606a7bf8e8" +
      "cc10bb75f3b404adaf02ca5cc39b94cddf6cc56c60081dd5012ffe85b21c62ffff00" +
      "1d0178353b",
  },

  chainDifficulty: 5168815,
}

/**
 * `SingleChangeP2SH` test data represents a redemption with
 *  the following properties:
 * - 0 redemption requests
 * - 1 P2SH change output with value 1664207 satoshi and index 0.
 */
export const SingleChangeP2SH: RedemptionTestData = {
  wallet: {
    pubKeyHash: "0x7ac2d9378a1c47e589dfb8095ca95ed2140d2726",
    state: 1,
    pendingRedemptionsValue: 0,
  },

  redemptionRequests: [],

  mainUtxo: {
    txHash:
      "0x426518af930297f9d12ce84ac1366e19cf1c797a7515c1a62e0d51193bf6236b",
    txOutputIndex: 0,
    txOutputValue: 1669207,
  },

  // https://live.blockcypher.com/btc-testnet/tx/588a0e5e68ec8d3cf80d1190e51a68a431737a33c3a09f16303945dd49e369cd
  redemptionTx: {
    hash: "0xcd69e349dd453930169fa0c3337a7331a4681ae590110df83c8dec685e0e8a58",
    version: "0x01000000",
    inputVector:
      "0x01426518af930297f9d12ce84ac1366e19cf1c797a7515c1a62e0d51193bf6236b" +
      "0000000000ffffffff",
    outputVector:
      "0x01cf6419000000000017a9147ac2d9378a1c47e589dfb8095ca95ed2140d272687",
    locktime: "0x00000000",
  },

  redemptionProof: {
    merkleProof:
      "0xf6ed9f6ae7235c66ce46e4770aed465ab526375a834bbb651b3e5111ac84e58e42" +
      "6ccb496719c8ba7db243e6e0a7c4f00f1b2a308da73305cb0775a62df99cd26a3996" +
      "c774364ce40571d188d71e0044c42c3d6689b2d9a8a3c23f3a400f69e753330e3fae" +
      "9a71acecb7425e8dbe88cdfd7fc3258bac4e21ca1dec42e5094271c77932609c51fb" +
      "4b82497ed599d3c413c4fd023009716b3e5e885d89c31a1f30bb46106bac1034c65f" +
      "01d80ac402417373daf1fbae0d43041c67b948f47882b27c802a4e791504be4b1b71" +
      "80a788a54659799bedbc712e23a816cae0a12c017b838b1655583043a9c8d30399d3" +
      "f81e7e0fe2121a3c38490845174140a08ff6dc",
    txIndexInBlock: 6,
    bitcoinHeaders:
      "0x04e00020176fb6202fac66facb3155eebc5d9f26155c5f6074d0d298af01000000" +
      "000000175ff6b2d5fd0ec570f00de4b5b8e45862280926762546123a8c70241e069e" +
      "50d4ad1c62ffff001d7609709f00000020d6a19088bdad8792c1cbc9323b39b5e18f" +
      "c70742a12bae439765000000000000606a7bf8e8cc10bb75f3b404adaf02ca5cc39b" +
      "94cddf6cc56c60081dd5012ffe85b21c62ffff001d0178353b0000002047d4e44d16" +
      "4b7e98c15fd6bfc32c4dbb6bd0ef8bf47012d84006405500000000b3d6911ee43df5" +
      "ba0469ec212fcc6f93914df6dbe332c4c3cbb9c2791548e5f136b71c62ffff001dd3" +
      "769b64040000204fd0926c332cee9eaf06c34458d31e4050a2fd784cf9e91168336b" +
      "d8000000000dd4218907211ade52ff92d6bd555e7dd387adfd25963efee347a16325" +
      "1a43321fbc1c62ffff001dc03a633304e00020732d33ea35d62f9488cff5d64c0d70" +
      "2afd5d88092230ddfcc45f000000000000196283ba24a3f5bad91ef95338aa6d214c" +
      "934f2c1392e39a0447377fe5b0a04be7c01c62ffff001df0be0a27040000206c318b" +
      "23e5c42e86ef3edd080e50c9c233b9f0b6d186bd57e41300000000000021fb8cda20" +
      "0bff4fec1338d85a1e005bb4d729d908a7c5c232ecd0713231d0445ec11c62ed3e03" +
      "1a7b43466e04e00020f416898d79d4a46fa6c54f190ad3d502bad8aa3afdec0714aa" +
      "000000000000000603a5cc15e5906cb4eac9f747869fdc9be856e76a110b4f87da90" +
      "db20f9fbe28fc11c62ed3e031a15dfc3db",
  },

  chainDifficulty: 1,
}

/**
 * `SingleChangeZeroValue` test data represents a redemption with
 *  the following properties:
 * - 0 redemption requests
 * - 1 P2WPKH change output with value 0 satoshi and index 0.
 */
export const SingleChangeZeroValue: RedemptionTestData = {
  wallet: {
    pubKeyHash: "0x7ac2d9378a1c47e589dfb8095ca95ed2140d2726",
    state: 1,
    pendingRedemptionsValue: 0,
  },

  redemptionRequests: [],

  mainUtxo: {
    txHash:
      "0x110287e803db207b764a41ac01c98448ed34512eeafce15435c4667775af9ac5",
    txOutputIndex: 1,
    txOutputValue: 1616808,
  },

  // https://live.blockcypher.com/btc-testnet/tx/b8cdeb9f25bac990f233f0c10ccfb4335ca867996a9a7e43d69fa2f730a5b10f
  redemptionTx: {
    hash: "0x0fb1a530f7a29fd6437e9a6a9967a85c33b4cf0cc1f033f290c9ba259febcdb8",
    version: "0x01000000",
    inputVector:
      "0x01110287e803db207b764a41ac01c98448ed34512eeafce15435c4667775af9ac5" +
      "0100000000ffffffff",
    outputVector:
      "0x0100000000000000001600147ac2d9378a1c47e589dfb8095ca95ed2140d2726",
    locktime: "0x00000000",
  },

  redemptionProof: {
    merkleProof:
      "0x5e7abe1d2ffbeb05646d6af26119f9123142e3bddef55f019dc040a49434abf0f0" +
      "c416f0a505a0b45b138d1ebe22b1864399fd7a79bb8564024a88e3d75ec9a438556b" +
      "409052d83bbea2e19ae9134ddf709c030006524e474bc5ff8ee0d48198e86c92f167" +
      "0878ff5e7bd6c50d8685dfc99775e1addea552e0d0c7d507e6168f77815fd2a8616c" +
      "a48da4c0c82f9b7d6d8523ec31172366536ee4f6fb476409cc2c103aa580e8e304ba" +
      "7888e4d571088d801701c932dbfdb7aa5147089ca042992c69c7a840dfc2830b8f05" +
      "3ed5add244d4a03e995fe3875dbaee5350e03d30f2",
    txIndexInBlock: 1,
    bitcoinHeaders:
      "0x0400002040f4c65610f26f06c4365305b956934501713e01c2fc08b919e0bc1b0000" +
      "0000e401a6a884ba015e83c6fe2cd363e877ef03982e81eaff4e2c95af1e23a670f4" +
      "07d41c62ffff001d58c64d180400002038854bd62f802e1de14653eceeb7a80290f5" +
      "e99b8e9db517e36f000000000000a494b8034039e7855b75563ab83c9410dd67e89b" +
      "b58e6cd93b85290a885dd749f4d61c62ed3e031ad9a8374604000020ace542174988" +
      "4ead62a4c1ab007a064027fa2bfe4772f95f5f010000000000004cc59275b1fafab7" +
      "6df130064ea7b4f5e3fd1975bccac22395de1de47e105ec4abd91c62ed3e031aadb3" +
      "548c04e000209fd2f97b6a59c0ad71482b5f47cf9a2fab73d2335ba76eb48d020000" +
      "000000007c0e5aa9a87938e8466a8f1e662b246ce77784d4d7d9e9786bb7e5586fb3" +
      "d55445da1c62ed3e031a9c24b2d104e000205f34585d5251ffe2fd6590493a12bda6" +
      "1edf72a80256c71d1d010000000000002d61efa332cacb6c46e462907c85bad78b7d" +
      "a1218093061cbc1040d1c1e4db44aedc1c62ed3e031ad3ccc6d404e000209ff4c7e5" +
      "2245adb02a374dc04fa6346f5414057eb34a31f5770100000000000054640481f7e6" +
      "7a6abd11f41447de82c9ab4cfc36c1b08a69eec70c531af406d260dd1c62ed3e031a" +
      "d1cead8e04e000205eb6c71da390799a93d726debb7d2d24234fd10698ea6ac9fd00" +
      "000000000000326f7b757f161a464819a058635a5419d15f7fea715a3520f1cb546a" +
      "f661d3f85ade1c62ed3e031aa446a827",
  },

  chainDifficulty: 1,
}

/**
 * `SingleProvablyUnspendable` test data represents a redemption with
 *  the following properties:
 * - 0 redemption requests
 * - 1 provably unspendable change output with value 0 satoshi and index 0.
 */
export const SingleProvablyUnspendable: RedemptionTestData = {
  wallet: {
    pubKeyHash: "0x7ac2d9378a1c47e589dfb8095ca95ed2140d2726",
    state: 1,
    pendingRedemptionsValue: 0,
  },

  redemptionRequests: [],

  mainUtxo: {
    txHash:
      "0xc83c538a70028dd9fd40d7e8be0d05dc414a95927eb52df895e9d0c424786c53",
    txOutputIndex: 0,
    txOutputValue: 1914700,
  },

  // https://live.blockcypher.com/btc-testnet/tx/58a7d94d019aa658d00dfa2b5d5bb6b5d627b71afefff2bda5db501a75981fd3
  redemptionTx: {
    hash: "0xd31f98751a50dba5bdf2fffe1ab727d6b5b65b5d2bfa0dd058a69a014dd9a758",
    version: "0x01000000",
    inputVector:
      "0x01c83c538a70028dd9fd40d7e8be0d05dc414a95927eb52df895e9d0c424786c53" +
      "0000000000ffffffff",
    outputVector:
      "0x010000000000000000176a0f6d6f6e6579627574746f6e2e636f6d0568656c6c6f",
    locktime: "0x00000000",
  },

  redemptionProof: {
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
 * - 1 P2WPKH change output with value 137130866 satoshi and index 5.
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
