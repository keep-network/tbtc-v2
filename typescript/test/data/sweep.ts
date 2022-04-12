import {
  DecomposedRawTransaction,
  Proof,
  Transaction,
  RawTransaction,
  UnspentTransactionOutput,
  TransactionMerkleBranch,
} from "../../src/bitcoin"
import { DepositData } from "../deposit"
import { BigNumber } from "ethers"

export const NO_MAIN_UTXO = {
  transactionHash: "",
  outputIndex: 0,
  value: 0,
  transactionHex: "",
}

/**
 * Represents data for tests of assembling sweep transactions.
 */
export interface SweepTestData {
  deposits: {
    utxo: UnspentTransactionOutput & RawTransaction
    data: DepositData
  }[]
  mainUtxo: UnspentTransactionOutput & RawTransaction
  expectedSweep: {
    transactionHash: string
    transaction: RawTransaction
  }
}

export const sweepWithNoMainUtxo: SweepTestData = {
  deposits: [
    {
      utxo: {
        transactionHash:
          "74d0e353cdba99a6c17ce2cfeab62a26c09b5eb756eccdcfb83dbc12e67b18bc",
        outputIndex: 0,
        value: 25000,
        transactionHex:
          "01000000000101d9fdf44eb0874a31a462dc0aedce55c0b5be6d20956b4cdfbe1c16" +
          "761f7c4aa60100000000ffffffff02a86100000000000017a9143ec459d0f3c29286" +
          "ae5df5fcc421e2786024277e8716a1110000000000160014e257eccafbc07c381642" +
          "ce6e7e55120fb077fbed0247304402204e779706c5134032f6be73633a4d32de0841" +
          "54a7fd16c82810325584eea6406a022068bf855004476b8776f5a902a4d518a486ff" +
          "7ebc6dc12fc31cd94e3e9b4220bb0121039d61d62dcd048d3f8550d22eb90b4af908" +
          "db60231d117aeede04e7bc11907bfa00000000",
      },
      data: {
        ethereumAddress: "0x934B98637cA318a4D6E7CA6ffd1690b8e77df637",
        amount: BigNumber.from(25000),
        refundPublicKey:
          "039d61d62dcd048d3f8550d22eb90b4af908db60231d117aeede04e7bc11907bfa",
        blindingFactor: BigNumber.from("0xf9f0c90d00039523"),
        createdAt: 1641650400,
      },
    },
    {
      utxo: {
        transactionHash:
          "5c54ecdf946382fab2236f78423ddc22a757776fb8492671c588667b737e55dc",
        outputIndex: 0,
        value: 12000,
        transactionHex:
          "01000000000101a0367a0790e3dfc199df34ca9ce5c35591510b6525d2d586916672" +
          "8a5ed554be0100000000ffffffff02e02e00000000000022002086a303cdd2e2eab1" +
          "d1679f1a813835dc5a1b65321077cdccaf08f98cbf04ca962c2c1100000000001600" +
          "14e257eccafbc07c381642ce6e7e55120fb077fbed0247304402206dafd502aac9d4" +
          "d542416664063533b1fed1d16877f0295740e1b09ec2abe05102200be28d9dd76863" +
          "796addef4b9595aad23b2e9363ac2d64f75c21beb0e2ade5df0121039d61d62dcd04" +
          "8d3f8550d22eb90b4af908db60231d117aeede04e7bc11907bfa00000000",
      },
      data: {
        ethereumAddress: "0x934B98637cA318a4D6E7CA6ffd1690b8e77df637",
        amount: BigNumber.from(12000),
        refundPublicKey:
          "039d61d62dcd048d3f8550d22eb90b4af908db60231d117aeede04e7bc11907bfa",
        blindingFactor: BigNumber.from("0xf9f0c90d00039523"),
        createdAt: 1641650400,
      },
    },
  ],
  mainUtxo: NO_MAIN_UTXO,
  expectedSweep: {
    transactionHash:
      "f8eaf242a55ea15e602f9f990e33f67f99dfbe25d1802bbde63cc1caabf99668",
    transaction: {
      transactionHex:
        "01000000000102bc187be612bc3db8cfcdec56b75e9bc0262ab6eacfe27cc1a699" +
        "bacd53e3d07400000000c948304502210089a89aaf3fec97ac9ffa91cdff59829f" +
        "0cb3ef852a468153e2c0e2b473466d2e022072902bb923ef016ac52e941ced78f8" +
        "16bf27991c2b73211e227db27ec200bc0a012103989d253b17a6a0f41838b84ff0" +
        "d20e8898f9d7b1a98f2564da4cc29dcf8581d94c5c14934b98637ca318a4d6e7ca" +
        "6ffd1690b8e77df6377508f9f0c90d000395237576a9148db50eb52063ea9d98b3" +
        "eac91489a90f738986f68763ac6776a914e257eccafbc07c381642ce6e7e55120f" +
        "b077fbed8804e0250162b175ac68ffffffffdc557e737b6688c5712649b86f7757" +
        "a722dc3d42786f23b2fa826394dfec545c0000000000ffffffff01488a00000000" +
        "00001600148db50eb52063ea9d98b3eac91489a90f738986f60003473044022037" +
        "47f5ee31334b11ebac6a2a156b1584605de8d91a654cd703f9c843863499740220" +
        "2059d680211776f93c25636266b02e059ed9fcc6209f7d3d9926c49a0d8750ed01" +
        "2103989d253b17a6a0f41838b84ff0d20e8898f9d7b1a98f2564da4cc29dcf8581" +
        "d95c14934b98637ca318a4d6e7ca6ffd1690b8e77df6377508f9f0c90d00039523" +
        "7576a9148db50eb52063ea9d98b3eac91489a90f738986f68763ac6776a914e257" +
        "eccafbc07c381642ce6e7e55120fb077fbed8804e0250162b175ac6800000000",
    },
  },
}

