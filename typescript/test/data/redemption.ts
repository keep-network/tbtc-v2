import { BigNumber } from "ethers"
import { RawTransaction, UnspentTransactionOutput } from "../../src/bitcoin"
import { RedemptionRequest } from "../redemption"

export const testnetWalletPrivateKey =
  "cRk1zdau3jp2X3XsrRKDdviYLuC32fHfyU186wLBEbZWx4uQWW3v"

export interface RedemptionTestData {
  mainUtxo: UnspentTransactionOutput & RawTransaction
  redemptionRequests: RedemptionRequest[]
  witness: boolean
  expectedRedemption: {
    transactionHash: string
    transaction: RawTransaction
  }
}

export const singleP2PKHAddressRedemption: RedemptionTestData = {
  mainUtxo: {
    transactionHash:
      "523e4bfb71804e5ed3b76c8933d733339563e560311c1bf835934ee7aae5db20",
    outputIndex: 1,
    value: 1481680,
    transactionHex:
      "0100000000010160d264b34e51e6567254bcaf4cc67e1e069483f4249dc50784eae68" +
      "2645fd11d0100000000ffffffff02d84000000000000022002086a303cdd2e2eab1d1" +
      "679f1a813835dc5a1b65321077cdccaf08f98cbf04ca96d09b1600000000001600148" +
      "db50eb52063ea9d98b3eac91489a90f738986f602483045022100ed5fa06ea5e9d4a9" +
      "f0cf0df86a2cd473f693e5bda3d808ba82b04ee26d72b73f0220648f4d7bb25be7819" +
      "22349d382cf0f32ffcbbf89c483776472c2d15644a48d67012103989d253b17a6a0f4" +
      "1838b84ff0d20e8898f9d7b1a98f2564da4cc29dcf8581d900000000",
  },
  redemptionRequests: [
    {
      // testnet P2PKH address
      address: "mmTeMR8RKu6QzMGTG4ipA71uewm3EuJng5",
      amount: BigNumber.from(10000),
      feeShare: BigNumber.from(1600),
      treasuryFee: BigNumber.from(1000),
    },
  ],
  witness: true,
  expectedRedemption: {
    transactionHash:
      "c437f1117db977682334b53a71fbe63a42aab42f6e0976c35b69977f86308c20",
    transaction: {
      transactionHex:
        "0100000000010120dbe5aae74e9335f81b1c3160e563953333d733896cb7d35e4e80" +
        "71fb4b3e520100000000ffffffff02e81c0000000000001976a9144130879211c54d" +
        "f460e484ddf9aac009cb38ee7488aca8781600000000001600148db50eb52063ea9d" +
        "98b3eac91489a90f738986f602483045022100e1bcecbf3c6fc9a4ce2fc8029264d9" +
        "8a1bef4ff3d590816532097fbb93b7fdfb02206bca6c7af1db4c70d4d2c819eeb4c8" +
        "430a291f5fe874c73c8f44acdd06c25d33012103989d253b17a6a0f41838b84ff0d2" +
        "0e8898f9d7b1a98f2564da4cc29dcf8581d900000000",
    },
  },
}

