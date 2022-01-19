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

export const SingleP2SHSweepTestData: SweepTestData = {
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
