import { BytesLike } from "@ethersproject/bytes"
import { BigNumberish } from "ethers"

// TODO: Documentation
export interface SweepTestData {
  deposits: {
    fundingTx: {
      hash: BytesLike
      version: BytesLike
      inputVector: BytesLike
      outputVector: BytesLike
      locktime: BytesLike
    }
    reveal: {
      fundingOutputIndex: BigNumberish
      depositor: string
      blindingFactor: BytesLike
      walletPubKeyHash: BytesLike
      refundPubKeyHash: BytesLike
      refundLocktime: BytesLike
      vault: string
    }
  }[]

  sweepTx: {
    hash: BytesLike
    version: BytesLike
    inputVector: BytesLike
    outputVector: BytesLike
    locktime: BytesLike
  }

  sweepProof: {
    merkleProof: BytesLike
    txIndexInBlock: BigNumberish
    bitcoinHeaders: BytesLike
  }

  chainDifficulty: number
}

// `SingleP2SHDeposit` test data represents a sweep with following properties:
// - 1 P2SH deposit input
// - 1 P2WPKH sweep output
// - No prior sweeps made by this wallet
// - 6+ on-chain confirmations of the sweep transaction
export const SingleP2SHDeposit: SweepTestData = {
  deposits: [
    {
      // https://live.blockcypher.com/btc-testnet/tx/c580e0e352570d90e303d912a506055ceeb0ee06f97dce6988c69941374f5479
      fundingTx: {
        hash: "0x79544f374199c68869ce7df906eeb0ee5c0506a512d903e3900d5752e3e080c5",
        version: "0x01000000",
        inputVector:
          "0x011d9b71144a3ddbb56dd099ee94e6dd8646d7d1eb37fe1195367e6fa844a3" +
          "88e7010000006a47304402206f8553c07bcdc0c3b906311888103d623ca9096c" +
          "a0b28b7d04650a029a01fcf9022064cda02e39e65ace712029845cfcf58d1b59" +
          "617d753c3fd3556f3551b609bbb00121039d61d62dcd048d3f8550d22eb90b4a" +
          "f908db60231d117aeede04e7bc11907bfaffffffff",
        outputVector:
          "0x02204e00000000000017a9143ec459d0f3c29286ae5df5fcc421e278602427" +
          "7e87a6c2140000000000160014e257eccafbc07c381642ce6e7e55120fb077fb" +
          "ed",
        locktime: "0x00000000",
      },
      reveal: {
        fundingOutputIndex: 0,
        depositor: "0x934b98637ca318a4d6e7ca6ffd1690b8e77df637",
        blindingFactor: "0xf9f0c90d00039523",
        // HASH160 of 03989d253b17a6a0f41838b84ff0d20e8898f9d7b1a98f2564da4cc29dcf8581d9
        walletPubKeyHash: "0x8db50eb52063ea9d98b3eac91489a90f738986f6",
        // HASH160 of 039d61d62dcd048d3f8550d22eb90b4af908db60231d117aeede04e7bc11907bfa
        refundPubKeyHash: "0xe257eccafbc07c381642ce6e7e55120fb077fbed",
        refundLocktime: "0xe0250162",
        vault: "0x0000000000000000000000000000000000000000",
      },
    },
  ],

  // https://live.blockcypher.com/btc-testnet/tx/f5b9ad4e8cd5317925319ebc64dc923092bef3b56429c6b1bc2261bbdc73f351
  sweepTx: {
    hash: "0x51f373dcbb6122bcb1c62964b5f3be923092dc64bc9e31257931d58c4eadb9f5",
    version: "0x01000000",
    inputVector:
      "0x0179544f374199c68869ce7df906eeb0ee5c0506a512d903e3900d5752e3e080c5" +
      "00000000c847304402205eff3ae003a5903eb33f32737e3442b6516685a1addb1933" +
      "9c2d02d400cf67ce0220707435fc2a0577373c63c99d242c30bea5959ec180169978" +
      "d43ece50618fe0ff012103989d253b17a6a0f41838b84ff0d20e8898f9d7b1a98f25" +
      "64da4cc29dcf8581d94c5c14934b98637ca318a4d6e7ca6ffd1690b8e77df6377508" +
      "f9f0c90d000395237576a9148db50eb52063ea9d98b3eac91489a90f738986f68763" +
      "ac6776a914e257eccafbc07c381642ce6e7e55120fb077fbed8804e0250162b175ac" +
      "68ffffffff",
    outputVector:
      "0x0144480000000000001600148db50eb52063ea9d98b3eac91489a90f738986f6",
    locktime: "0x00000000",
  },

  sweepProof: {
    merkleProof:
      "0x75377d34f47e2eb0cfb04459bce58492a84996dc31bf3cba5f08bfea36168d3969" +
      "93fa41ecc498353f332478ae3f964241fa1956f52f09cd6994eb7fbda3341b433477" +
      "45dbcc7ce3902199c31a0fb3c03a21f1f6845480cbbee15e8fbf400cb741b48b8505" +
      "ca54f7c08cd9c2e5c37b03a3eca02af540fc5b9ad90a00c4a1d2cf54fcbcc851c8d4" +
      "7552b8e09f6656a7fb74c488b9869b3247d56cdfe1ecbd4517b6b06c734b78f6c725" +
      "26da3cc4b5219faa48ba7abe403729b958b16cc07c706eb87d6febdbf3b82f1d64b1" +
      "54be0a60cdbbab0de51e0e4743214828f9ee2c0c29",
    txIndexInBlock: 36,
    bitcoinHeaders:
      "0x04000020a5a3501e6ba1f3e2a1ee5d29327a549524ed33f272dfef300045660000" +
      "000000e27d241ca36de831ab17e6729056c14a383e7a3f43d56254f846b496497751" +
      "12939edd612ac0001abbaa602e000000206d9e839a3c97827b5faf845f51a66edc34" +
      "ed32dbb81109f12a00000000000000fee43f9fffe8f2038392fdc69ba05e8825bac4" +
      "cda8c84c3f738d8ba2399a549a54a3dd61ffff001d3c151016000000201f6384713b" +
      "588bb730c51320aa0ab841e1dede512fdc2ed874e324df000000004254fcc35ca3e6" +
      "60d6a325b04755bd4c45b47530aece6ec254a6d84363c9836115a8dd61ffff001dc4" +
      "977aca00004020d6e7417486214ba46562c9bf4cdb973f9924dddee419b80afff181" +
      "d50000000031e301a5250a75e599d3a7e70996d677216cf23f261d513d9ac87296a0" +
      "3046dacdacdd61ffff001de15046e200000020ee071caba9bc64b8d459bfa0080722" +
      "1001f2c632c851d2868fa90600000000004e10814280c8bb5c548d09d4bae08164f7" +
      "3e32fcd35ed31020579b592668280383b1dd61ffff001dc15e6b8104000020382355" +
      "d0078bd0aaf7eb872dfa0f1bb555f8be0c0c219886d1426dfe0000000066555236d3" +
      "bbfb19bf093fe55252f7fb49a75ae99e6415b61ff6c0f8b89d0842b3b1dd612ac000" +
      "1ada9c55300000002031552151fbef8e96a33f979e6253d29edf65ac31b04802319e" +
      "00000000000000e003319fca9082d25815fcca442fe68a5249818abc79302e1b3dfe" +
      "854bf18028c0b2dd612ac0001ac429a1dd",
  },

  chainDifficulty: 22350181,
}