export const sweepWithMainUtxo: SweepTestData = {
  deposits: [
    {
      // P2SH deposit
      utxo: {
        transactionHash:
          "d4fe2ef9068d039eae2210e893db518280d4757696fe9db8f3c696a94de90aed",
        outputIndex: 0,
        value: 17000,
        transactionHex:
          "01000000000101e37f552fc23fa0032bfd00c8eef5f5c22bf85fe4c6e735857719ff" +
          "8a4ff66eb80100000000ffffffff02684200000000000017a9143ec459d0f3c29286" +
          "ae5df5fcc421e2786024277e8742b7100000000000160014e257eccafbc07c381642" +
          "ce6e7e55120fb077fbed0248304502210084eb60347b9aa48d9a53c6ab0fc2c2357a" +
          "0df430d193507facfb2238e46f034502202a29d11e128dba3ff3a8ad9a1e820a3b58" +
          "e89e37fa90d1cc2b3f05207599fef00121039d61d62dcd048d3f8550d22eb90b4af9" +
          "08db60231d117aeede04e7bc11907bfa00000000",
      },
      data: {
        ethereumAddress: "0x934B98637cA318a4D6E7CA6ffd1690b8e77df637",
        amount: BigNumber.from(17000),
        refundPublicKey:
          "039d61d62dcd048d3f8550d22eb90b4af908db60231d117aeede04e7bc11907bfa",
        blindingFactor: BigNumber.from("0xf9f0c90d00039523"),
        createdAt: 1641650400,
      },
    },
    {
      // P2WSH deposit
      utxo: {
        transactionHash:
          "b86ef64f8aff19778535e7c6e45ff82bc2f5f5eec800fd2b03a03fc22f557fe3",
        outputIndex: 0,
        value: 10000,
        transactionHex:
          "01000000000101dc557e737b6688c5712649b86f7757a722dc3d42786f23b2fa8263" +
          "94dfec545c0100000000ffffffff02102700000000000022002086a303cdd2e2eab1" +
          "d1679f1a813835dc5a1b65321077cdccaf08f98cbf04ca962cff1000000000001600" +
          "14e257eccafbc07c381642ce6e7e55120fb077fbed02473044022050759dde2c84bc" +
          "cf3c1502b0e33a6acb570117fd27a982c0c2991c9f9737508e02201fcba5d6f6c0ab" +
          "780042138a9110418b3f589d8d09a900f20ee28cfcdb14d2970121039d61d62dcd04" +
          "8d3f8550d22eb90b4af908db60231d117aeede04e7bc11907bfa00000000",
      },
      data: {
        ethereumAddress: "0x934B98637cA318a4D6E7CA6ffd1690b8e77df637",
        amount: BigNumber.from(10000),
        refundPublicKey:
          "039d61d62dcd048d3f8550d22eb90b4af908db60231d117aeede04e7bc11907bfa",
        blindingFactor: BigNumber.from("0xf9f0c90d00039523"),
        createdAt: 1641650400,
      },
    },
  ],
  mainUtxo: {
    // P2WKH
    transactionHash:
      "f8eaf242a55ea15e602f9f990e33f67f99dfbe25d1802bbde63cc1caabf99668",
    outputIndex: 0,
    value: 35400,
    transactionHex:
      "01000000000102bc187be612bc3db8cfcdec56b75e9bc0262ab6eacfe27cc1a699" +
      "bacd53e3d07400000000c948304502210089a89aaf3fec97ac9ffa91cdff59829f" +
      "0cb3ef852a468153e2c0e2b473466d2e022072902bb923ef016ac52e941ced78f8" +
      "16bf27991c2b73211e227db27ec200bc0a012103989d253b17a6a0f41838b84ff0" +
      "d20e8898f9d7b1a98f2564da4cc29dcf8581d94c5c14934b98637ca318a4d6e7ca" +
      "6ffd1690b8e77df6377508f9f0c90d000395237576a9148db50eb52063ea9d98b3" +
      "eac91489a90f738986f68763ac6776a914e257eccafbc07c381642ce6e7e55120f" +
      "b077fbed8804e0250162b175ac68ffffffffdc557e737b6688c5712649b86f7757" +
      "a722dc3d42786f23b2fa826394dfec545c0000000000ffffffff01488a00000000" +
      "00001600148db50eb52063ea9d98b3eac91489a90f738986f60003473044022037" +
      "47f5ee31334b11ebac6a2a156b1584605de8d91a654cd703f9c843863499740220" +
      "2059d680211776f93c25636266b02e059ed9fcc6209f7d3d9926c49a0d8750ed01" +
      "2103989d253b17a6a0f41838b84ff0d20e8898f9d7b1a98f2564da4cc29dcf8581" +
      "d95c14934b98637ca318a4d6e7ca6ffd1690b8e77df6377508f9f0c90d00039523" +
      "7576a9148db50eb52063ea9d98b3eac91489a90f738986f68763ac6776a914e257" +
      "eccafbc07c381642ce6e7e55120fb077fbed8804e0250162b175ac6800000000",
  },
  expectedSweep: {
    transactionHash:
      "435d4aff6d4bc34134877bd3213c17970142fdd04d4113d534120033b9eecb2e",
    transaction: {
      transactionHex:
        "010000000001036896f9abcac13ce6bd2b80d125bedf997ff6330e999f2f605ea1" +
        "5ea542f2eaf80000000000ffffffffed0ae94da996c6f3b89dfe967675d4808251" +
        "db93e81022ae9e038d06f92efed400000000c948304502210092327ddff69a2b8c" +
        "7ae787c5d590a2f14586089e6339e942d56e82aa42052cd902204c0d1700ba1ac6" +
        "17da27fee032a57937c9607f0187199ed3c46954df845643d7012103989d253b17" +
        "a6a0f41838b84ff0d20e8898f9d7b1a98f2564da4cc29dcf8581d94c5c14934b98" +
        "637ca318a4d6e7ca6ffd1690b8e77df6377508f9f0c90d000395237576a9148db5" +
        "0eb52063ea9d98b3eac91489a90f738986f68763ac6776a914e257eccafbc07c38" +
        "1642ce6e7e55120fb077fbed8804e0250162b175ac68ffffffffe37f552fc23fa0" +
        "032bfd00c8eef5f5c22bf85fe4c6e735857719ff8a4ff66eb80000000000ffffff" +
        "ff0180ed0000000000001600148db50eb52063ea9d98b3eac91489a90f738986f6" +
        "02483045022100baf754252d0d6a49aceba7eb0ec40b4cc568e8c659e168b96598" +
        "a11cf56dc078022051117466ee998a3fc72221006817e8cfe9c2e71ad622ff811a" +
        "0bf100d888d49c012103989d253b17a6a0f41838b84ff0d20e8898f9d7b1a98f25" +
        "64da4cc29dcf8581d90003473044022014a535eb334656665ac69a678dbf7c019c" +
        "4f13262e9ea4d195c61a00cd5f698d022023c0062913c4614bdff07f94475ceb4c" +
        "585df53f71611776c3521ed8f8785913012103989d253b17a6a0f41838b84ff0d2" +
        "0e8898f9d7b1a98f2564da4cc29dcf8581d95c14934b98637ca318a4d6e7ca6ffd" +
        "1690b8e77df6377508f9f0c90d000395237576a9148db50eb52063ea9d98b3eac9" +
        "1489a90f738986f68763ac6776a914e257eccafbc07c381642ce6e7e55120fb077" +
        "fbed8804e0250162b175ac6800000000",
    },
  },
}

