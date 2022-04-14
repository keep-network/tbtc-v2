import { BigNumber } from "ethers"
import { RawTransaction, UnspentTransactionOutput } from "../../src/bitcoin"
import { RedemptionRequest } from "../redemption"

export const testnetWalletPrivateKey =
  "cRk1zdau3jp2X3XsrRKDdviYLuC32fHfyU186wLBEbZWx4uQWW3v"

export interface RedemptionTestData {
  mainUtxo: UnspentTransactionOutput & RawTransaction
  redemptionRequests: RedemptionRequest[]
  expectedRedemption: {
    transactionHash: string
    transaction: RawTransaction
  }
}

export const singlePKHAddressRedemption: RedemptionTestData = {
  mainUtxo: {
    transactionHash:
      "09f894a403a7ddc2efdfded2eac41c80438ee3e254e8d6c17a6618b156f7b231",
    outputIndex: 1,
    value: 1552680,
    transactionHex:
      "01000000000101f8a28c903ec78f15c9202f186acd8645e5139b6cd2c39f75ba97ecf5" +
      "b705e9f10100000000ffffffff02d0200000000000001600144130879211c54df460e4" +
      "84ddf9aac009cb38ee7428b11700000000001600148db50eb52063ea9d98b3eac91489" +
      "a90f738986f602473044022024d6aa19ce62444f3ace7b5194ee481d2accf4452adbf7" +
      "6c1d2b060767a0dbee0220452df45ac5e28f10cc8a42df347d900db0e256b5828e8d98" +
      "c862365138fef95c012103989d253b17a6a0f41838b84ff0d20e8898f9d7b1a98f2564" +
      "da4cc29dcf8581d900000000",
  },
  redemptionRequests: [
    {
      // testnet public key hash address
      address: "mmTeMR8RKu6QzMGTG4ipA71uewm3EuJng5",
      amount: BigNumber.from(10000),
      outputFee: BigNumber.from(1600),
    },
  ],
  expectedRedemption: {
    transactionHash:
      "67f19c3c33a0735f64786afdf3627a9ae8b17af3fc691759abb5a88a9472c234",
    transaction: {
      transactionHex:
        "0100000000010131b2f756b118667ac1d6e854e2e38e43801cc4ead2dedfefc2dda7" +
        "03a494f8090100000000ffffffff02d0200000000000001976a9144130879211c54d" +
        "f460e484ddf9aac009cb38ee7488ac188a1700000000001600148db50eb52063ea9d" +
        "98b3eac91489a90f738986f602483045022100ce19036320ae26386711645fa895ce" +
        "88aaf9f52fa7fcab69219042dc8634625202205a60a2d1eed4440c86b6b28c517fbc" +
        "a526ebf631298af044f3f3b2e477dee81f012103989d253b17a6a0f41838b84ff0d2" +
        "0e8898f9d7b1a98f2564da4cc29dcf8581d900000000",
    },
  },
}

export const singleWPKHAddressRedemption: RedemptionTestData = {
  mainUtxo: {
    transactionHash:
      "67f19c3c33a0735f64786afdf3627a9ae8b17af3fc691759abb5a88a9472c234",
    outputIndex: 1,
    value: 1542680,
    transactionHex:
      "0100000000010131b2f756b118667ac1d6e854e2e38e43801cc4ead2dedfefc2dda70" +
      "3a494f8090100000000ffffffff02d0200000000000001976a9144130879211c54df4" +
      "60e484ddf9aac009cb38ee7488ac188a1700000000001600148db50eb52063ea9d98b" +
      "3eac91489a90f738986f602483045022100ce19036320ae26386711645fa895ce88aa" +
      "f9f52fa7fcab69219042dc8634625202205a60a2d1eed4440c86b6b28c517fbca526e" +
      "bf631298af044f3f3b2e477dee81f012103989d253b17a6a0f41838b84ff0d20e8898" +
      "f9d7b1a98f2564da4cc29dcf8581d900000000",
  },
  redemptionRequests: [
    {
      // testnet witness public key hash address
      address: "tb1qgycg0ys3c4xlgc8ysnwln2kqp89n3mn5ts7z3l",
      amount: BigNumber.from(15000),
      outputFee: BigNumber.from(1700),
    },
  ],
  expectedRedemption: {
    transactionHash:
      "580e38c17668463257c7602cdd92baa7488fc5aac6701e0b4724e6039704c0b2",
    transaction: {
      transactionHex:
        "0100000000010134c272948aa8b5ab591769fcf37ab1e89a7a62f3fd6a78645f73a" +
        "0333c9cf1670100000000ffffffff02f4330000000000001600144130879211c54d" +
        "f460e484ddf9aac009cb38ee74804f1700000000001600148db50eb52063ea9d98b" +
        "3eac91489a90f738986f602483045022100c5599fd5e8d0657f101d1fdaceee326f" +
        "4a0c3e4995d38df6de2dbcc682a7c71a022079704a8560551c462858e4d95caf539" +
        "c6a885334dead518355bb84e5e949192c012103989d253b17a6a0f41838b84ff0d2" +
        "0e8898f9d7b1a98f2564da4cc29dcf8581d900000000",
    },
  },
}
