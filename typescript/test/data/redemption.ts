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

export const singleP2PKHAddressRedemption: RedemptionTestData = {
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
      // testnet P2PKH address
      address: "mmTeMR8RKu6QzMGTG4ipA71uewm3EuJng5",
      amount: BigNumber.from(10000),
      fee: BigNumber.from(1600),
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

export const singleP2WPKHAddressRedemption: RedemptionTestData = {
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
      // testnet P2WPKH address
      address: "tb1qgycg0ys3c4xlgc8ysnwln2kqp89n3mn5ts7z3l",
      amount: BigNumber.from(15000),
      fee: BigNumber.from(1700),
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

export const singleP2SHAddressRedemption: RedemptionTestData = {
  mainUtxo: {
    transactionHash:
      "23728a84688d9ca666de638e72047c4bc939baadef622784cf270d8c9013f4f2",
    outputIndex: 1,
    value: 1525980,
    transactionHex:
      "01000000000101b2c0049703e624470b1e70c6aac58f48a7ba92dd2c60c7573246687" +
      "6c1380e580100000000ffffffff02f433000000000000220020df74a2e385542c87ac" +
      "fafa564ea4bc4fc4eb87d2b6a37d6c3b64722be83c636fe8141700000000001600148" +
      "db50eb52063ea9d98b3eac91489a90f738986f602483045022100fee112c0fd12aa4b" +
      "0c7d75b088ae45b66db65bb5f35e5cf1d48b1188be6cd3300220628d5b3c6c3b877f9" +
      "537f43d0611bd0c10dc678e3a1b6d61f542347c8d1aee94012103989d253b17a6a0f4" +
      "1838b84ff0d20e8898f9d7b1a98f2564da4cc29dcf8581d900000000",
  },
  redemptionRequests: [
    {
      // testnet P2SH address
      address: "2Mxy76sc1qAxiJ1fXMXDXqHvVcPLh6Lf12C",
      amount: BigNumber.from(13000),
      fee: BigNumber.from(1700),
    },
  ],
  expectedRedemption: {
    transactionHash:
      "1dd15f6482e6ea8407c59d24f48394061e7ec64cafbc547256e6514eb364d260",
    transaction: {
      transactionHex:
        "01000000000101f2f413908c0d27cf842762efadba39c94b7c04728e63de66a69c8d" +
        "68848a72230100000000ffffffff02242c00000000000017a9143ec459d0f3c29286" +
        "ae5df5fcc421e2786024277e8720e21600000000001600148db50eb52063ea9d98b3" +
        "eac91489a90f738986f60247304402207caaf4091f652619c86afe590507fce8ab04" +
        "5c013852d845a4babf7a088e171f0220466490d1bd12c828354e7e8b8b4c09f2cfe4" +
        "386d31001eef6000ea5b57e0208c012103989d253b17a6a0f41838b84ff0d20e8898" +
        "f9d7b1a98f2564da4cc29dcf8581d900000000",
    },
  },
}

export const singleP2WSHAddressRedemption: RedemptionTestData = {
  mainUtxo: {
    transactionHash:
      "1dd15f6482e6ea8407c59d24f48394061e7ec64cafbc547256e6514eb364d260",
    outputIndex: 1,
    value: 1510980,
    transactionHex:
      "01000000000101f2f413908c0d27cf842762efadba39c94b7c04728e63de66a69c8d6" +
      "8848a72230100000000ffffffff02242c00000000000017a9143ec459d0f3c29286ae" +
      "5df5fcc421e2786024277e8720e21600000000001600148db50eb52063ea9d98b3eac" +
      "91489a90f738986f60247304402207caaf4091f652619c86afe590507fce8ab045c01" +
      "3852d845a4babf7a088e171f0220466490d1bd12c828354e7e8b8b4c09f2cfe4386d3" +
      "1001eef6000ea5b57e0208c012103989d253b17a6a0f41838b84ff0d20e8898f9d7b1" +
      "a98f2564da4cc29dcf8581d900000000",
  },
  redemptionRequests: [
    {
      // testnet P2WSH address
      address: "tb1qs63s8nwjut4tr5t8nudgzwp4m3dpkefjzpmumn90pruce0cye2tq2jkq0y",
      amount: BigNumber.from(18000),
      fee: BigNumber.from(1400),
    },
  ],
  expectedRedemption: {
    transactionHash:
      "523e4bfb71804e5ed3b76c8933d733339563e560311c1bf835934ee7aae5db20",
    transaction: {
      transactionHex:
        "0100000000010160d264b34e51e6567254bcaf4cc67e1e069483f4249dc50784eae6" +
        "82645fd11d0100000000ffffffff02d84000000000000022002086a303cdd2e2eab1" +
        "d1679f1a813835dc5a1b65321077cdccaf08f98cbf04ca96d09b1600000000001600" +
        "148db50eb52063ea9d98b3eac91489a90f738986f602483045022100ed5fa06ea5e9" +
        "d4a9f0cf0df86a2cd473f693e5bda3d808ba82b04ee26d72b73f0220648f4d7bb25b" +
        "e781922349d382cf0f32ffcbbf89c483776472c2d15644a48d67012103989d253b17" +
        "a6a0f41838b84ff0d20e8898f9d7b1a98f2564da4cc29dcf8581d900000000",
    },
  },
}