export const singleP2WPKHAddressRedemption: RedemptionTestData = {
  mainUtxo: {
    transactionHash:
      "c437f1117db977682334b53a71fbe63a42aab42f6e0976c35b69977f86308c20",
    outputIndex: 1,
    value: 1472680,
    transactionHex:
      "0100000000010120dbe5aae74e9335f81b1c3160e563953333d733896cb7d35e4e807" +
      "1fb4b3e520100000000ffffffff02e81c0000000000001976a9144130879211c54df4" +
      "60e484ddf9aac009cb38ee7488aca8781600000000001600148db50eb52063ea9d98b" +
      "3eac91489a90f738986f602483045022100e1bcecbf3c6fc9a4ce2fc8029264d98a1b" +
      "ef4ff3d590816532097fbb93b7fdfb02206bca6c7af1db4c70d4d2c819eeb4c8430a2" +
      "91f5fe874c73c8f44acdd06c25d33012103989d253b17a6a0f41838b84ff0d20e8898" +
      "f9d7b1a98f2564da4cc29dcf8581d900000000",
  },
  redemptionRequests: [
    {
      // testnet P2WPKH address
      address: "tb1qgycg0ys3c4xlgc8ysnwln2kqp89n3mn5ts7z3l",
      amount: BigNumber.from(15000),
      feeShare: BigNumber.from(1700),
      treasuryFee: BigNumber.from(1100),
    },
  ],
  witness: true,
  expectedRedemption: {
    transactionHash:
      "925e61dc31396e7f2cbcc8bc9b4009b4f24ba679257762df078b7e9b875ea110",
    transaction: {
      transactionHex:
        "01000000000101208c30867f97695bc376096e2fb4aa423ae6fb713ab534236877b9" +
        "7d11f137c40100000000ffffffff02a82f0000000000001600144130879211c54df4" +
        "60e484ddf9aac009cb38ee745c421600000000001600148db50eb52063ea9d98b3ea" +
        "c91489a90f738986f602483045022100ee8273dd93e85e8a0e0055498803335a370e" +
        "3d25c51ad2890f0b61294e884e8702204ebf3e04161b8172fbdf6070f7b1f22097f3" +
        "d87c0bd32bc53a786971776e7b45012103989d253b17a6a0f41838b84ff0d20e8898" +
        "f9d7b1a98f2564da4cc29dcf8581d900000000",
    },
  },
}

export const singleP2SHAddressRedemption: RedemptionTestData = {
  mainUtxo: {
    transactionHash:
      "925e61dc31396e7f2cbcc8bc9b4009b4f24ba679257762df078b7e9b875ea110",
    outputIndex: 1,
    value: 1458780,
    transactionHex:
      "01000000000101208c30867f97695bc376096e2fb4aa423ae6fb713ab534236877b9" +
      "7d11f137c40100000000ffffffff02a82f0000000000001600144130879211c54df4" +
      "60e484ddf9aac009cb38ee745c421600000000001600148db50eb52063ea9d98b3ea" +
      "c91489a90f738986f602483045022100ee8273dd93e85e8a0e0055498803335a370e" +
      "3d25c51ad2890f0b61294e884e8702204ebf3e04161b8172fbdf6070f7b1f22097f3" +
      "d87c0bd32bc53a786971776e7b45012103989d253b17a6a0f41838b84ff0d20e8898" +
      "f9d7b1a98f2564da4cc29dcf8581d900000000",
  },
  redemptionRequests: [
    {
      // testnet P2SH address
      address: "2Mxy76sc1qAxiJ1fXMXDXqHvVcPLh6Lf12C",
      amount: BigNumber.from(13000),
      feeShare: BigNumber.from(1700),
      treasuryFee: BigNumber.from(800),
    },
  ],
  witness: true,
  expectedRedemption: {
    transactionHash:
      "ef25c9c8f4df673def035c0c1880278c90030b3c94a56668109001a591c2c521",
    transaction: {
      transactionHex:
        "0100000000010110a15e879b7e8b07df62772579a64bf2b409409bbcc8bc2c7f6e3" +
        "931dc615e920100000000ffffffff02042900000000000017a9143ec459d0f3c292" +
        "86ae5df5fcc421e2786024277e87b4121600000000001600148db50eb52063ea9d9" +
        "8b3eac91489a90f738986f6024830450221009740ad12d2e74c00ccb4741d533d2e" +
        "cd6902289144c4626508afb61eed790c97022006e67179e8e2a63dc4f1ab758867d" +
        "8bbfe0a2b67682be6dadfa8e07d3b7ba04d012103989d253b17a6a0f41838b84ff0" +
        "d20e8898f9d7b1a98f2564da4cc29dcf8581d900000000",
    },
  },
}