/**
 * Represents data for tests of assembling sweep proofs.
 */
export interface SweepProofTestData {
  bitcoinChainData: {
    transaction: Transaction
    rawTransaction: RawTransaction
    accumulatedTxConfirmations: number
    latestBlockHeight: number
    headersChain: string
    transactionMerkleBranch: TransactionMerkleBranch
  }
  expectedSweepProof: {
    sweepTx: DecomposedRawTransaction
    sweepProof: Proof
    mainUtxo: UnspentTransactionOutput
  }
}

/**
 * Test data that is based on a Bitcoin testnet transaction with multiple inputs
 * https://live.blockcypher.com/btc-testnet/tx/5083822ed0b8d0bc661362b778e666cb572ff6d5152193992dd69d3207995753/
 */
export const sweepProof: SweepProofTestData = {
  bitcoinChainData: {
    transaction: {
      transactionHash:
        "5083822ed0b8d0bc661362b778e666cb572ff6d5152193992dd69d3207995753",
      inputs: [
        {
          transactionHash:
            "ea4d9e45f8c1b8a187c007f36ba1e9b201e8511182c7083c4edcaf9325b2998f",
          outputIndex: 0,
          scriptSig: { asm: "", hex: "" },
        },
        {
          transactionHash:
            "c844ff4c1781c884bb5e80392398b81b984d7106367ae16675f132bd1a7f33fd",
          outputIndex: 0,
          scriptSig: { asm: "", hex: "" },
        },
        {
          transactionHash:
            "44c568bc0eac07a2a9c2b46829be5b5d46e7d00e17bfb613f506a75ccf86a473",
          outputIndex: 0,
          scriptSig: { asm: "", hex: "" },
        },
        {
          transactionHash:
            "f548c00e464764e112826450a00cf005ca771a6108a629b559b6c60a519e4378",
          outputIndex: 0,
          scriptSig: { asm: "", hex: "" },
        },
      ],
      outputs: [
        {
          outputIndex: 0,
          value: 39800,
          scriptPubKey: {
            asm: "OP_0 8db50eb52063ea9d98b3eac91489a90f738986f6",
            hex: "00148db50eb52063ea9d98b3eac91489a90f738986f6",
            type: "WITNESSPUBKEYHASH",
            reqSigs: 1,
            addresses: ["tb1q3k6sadfqv04fmx9naty3fzdfpaecnphkfm3cf3"],
          },
        },
      ],
    },
    accumulatedTxConfirmations: 50,
    rawTransaction: {
      transactionHex:
        "010000000001048f99b22593afdc4e3c08c7821151e801b2e9a16bf307c087a1" +
        "b8c1f8459e4dea00000000c9483045022100bb54f2717647b2f2c5370b5f12b5" +
        "5e27f97a6e2009dcd21fca08527df949e1fd022058bc3cd1dd739b89b9e4cda4" +
        "3b13bc59cfb15663b80cbfa3edb4539107bba35d012103989d253b17a6a0f418" +
        "38b84ff0d20e8898f9d7b1a98f2564da4cc29dcf8581d94c5c14934b98637ca3" +
        "18a4d6e7ca6ffd1690b8e77df6377508f9f0c90d000395237576a9148db50eb5" +
        "2063ea9d98b3eac91489a90f738986f68763ac6776a914e257eccafbc07c3816" +
        "42ce6e7e55120fb077fbed8804e0250162b175ac68fffffffffd337f1abd32f1" +
        "7566e17a3606714d981bb8982339805ebb84c881174cff44c80000000000ffff" +
        "ffff73a486cf5ca706f513b6bf170ed0e7465d5bbe2968b4c2a9a207ac0ebc68" +
        "c5440000000000ffffffff78439e510ac6b659b529a608611a77ca05f00ca050" +
        "648212e16447460ec048f50000000000ffffffff01789b000000000000160014" +
        "8db50eb52063ea9d98b3eac91489a90f738986f6000347304402205199b28a3b" +
        "4a81579fe4ea99925380b298e28ca38a3b14e50f12daec87945449022065c503" +
        "4f96ed785aa10b3817c501ecc59f1abf329fad07229170c3dd5f53bc91012103" +
        "989d253b17a6a0f41838b84ff0d20e8898f9d7b1a98f2564da4cc29dcf8581d9" +
        "5c14934b98637ca318a4d6e7ca6ffd1690b8e77df6377508f9f0c90d00039523" +
        "7576a9148db50eb52063ea9d98b3eac91489a90f738986f68763ac6776a914e2" +
        "57eccafbc07c381642ce6e7e55120fb077fbed8804e0250162b175ac68024730" +
        "4402201b2a3b03a1088c6bbc406e96a6017e52ce86c0897541c9bb59d94179da" +
        "a84f8702204b1e665bd43bbe968e1d89b15c5f0b5551011fa4caf2fbb7eb22d8" +
        "9a38fad04d012103989d253b17a6a0f41838b84ff0d20e8898f9d7b1a98f2564" +
        "da4cc29dcf8581d903473044022007ce54f21a2f5233bd046c4600bcb1c874aa" +
        "f9053b1d7ee7d47eb134b695fbed022002e8684548b7a3cdaecb8c6393244c39" +
        "6c15e1ebaedb53e2fcc6c5cea7310490012103989d253b17a6a0f41838b84ff0" +
        "d20e8898f9d7b1a98f2564da4cc29dcf8581d95c14934b98637ca318a4d6e7ca" +
        "6ffd1690b8e77df6377508f9f0c90d000395237576a9148db50eb52063ea9d98" +
        "b3eac91489a90f738986f68763ac6776a914e257eccafbc07c381642ce6e7e55" +
        "120fb077fbed8804e0250162b175ac6800000000",
    },
    latestBlockHeight: 2164335,
    headersChain:
      "04000020642125b3910fdaead521b57955e28893d89f8ce7fd3ba1dd6d0100000" +
      "0000000f9e17a266a2267ee02d5ab82a75a76805db821a13abd2e80e0950d8833" +
      "11e5355dc21c62ed3e031adefc02c4040000205b6de55e069be71b21a62cd140d" +
      "c7031225f7258dc758f19ea01000000000000139966d27d9ed0c0c1ed9162c2fe" +
      "a2ccf0ba212706f6bc421d0a2b6211de040d1ac41c62ed3e031a4726538f04e00" +
      "0208475e15e0314635d32abf04c761fee528d6a3f2db3b3d13798000000000000" +
      "002a3fa06fecd9dd4bf2e25e22a95d4f65435d5c5b42bcf498b4e756f9f4ea67c" +
      "ea1c51c62ed3e031a9d7bf3ac000000203f16d450c51853a4cd9569d225028aa0" +
      "8ab6139eee31f4f67a010000000000004cda79bc48b970de2fb29c3f38626eb9d" +
      "70d8bae7b92aad09f2a0ad2d2f334d35bca1c62ffff001d048fc2170000002068" +
      "7e487acbf5eb375c631a15127fbf7d80ca084461e7f26f92c509b6000000006fa" +
      "d33bd7c8d651bd6dc86c286f0a99340b668f019b9e97a59fd392c36c4f46910cf" +
      "1c62ffff001d407facaa0400002040f4c65610f26f06c4365305b956934501713" +
      "e01c2fc08b919e0bc1b00000000e401a6a884ba015e83c6fe2cd363e877ef0398" +
      "2e81eaff4e2c95af1e23a670f407d41c62ffff001d58c64d180400002038854bd" +
      "62f802e1de14653eceeb7a80290f5e99b8e9db517e36f000000000000a494b803" +
      "4039e7855b75563ab83c9410dd67e89bb58e6cd93b85290a885dd749f4d61c62e" +
      "d3e031ad9a83746",
    transactionMerkleBranch: {
      blockHeight: 2164155,
      merkle: [
        "322cfdf3ca53cf597b6f08e93489b9a1cfa1f5958c3657474b0d8f5efb5ca92e",
        "82aedffef6c9670375effee25740fecce143d21f8abf98307235b7ebd31ad4d1",
        "837fa041b9a8f5b42353fdf8981e3b7a78c61858852e43058bfe6cacf9eab5a3",
        "a51612d3f3f857e95803a4d86aa6dbbe2e756dc2ed6cc0e04630e8baf597e377",
        "a00501650e0c4f8a1e07a5d6d5bc5e75e4c75de61a65f0410cce354bbae78686",
      ],
      position: 6,
    },
  },
  expectedSweepProof: {
    sweepTx: {
      version: "01000000",
      inputs:
        "048f99b22593afdc4e3c08c7821151e801b2e9a16bf307c087a1b8c1f8459e4dea0" +
        "0000000c9483045022100bb54f2717647b2f2c5370b5f12b55e27f97a6e2009dcd2" +
        "1fca08527df949e1fd022058bc3cd1dd739b89b9e4cda43b13bc59cfb15663b80cb" +
        "fa3edb4539107bba35d012103989d253b17a6a0f41838b84ff0d20e8898f9d7b1a9" +
        "8f2564da4cc29dcf8581d94c5c14934b98637ca318a4d6e7ca6ffd1690b8e77df63" +
        "77508f9f0c90d000395237576a9148db50eb52063ea9d98b3eac91489a90f738986" +
        "f68763ac6776a914e257eccafbc07c381642ce6e7e55120fb077fbed8804e025016" +
        "2b175ac68fffffffffd337f1abd32f17566e17a3606714d981bb8982339805ebb84" +
        "c881174cff44c80000000000ffffffff73a486cf5ca706f513b6bf170ed0e7465d5" +
        "bbe2968b4c2a9a207ac0ebc68c5440000000000ffffffff78439e510ac6b659b529" +
        "a608611a77ca05f00ca050648212e16447460ec048f50000000000ffffffff",
      outputs:
        "01789b0000000000001600148db50eb52063ea9d98b3eac91489a90f738986f6",
      locktime: "00000000",
    },
    sweepProof: {
      merkleProof:
        "2ea95cfb5e8f0d4b4757368c95f5a1cfa1b98934e9086f7b59cf53caf3fd2c32d1d" +
        "41ad3ebb735723098bf8a1fd243e1ccfe4057e2feef750367c9f6fedfae82a3b5ea" +
        "f9ac6cfe8b05432e855818c6787a3b1e98f8fd5323b4f5a8b941a07f8377e397f5b" +
        "ae83046e0c06cedc26d752ebedba66ad8a40358e957f8f3d31216a58686e7ba4b35" +
        "ce0c41f0651ae65dc7e4755ebcd5d6a5071e8a4f0c0e650105a0",
      txIndexInBlock: 6,
      bitcoinHeaders:
        "04000020642125b3910fdaead521b57955e28893d89f8ce7fd3ba1dd6d010000000" +
        "00000f9e17a266a2267ee02d5ab82a75a76805db821a13abd2e80e0950d883311e5" +
        "355dc21c62ed3e031adefc02c4040000205b6de55e069be71b21a62cd140dc70312" +
        "25f7258dc758f19ea01000000000000139966d27d9ed0c0c1ed9162c2fea2ccf0ba" +
        "212706f6bc421d0a2b6211de040d1ac41c62ed3e031a4726538f04e000208475e15" +
        "e0314635d32abf04c761fee528d6a3f2db3b3d13798000000000000002a3fa06fec" +
        "d9dd4bf2e25e22a95d4f65435d5c5b42bcf498b4e756f9f4ea67cea1c51c62ed3e0" +
        "31a9d7bf3ac000000203f16d450c51853a4cd9569d225028aa08ab6139eee31f4f6" +
        "7a010000000000004cda79bc48b970de2fb29c3f38626eb9d70d8bae7b92aad09f2" +
        "a0ad2d2f334d35bca1c62ffff001d048fc21700000020687e487acbf5eb375c631a" +
        "15127fbf7d80ca084461e7f26f92c509b6000000006fad33bd7c8d651bd6dc86c28" +
        "6f0a99340b668f019b9e97a59fd392c36c4f46910cf1c62ffff001d407facaa0400" +
        "002040f4c65610f26f06c4365305b956934501713e01c2fc08b919e0bc1b0000000" +
        "0e401a6a884ba015e83c6fe2cd363e877ef03982e81eaff4e2c95af1e23a670f407" +
        "d41c62ffff001d58c64d180400002038854bd62f802e1de14653eceeb7a80290f5e" +
        "99b8e9db517e36f000000000000a494b8034039e7855b75563ab83c9410dd67e89b" +
        "b58e6cd93b85290a885dd749f4d61c62ed3e031ad9a83746",
    },
    mainUtxo: NO_MAIN_UTXO,
  },
}