// `MultipleDepositsNoPreviousSweep` test data represents a sweep with following properties:
// - 3 P2WSH and 2 P2SH deposit inputs
// - 1 P2WPKH sweep output
// - No prior sweeps made by this wallet
// - 6+ on-chain confirmations of the sweep transaction
// TODO: Currently, the `MultipleDepositsNoPreviousSweep` test data contain
//       only P2SH deposit transactions made by the same depositor.
//       Once the code responsible for assembling sweep transactions (PR #96)
//       supports P2WSH, we should make this data aligned with the above description.
export const MultipleDepositsNoPreviousSweep: SweepTestData = {
  deposits: [
    {
      // https://live.blockcypher.com/btc-testnet/tx/e06493b93467906a1b9aece31fbcfc881ab608fc284aee01f6e7395f4cefb876
      fundingTx: {
        hash: "0x76b8ef4c5f39e7f601ee4a28fc08b61a88fcbc1fe3ec9a1b6a906734b99364e0",
        version: "0x01000000",
        inputVector:
          "0x0184548dcc95e8c322adef9b2d8e7c475d6ca8fdb3224fb9e37a4696a8a083" +
          "ca970100000000ffffffff",
        outputVector:
          "0x02400d03000000000017a9142c1444d23936c57bdd8b3e67e5938a5440cda4" +
          "558704b81900000000001600147ac2d9378a1c47e589dfb8095ca95ed2140d27" +
          "26",
        locktime: "0x00000000",
      },
      reveal: {
        fundingOutputIndex: 0,
        depositor: "0x934B98637cA318a4D6E7CA6ffd1690b8e77df637",
        blindingFactor: "0xf9f0c90d00039523",
        // HASH160 of 03989d253b17a6a0f41838b84ff0d20e8898f9d7b1a98f2564da4cc29dcf8581d9.
        walletPubKeyHash: "0x8db50eb52063ea9d98b3eac91489a90f738986f6",
        // HASH160 of 0300d6f28a2f6bf9836f57fcda5d284c9a8f849316119779f0d6090830d97763a9.
        refundPubKeyHash: "0x28e081f285138ccbe389c1eb8985716230129f89",
        refundLocktime: "0x60bcea61",
        vault: "0x0000000000000000000000000000000000000000",
      },
    },
    {
      // https://live.blockcypher.com/btc-testnet/tx/aa718a20dcca44f25d413c9678d70ebc0315dcc12f292500e5b3e2ae4e99330b
      fundingTx: {
        hash: "0x0b33994eaee2b3e50025292fc1dc1503bc0ed778963c415df244cadc208a71aa",
        version: "0x01000000",
        inputVector:
          "0x01a78a0b88f916f3ce857a2d6d776155f171e34473e5c9a38c54a417f58d27" +
          "6e610000000000ffffffff",
        outputVector:
          "0x0220a107000000000017a9142c1444d23936c57bdd8b3e67e5938a5440cda4" +
          "558702801100000000001600147ac2d9378a1c47e589dfb8095ca95ed2140d27" +
          "26",
        locktime: "0x00000000",
      },
      reveal: {
        fundingOutputIndex: 0,
        depositor: "0x934B98637cA318a4D6E7CA6ffd1690b8e77df637",
        blindingFactor: "0xf9f0c90d00039523",
        // HASH160 of 03989d253b17a6a0f41838b84ff0d20e8898f9d7b1a98f2564da4cc29dcf8581d9.
        walletPubKeyHash: "0x8db50eb52063ea9d98b3eac91489a90f738986f6",
        // HASH160 of 0300d6f28a2f6bf9836f57fcda5d284c9a8f849316119779f0d6090830d97763a9.
        refundPubKeyHash: "0x28e081f285138ccbe389c1eb8985716230129f89",
        refundLocktime: "0x60bcea61",
        vault: "0x0000000000000000000000000000000000000000",
      },
    },
    {
      // https://live.blockcypher.com/btc-testnet/tx/fb6463b653165315ba44f858f333c17fee95a5337233b990d5c51439f36925d1
      fundingTx: {
        hash: "0xd12569f33914c5d590b9337233a595ee7fc133f358f844ba15531653b66364fb",
        version: "0x01000000",
        inputVector:
          "0x0164930f03542c43800ad98d40cf1f47f56a17d3cfdb025da109ec29c3c0a5" +
          "e8040100000000ffffffff",
        outputVector:
          "0x02701101000000000017a9142c1444d23936c57bdd8b3e67e5938a5440cda4" +
          "5587a03a1c00000000001600147ac2d9378a1c47e589dfb8095ca95ed2140d27" +
          "26",
        locktime: "0x00000000",
      },
      reveal: {
        fundingOutputIndex: 0,
        depositor: "0x934B98637cA318a4D6E7CA6ffd1690b8e77df637",
        blindingFactor: "0xf9f0c90d00039523",
        // HASH160 of 03989d253b17a6a0f41838b84ff0d20e8898f9d7b1a98f2564da4cc29dcf8581d9.
        walletPubKeyHash: "0x8db50eb52063ea9d98b3eac91489a90f738986f6",
        // HASH160 of 0300d6f28a2f6bf9836f57fcda5d284c9a8f849316119779f0d6090830d97763a9.
        refundPubKeyHash: "0x28e081f285138ccbe389c1eb8985716230129f89",
        refundLocktime: "0x60bcea61",
        vault: "0x0000000000000000000000000000000000000000",
      },
    },
    {
      // https://live.blockcypher.com/btc-testnet/tx/db81ad10008d9489ef345a136009a92167660b5d9fa463752521228312917620
      fundingTx: {
        hash: "0x20769112832221257563a49f5d0b666721a90960135a34ef89948d0010ad81db",
        version: "0x01000000",
        inputVector:
          "0x01d3956506cd5e07670a7fc4ec7c768de549a9385391c64df3e8b701551d93" +
          "88980100000000ffffffff",
        outputVector:
          "0x02905f01000000000017a9142c1444d23936c57bdd8b3e67e5938a5440cda4" +
          "5587ea9d1200000000001600147ac2d9378a1c47e589dfb8095ca95ed2140d27" +
          "26",
        locktime: "0x00000000",
      },
      reveal: {
        fundingOutputIndex: 0,
        depositor: "0x934B98637cA318a4D6E7CA6ffd1690b8e77df637",
        blindingFactor: "0xf9f0c90d00039523",
        // HASH160 of 03989d253b17a6a0f41838b84ff0d20e8898f9d7b1a98f2564da4cc29dcf8581d9.
        walletPubKeyHash: "0x8db50eb52063ea9d98b3eac91489a90f738986f6",
        // HASH160 of 0300d6f28a2f6bf9836f57fcda5d284c9a8f849316119779f0d6090830d97763a9.
        refundPubKeyHash: "0x28e081f285138ccbe389c1eb8985716230129f89",
        refundLocktime: "0x60bcea61",
        vault: "0x0000000000000000000000000000000000000000",
      },
    },
    {
      // https://live.blockcypher.com/btc-testnet/tx/2a71cae1d73d77d17a61ca4e6bfb7a0162bb4aac615b5543a906dac22918fbba
      fundingTx: {
        hash: "0xbafb1829c2da06a943555b61ac4abb62017afb6b4eca617ad1773dd7e1ca712a",
        version: "0x01000000",
        inputVector:
          "0x0116fb2285a29c0ee412dd4d2213161e506e80565f669ba70a595f15a31b9a" +
          "30190100000000ffffffff",
        outputVector:
          "0x02409c00000000000017a9142c1444d23936c57bdd8b3e67e5938a5440cda4" +
          "5587a53f1200000000001600147ac2d9378a1c47e589dfb8095ca95ed2140d27" +
          "26",
        locktime: "0x00000000",
      },
      reveal: {
        fundingOutputIndex: 0,
        depositor: "0x934B98637cA318a4D6E7CA6ffd1690b8e77df637",
        blindingFactor: "0xf9f0c90d00039523",
        // HASH160 of 03989d253b17a6a0f41838b84ff0d20e8898f9d7b1a98f2564da4cc29dcf8581d9.
        walletPubKeyHash: "0x8db50eb52063ea9d98b3eac91489a90f738986f6",
        // HASH160 of 0300d6f28a2f6bf9836f57fcda5d284c9a8f849316119779f0d6090830d97763a9.
        refundPubKeyHash: "0x28e081f285138ccbe389c1eb8985716230129f89",
        refundLocktime: "0x60bcea61",
        vault: "0x0000000000000000000000000000000000000000",
      },
    },
  ],

  // https://live.blockcypher.com/btc-testnet/tx/d13f86aeb4ec0680e6535752f4e0b2bb80f22d044caee2f6a85231f4d4e0b76e
  sweepTx: {
    hash: "0x6eb7e0d4f43152a8f6e2ae4c042df280bbb2e0f4525753e68006ecb4ae863fd1",
    version: "0x01000000",
    inputVector:
      "0x050b33994eaee2b3e50025292fc1dc1503bc0ed778963c415df244cadc208a71aa" +
      "00000000c8473044022030c8741058291a8149db26854ac6e9bb04a6e7d5e730319d" +
      "274ef0a24903068702204d0bda19b6615a91ba3fb8566270406fcad60f9e3ed96e82" +
      "9f72959b60301fb4012103989d253b17a6a0f41838b84ff0d20e8898f9d7b1a98f25" +
      "64da4cc29dcf8581d94c5c14934b98637ca318a4d6e7ca6ffd1690b8e77df6377508" +
      "f9f0c90d000395237576a9148db50eb52063ea9d98b3eac91489a90f738986f68763" +
      "ac6776a91428e081f285138ccbe389c1eb8985716230129f89880460bcea61b175ac" +
      "68ffffffff76b8ef4c5f39e7f601ee4a28fc08b61a88fcbc1fe3ec9a1b6a906734b9" +
      "9364e000000000c9483045022100b364bdc1cffcb5616e3cf8c8b1ad8986c93bbf5a" +
      "b6329c34f6337cbff636d4890220341b4b8277c44b8f8b58b412d724f52b4cef16a5" +
      "e2c261a9aec7f9c634250408012103989d253b17a6a0f41838b84ff0d20e8898f9d7" +
      "b1a98f2564da4cc29dcf8581d94c5c14934b98637ca318a4d6e7ca6ffd1690b8e77d" +
      "f6377508f9f0c90d000395237576a9148db50eb52063ea9d98b3eac91489a90f7389" +
      "86f68763ac6776a91428e081f285138ccbe389c1eb8985716230129f89880460bcea" +
      "61b175ac68ffffffff20769112832221257563a49f5d0b666721a90960135a34ef89" +
      "948d0010ad81db00000000c94830450221009535a934199f1cf9e3ebaaf1df97eead" +
      "586ac24cade25babe471624a49b3c74002202b4ca05feb919157291f2d195773cd97" +
      "0675c2fdf119d2a6dd8d9a93b180cb47012103989d253b17a6a0f41838b84ff0d20e" +
      "8898f9d7b1a98f2564da4cc29dcf8581d94c5c14934b98637ca318a4d6e7ca6ffd16" +
      "90b8e77df6377508f9f0c90d000395237576a9148db50eb52063ea9d98b3eac91489" +
      "a90f738986f68763ac6776a91428e081f285138ccbe389c1eb8985716230129f8988" +
      "0460bcea61b175ac68ffffffffd12569f33914c5d590b9337233a595ee7fc133f358" +
      "f844ba15531653b66364fb00000000c8473044022068b0a54ef63d0f309341756e1f" +
      "de17001b787407d0beede887e699f68aaa927f02204258f4b8c4fab17c35317d0cd7" +
      "7ace575fe87ac12f42d4ab6ceadb099c05630c012103989d253b17a6a0f41838b84f" +
      "f0d20e8898f9d7b1a98f2564da4cc29dcf8581d94c5c14934b98637ca318a4d6e7ca" +
      "6ffd1690b8e77df6377508f9f0c90d000395237576a9148db50eb52063ea9d98b3ea" +
      "c91489a90f738986f68763ac6776a91428e081f285138ccbe389c1eb898571623012" +
      "9f89880460bcea61b175ac68ffffffffbafb1829c2da06a943555b61ac4abb62017a" +
      "fb6b4eca617ad1773dd7e1ca712a00000000c84730440220589fe233b9bd032118ab" +
      "d0c5700c4802c4b7dcf99b73a82174b3e7fb0b1a2e5002206d33b581e3dc1ad7ea7c" +
      "52bbc63528c1a0df9cb25dcf02501f652cbe7869cf65012103989d253b17a6a0f418" +
      "38b84ff0d20e8898f9d7b1a98f2564da4cc29dcf8581d94c5c14934b98637ca318a4" +
      "d6e7ca6ffd1690b8e77df6377508f9f0c90d000395237576a9148db50eb52063ea9d" +
      "98b3eac91489a90f738986f68763ac6776a91428e081f285138ccbe389c1eb898571" +
      "6230129f89880460bcea61b175ac68ffffffff",
    outputVector:
      "0x01d0b30d00000000001600148db50eb52063ea9d98b3eac91489a90f738986f6",
    locktime: "0x00000000",
  },

  sweepProof: {
    merkleProof:
      "0xee805a9623790379a0e0ab2b94fb6dc50bad9c3a3907ec811343ebcca846c1e65a" +
      "5d9a0de0d96b128e07c7f9243681ded3fb48703d5bc20736a487adb07c71363840f1" +
      "6918932204eee7e9addff55bbff2886dca6a084d50f62a00e14db57dee4e6d6cf69d" +
      "f4403a9f87a965f716f19c8e608953365e87d390ce89cc7abb2146d97ec14b6b9135" +
      "96fa1c2ca16ed9617618dc4fc9ee035c865dd4eb9e2144af5bbd1203bb2ea5f9e26f" +
      "9b1684954671e483694200528d63630ba492c4fd61c76773671812c9f34cb71587a1" +
      "6439887a5723c6bda6c42751f7454a5d76bf49e51b",
    txIndexInBlock: 41,
    bitcoinHeaders:
      "0x0000002069e93a116e070196bebdeb2bd81a125594bf8d89c24aa47c5100000000" +
      "000000cc4aa1e4ed9169ce6a2aca10add5c42403344bf663f2ee331305c1fbe2d143" +
      "5f30e2e761ffff001dd403d9cf0000002031f9392705a56778316db5f838140dbff8" +
      "de02d2c2c5f099408c3bd2000000005fcdedbe9461a3f5904f01678a163b591f6ea2" +
      "6ce4aeb08f7c0bdfedfe687582f7e6e761ffff001d404f6a2700000020789fef6a9c" +
      "5caf73813962bb070c7c378d40242307cb54e5fe61dbe9000000005905c08f1e014c" +
      "96ef92f837824f00e8ed6a6545db78fe3f18307e948f2d87c9c3ebe761ffff001d21" +
      "76f6ad0000002080e187c51265a6bb6619e24b1f5423fb7bf5fcabeeab010dc77bf6" +
      "9700000000a982d9075d9d99d8a3ffe19be24c110eba380e1907c74bf28780ece246" +
      "92d4fe7ff0e761ffff001d704bd68c04e0ff3fdd377d758b7af4373600d5cb9c0dd7" +
      "ec20bccff022dc79f0022d52be00000000132337f9df4ec40c0a2901a5dfc7de4797" +
      "b303523f772ca63b32e037dd89dc1cebf1e7612ac0001ae2efc76804e0ff3fad6889" +
      "40c83f90cbcb3c080965b6afc44a6c740b4057422c2a00000000000000d99ddf51bc" +
      "3db7f1925158f4867fc448a167815e518b54af85348806b4cd45017ef4e7612ac000" +
      "1a9951123f00002020753f88d025d40ffed709cd12af7b5b782f576fcf530eacb15d" +
      "00000000000000581ccc12812f2ca90724e44fef727ed58fe02e597b953785b45cd2" +
      "5bf5f41eae3af9e761ffff001d1cd7d5b3",
  },

  chainDifficulty: 1,
}