export const singleP2WSHAddressRedemption: RedemptionTestData = {
  mainUtxo: {
    transactionHash:
      "ef25c9c8f4df673def035c0c1880278c90030b3c94a56668109001a591c2c521",
    outputIndex: 1,
    value: 1446580,
    transactionHex:
      "0100000000010110a15e879b7e8b07df62772579a64bf2b409409bbcc8bc2c7f6e3" +
      "931dc615e920100000000ffffffff02042900000000000017a9143ec459d0f3c292" +
      "86ae5df5fcc421e2786024277e87b4121600000000001600148db50eb52063ea9d9" +
      "8b3eac91489a90f738986f6024830450221009740ad12d2e74c00ccb4741d533d2e" +
      "cd6902289144c4626508afb61eed790c97022006e67179e8e2a63dc4f1ab758867d" +
      "8bbfe0a2b67682be6dadfa8e07d3b7ba04d012103989d253b17a6a0f41838b84ff0" +
      "d20e8898f9d7b1a98f2564da4cc29dcf8581d900000000",
  },
  redemptionRequests: [
    {
      // testnet P2WSH address
      address: "tb1qs63s8nwjut4tr5t8nudgzwp4m3dpkefjzpmumn90pruce0cye2tq2jkq0y",
      amount: BigNumber.from(18000),
      feeShare: BigNumber.from(1400),
      treasuryFee: BigNumber.from(1000),
    },
  ],
  witness: true,
  expectedRedemption: {
    transactionHash:
      "3d28bb5bf73379da51bc683f4d0ed31d7b024466c619d80ebd9378077d900be3",
    transaction: {
      transactionHex:
        "0100000000010121c5c291a50190106866a5943c0b03908c2780180c5c03ef3d67d" +
        "ff4c8c925ef0100000000ffffffff02f03c00000000000022002086a303cdd2e2ea" +
        "b1d1679f1a813835dc5a1b65321077cdccaf08f98cbf04ca964cd01500000000001" +
        "600148db50eb52063ea9d98b3eac91489a90f738986f602483045022100bef6177f" +
        "72f434248271cf5d18c1ce6add52dcf533ddda215240a858cb63cd070220016a68c" +
        "457f84f01108e1b001e8f81a9b073a3e08511265614318fa0d395ef4d012103989d" +
        "253b17a6a0f41838b84ff0d20e8898f9d7b1a98f2564da4cc29dcf8581d900000000",
    },
  },
}

export const multipleAddressesRedemption: RedemptionTestData = {
  mainUtxo: {
    transactionHash:
      "3d28bb5bf73379da51bc683f4d0ed31d7b024466c619d80ebd9378077d900be3",
    outputIndex: 1,
    value: 1429580,
    transactionHex:
      "0100000000010121c5c291a50190106866a5943c0b03908c2780180c5c03ef3d67d" +
      "ff4c8c925ef0100000000ffffffff02f03c00000000000022002086a303cdd2e2ea" +
      "b1d1679f1a813835dc5a1b65321077cdccaf08f98cbf04ca964cd01500000000001" +
      "600148db50eb52063ea9d98b3eac91489a90f738986f602483045022100bef6177f" +
      "72f434248271cf5d18c1ce6add52dcf533ddda215240a858cb63cd070220016a68c" +
      "457f84f01108e1b001e8f81a9b073a3e08511265614318fa0d395ef4d012103989d" +
      "253b17a6a0f41838b84ff0d20e8898f9d7b1a98f2564da4cc29dcf8581d900000000",
  },
  redemptionRequests: [
    {
      // P2PKH address
      address: "mmTeMR8RKu6QzMGTG4ipA71uewm3EuJng5",
      amount: BigNumber.from(18000),
      feeShare: BigNumber.from(1100),
      treasuryFee: BigNumber.from(1000),
    },
    {
      // P2WPKH address
      address: "tb1qgycg0ys3c4xlgc8ysnwln2kqp89n3mn5ts7z3l",
      amount: BigNumber.from(13000),
      feeShare: BigNumber.from(900),
      treasuryFee: BigNumber.from(800),
    },
    {
      // P2SH address
      address: "2Mxy76sc1qAxiJ1fXMXDXqHvVcPLh6Lf12C",
      amount: BigNumber.from(12000),
      feeShare: BigNumber.from(1000),
      treasuryFee: BigNumber.from(1100),
    },
    {
      // P2WSH address
      address: "tb1qs63s8nwjut4tr5t8nudgzwp4m3dpkefjzpmumn90pruce0cye2tq2jkq0y",
      amount: BigNumber.from(15000),
      feeShare: BigNumber.from(1400),
      treasuryFee: BigNumber.from(700),
    },
  ],
  witness: true,
  expectedRedemption: {
    transactionHash:
      "f70ff89fd2b6226183e4b8143cc5f0f457f05dd1dca0c6151ab66f4523d972b7",
    transaction: {
      transactionHex:
        "01000000000101e30b907d077893bd0ed819c66644027b1dd30e4d3f68bc51da793" +
        "3f75bbb283d0100000000ffffffff051c3e0000000000001976a9144130879211c5" +
        "4df460e484ddf9aac009cb38ee7488ac242c0000000000001600144130879211c54" +
        "df460e484ddf9aac009cb38ee74ac2600000000000017a9143ec459d0f3c29286ae" +
        "5df5fcc421e2786024277e87643200000000000022002086a303cdd2e2eab1d1679" +
        "f1a813835dc5a1b65321077cdccaf08f98cbf04ca96ccfb1400000000001600148d" +
        "b50eb52063ea9d98b3eac91489a90f738986f602483045022100adc5b0cffc65444" +
        "cf16873eb57cb702414ee36ca907ad3cf57676abe83c0f80502204a206d9b55eeee" +
        "05d9647e95d15ed5143eaad6cc8c5bc2c1919b69addc18db29012103989d253b17a" +
        "6a0f41838b84ff0d20e8898f9d7b1a98f2564da4cc29dcf8581d900000000",
    },
  },
}

