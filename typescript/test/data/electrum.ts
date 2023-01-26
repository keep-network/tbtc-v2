import {
  Transaction,
  RawTransaction,
  UnspentTransactionOutput,
  TransactionMerkleBranch,
  TransactionHash,
} from "../../src/bitcoin"
import { BigNumber } from "ethers"
import { Hex } from "../../src"

/**
 * Bitcoin testnet test data.
 */
export namespace TestnetTestData {
  /**
   * Bitcoin testnet address used for Electrum client tests.
   */
  export const address: string = "tb1qfdru0xx39mw30ha5a2vw23reymmxgucujfnc7l"

  /**
   * A testnet transaction originating from {@link testnetAddress}
   */
  export const transaction: Transaction = {
    transactionHash: TransactionHash.from(
      "72e7fd57c2adb1ed2305c4247486ff79aec363296f02ec65be141904f80d214e"
    ),

    inputs: [
      {
        transactionHash: TransactionHash.from(
          "c6ffe9e0f8cca057acad211023ff6b9d46604fbbcb76c6dd669c20b22985f802"
        ),
        outputIndex: 1,
        scriptSig: Hex.from(""),
      },
    ],

    outputs: [
      {
        outputIndex: 0,
        value: BigNumber.from(101),
        scriptPubKey: Hex.from("00144b47c798d12edd17dfb4ea98e5447926f664731c"),
      },
      {
        outputIndex: 1,
        value: BigNumber.from(9125),
        scriptPubKey: Hex.from("0014f1f22fbcff25f9d10922a155082f33de50d9c3cd"),
      },
    ],
  }

  /**
   * Raw transaction corresponding to {@link transaction}
   */
  export const rawTransaction: RawTransaction = {
    transactionHex:
      "0200000000010102f88529b2209c66ddc676cbbb4f60469d6bff231021adac57a0ccf8e" +
      "0e9ffc60100000000fdffffff0265000000000000001600144b47c798d12edd17dfb4ea" +
      "98e5447926f664731ca523000000000000160014f1f22fbcff25f9d10922a155082f33d" +
      "e50d9c3cd0247304402205b284e74ffd399c1cf5446082a68025a6bf9a3e49e94177de4" +
      "4e6d8b4cd6d6a602205eea19d0302e41b8bbac9427e30e88e23875bd47be65572da374d" +
      "f7fbdd479220121032f5cc5c735e61a51119a907a0cbece5077c7e1362e322ceb9fbf75" +
      "ffb9adb5283df21700",
  }

  /**
   * An UTXO being result of {@link transaction}
   */
  export const UTXO: UnspentTransactionOutput = {
    transactionHash: transaction.transactionHash,
    outputIndex: 0,
    value: BigNumber.from(101),
  }

  /**
   * Testnet headers chain used for Electrum client tests.
   */
  export const headersChain = {
    blockHeight: 1569342,
    headersChainLength: 6,
    headersChain:
      "00000020a114bf2d1e930390044cc4e00dd2f490a36dcecb4b6bb702b50200000000000" +
      "0583b7a45472123fac1003384cc60fce2129c8d7364969dfa35021ab26c0b0449bccc2e" +
      "5dffff001d061013a10000ff3f3210404a744c3170cdd6ad7fc901194c913004faa87f2" +
      "91cd3faac2b00000000ecc1620341eeee4881423cab631e6e4a0b003c05ffc2dfc132a2" +
      "a902a45df2c573d02e5d148c031af7358d5f00e0ff3fd83c1e679a4766043e3dbc62287" +
      "0e64ba4c2cacfa2f45563210100000000000071d244c45daecf0abf15c5f4e47f123109" +
      "12918ca56b89c3dfb68103371ae6bf98d42e5d148c031aca5d525e00000020d2a6ad530" +
      "4a5bbe4948666fd6775dc2cde9c0cef7060a471fe01000000000000597701d1165c140f" +
      "471f2684f1f6b3e97765ee5492619582af5e6d192895e7d34cd92e5dffff001dbb34c42" +
      "400000020b9b3fcbb515c899b10bf3889d432ca2782cfad01f9c2cf329fb60e00000000" +
      "0048d580fbe9ccf1cadaffe0e780eab57ea401f6260f38bd459d32cc3eef6cbd33ffd92" +
      "e5d148c031a3c4277f40000002024af4d64067c20a1ed5cb9fbd432a98fe659e3653378" +
      "e6b9ed00000000000000fea85a41c80b307f9cdfd22ac52521ba89ea6467769206d8988" +
      "9663cb7742e7358db2e5d148c031a7d30031a0000ff3f6418122efc0ddf2416189b01c0" +
      "d98ab7e5072fe1e99c3e275401000000000000496c06f87b8d442db7c6bd36ff05e3a7a" +
      "0edb3e0124d26c61d44c584ba1f8ff86bdc2e5d148c031a411e00ae",
  }

  /**
   * Transaction merkle branch corresponding to {@link transaction}
   */
  export const transactionMerkleBranch: TransactionMerkleBranch = {
    blockHeight: 1569342,
    merkle: [
      "8b5bbb5bdf6727bf70fad4f46fe4eaab04c98119ffbd2d95c29adf32d26f8452",
      "53637bacb07965e4a8220836861d1b16c6da29f10ea9ab53fc4eca73074f98b9",
      "0267e738108d094ceb05217e2942e9c2a4c6389ac47f476f572c9a319ce4dfbc",
      "34e00deec50c48d99678ca2b52b82d6d5432326159c69e7233d0dde0924874b4",
      "7a53435e6c86a3620cdbae510901f17958f0540314214379197874ed8ed7a913",
      "6315dbb7ce350ceaa16cd4c35c5a147005e8b38ca1e9531bd7320629e8d17f5b",
      "40380cdadc0206646208871e952af9dcfdff2f104305ce463aed5eeaf7725d2f",
      "5d74bae6a71fd1cff2416865460583319a40343650bd4bb89de0a6ae82097037",
      "296ddccfc659e0009aad117c8ed15fb6ff81c2bade73fbc89666a22708d233f9",
    ],
    position: 176,
  }
}

/**
 * Bitcoin mainnet test data.
 */
export namespace MainnetTestData {
  // TODO: Provide actual mainnet test data of TBTCv2 funding transaction.
  /**
   * Bitcoin mainnet address used for Electrum client tests.
   */
  export const address: string = "placeholder"
}