export const noChangeRedemption: RedemptionTestData = {
  mainUtxo: {
    transactionHash:
      "7dd38b48cb626580d317871c5b716eaf4a952ceb67ba3aa4ca76e3dc7cdcc65b",
    outputIndex: 1,
    value: 10000,
    transactionHex:
      "02000000000101c17208c443a3d3d2223884ef11ac83dadb1a3abe4d3474694414c8d" +
      "cd3c697510100000000feffffff0224d38a5b0000000016001414c829f9d1770ebab9" +
      "8bd1acb39e428cffe7580310270000000000001600148db50eb52063ea9d98b3eac91" +
      "489a90f738986f60247304402205d71cd954aa20b9c04266999baa8b2e1f04b7ecf41" +
      "9d48775ec78b81c3dbf6d5022076eb8cfc0f2fbd6178fdec4039570a1404c76fca4b7" +
      "2f6a34706b9c9c801ff7b0121033483097979eaff12af144dde368235592893fc2cb7" +
      "477c3c4e34a0770f01f4e071832100",
  },
  redemptionRequests: [
    {
      // P2PKH
      address: "mmTeMR8RKu6QzMGTG4ipA71uewm3EuJng5",
      amount: BigNumber.from(6000),
      feeShare: BigNumber.from(800),
      treasuryFee: BigNumber.from(0),
    },
    {
      // P2WPKH
      address: "tb1qf0ulldawp79s7knz9v254j5zjyn0demfx2d0xx",
      amount: BigNumber.from(4000),
      feeShare: BigNumber.from(900),
      treasuryFee: BigNumber.from(0),
    },
  ],
  witness: true,
  expectedRedemption: {
    transactionHash:
      "afcdf8f91273b73abc40018873978c22bbb7c3d8d669ef2faffa0c4b0898c8eb",
    transaction: {
      transactionHex:
        "010000000001015bc6dc7cdce376caa43aba67eb2c954aaf6e715b1c8717d380656" +
        "2cb488bd37d0100000000ffffffff0250140000000000001976a9144130879211c5" +
        "4df460e484ddf9aac009cb38ee7488ac1c0c0000000000001600144bf9ffb7ae0f8" +
        "b0f5a622b154aca829126f6e76902473044022077174ae4d0a8e9d802f45b1a67cb" +
        "4079abbbc4f110919b2e6b67fc991326e0ca02206efb3d36a58f48d123e845fd868" +
        "593af27e905adecb261d0120ba5b05ccc96fd012103989d253b17a6a0f41838b84f" +
        "f0d20e8898f9d7b1a98f2564da4cc29dcf8581d900000000",
    },
  },
}

export const p2PKHChangeRedemption: RedemptionTestData = {
  mainUtxo: {
    transactionHash:
      "f70ff89fd2b6226183e4b8143cc5f0f457f05dd1dca0c6151ab66f4523d972b7",
    outputIndex: 4,
    value: 1375180,
    transactionHex:
      "01000000000101e30b907d077893bd0ed819c66644027b1dd30e4d3f68bc51da7933f" +
      "75bbb283d0100000000ffffffff051c3e0000000000001976a9144130879211c54df4" +
      "60e484ddf9aac009cb38ee7488ac242c0000000000001600144130879211c54df460e" +
      "484ddf9aac009cb38ee74ac2600000000000017a9143ec459d0f3c29286ae5df5fcc4" +
      "21e2786024277e87643200000000000022002086a303cdd2e2eab1d1679f1a813835d" +
      "c5a1b65321077cdccaf08f98cbf04ca96ccfb1400000000001600148db50eb52063ea" +
      "9d98b3eac91489a90f738986f602483045022100adc5b0cffc65444cf16873eb57cb7" +
      "02414ee36ca907ad3cf57676abe83c0f80502204a206d9b55eeee05d9647e95d15ed5" +
      "143eaad6cc8c5bc2c1919b69addc18db29012103989d253b17a6a0f41838b84ff0d20" +
      "e8898f9d7b1a98f2564da4cc29dcf8581d900000000",
  },
  redemptionRequests: [
    {
      // P2SH
      address: "2Mxy76sc1qAxiJ1fXMXDXqHvVcPLh6Lf12C",
      amount: BigNumber.from(12000),
      feeShare: BigNumber.from(1200),
      treasuryFee: BigNumber.from(1000),
    },
  ],
  witness: false, // False will result in a P2PKH output
  expectedRedemption: {
    transactionHash:
      "0fec22d0fecd6607a0429210d04e9465681507d514f3edf0f07def96eda0f89d",
    transaction: {
      transactionHex:
        "01000000000101b772d923456fb61a15c6a0dcd15df057f4f0c53c14b8e4836122b" +
        "6d29ff80ff70400000000ffffffff02482600000000000017a9143ec459d0f3c292" +
        "86ae5df5fcc421e2786024277e87d4d01400000000001976a9148db50eb52063ea9" +
        "d98b3eac91489a90f738986f688ac02473044022007fe551170700fa35bda9362d3" +
        "c9d340a674e1ae3300b266c5c10a283aa703b9022067910d6bfe4c62b14bd2f3244" +
        "47d65bddf732db3d3074e40910d51964c072e6d012103989d253b17a6a0f41838b8" +
        "4ff0d20e8898f9d7b1a98f2564da4cc29dcf8581d900000000",
    },
  },
}

export const nonStandardAddressRedemption: RedemptionTestData = {
  mainUtxo: {
    transactionHash:
      "523e4bfb71804e5ed3b76c8933d733339563e560311c1bf835934ee7aae5db20",
    outputIndex: 1,
    value: 1481680,
    transactionHex:
      "0100000000010160d264b34e51e6567254bcaf4cc67e1e069483f4249dc50784eae68" +
      "2645fd11d0100000000ffffffff02d84000000000000022002086a303cdd2e2eab1d1" +
      "679f1a813835dc5a1b65321077cdccaf08f98cbf04ca96d09b1600000000001600148" +
      "db50eb52063ea9d98b3eac91489a90f738986f602483045022100ed5fa06ea5e9d4a9" +
      "f0cf0df86a2cd473f693e5bda3d808ba82b04ee26d72b73f0220648f4d7bb25be7819" +
      "22349d382cf0f32ffcbbf89c483776472c2d15644a48d67012103989d253b17a6a0f4" +
      "1838b84ff0d20e8898f9d7b1a98f2564da4cc29dcf8581d900000000",
  },
  redemptionRequests: [
    {
      // testnet P2TR address taken from
      // https://live.blockcypher.com/btc-testnet/tx/2035ead4a9d0c8e2da1184924abc9034d26f2a7093371183ef12891623b235d1/
      address: "tb1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqp3mvzv",
      amount: BigNumber.from(10000),
      feeShare: BigNumber.from(1600),
      treasuryFee: BigNumber.from(1000),
    },
  ],
  witness: true,
  expectedRedemption: {
    transactionHash: "",
    transaction: {
      transactionHex: "",
    },
  },
}
