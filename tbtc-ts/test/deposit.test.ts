import TBTC from "./../src"
import { expect } from "chai"
import { BigNumber } from "ethers"
import {
  testnetAddress,
  testnetPrivateKey,
  testnetTransaction,
  testnetTransactionHash,
  testnetUTXO,
} from "./data/bitcoin"
import {
  RawTransaction,
  Client as BitcoinClient,
  UnspentTransactionOutput,
  Transaction,
} from "../src/bitcoin"
// @ts-ignore
import bcoin from "bcoin"
// @ts-ignore
import hash160 from "bcrypto/lib/hash160"

describe("Deposit", () => {
  const depositData = {
    ethereumAddress: "0x934B98637cA318a4D6E7CA6ffd1690b8e77df637",
    amount: BigNumber.from(10000), // 0.0001 BTC
    refundPublicKey:
      "0300d6f28a2f6bf9836f57fcda5d284c9a8f849316119779f0d6090830d97763a9",
    blindingFactor: BigNumber.from("0xf9f0c90d00039523"), // 18010115967526606115
    createdAt: 1640181600, // 22-12-2021 14:00:00 UTC
  }

  // All test scenarios using the deposit script within `Deposit` group
  // expect the same deposit script:
  const expectedDepositScript =
    "14934b98637ca318a4d6e7ca6ffd1690b8e77df6377508f9f0c90d000395237576a9148" +
    "db50eb52063ea9d98b3eac91489a90f738986f68763ac6776a91428e081f285138ccbe3" +
    "89c1eb8985716230129f89880460bcea61b175ac68"

  // Expected data of created deposit in P2WSH scenarios.
  const expectedP2WSHDepositData = {
    transactionHash:
      "9eb901fc68f0d9bcaf575f23783b7d30ac5dd8d95f3c83dceaa13dce17de816a",

    // HEX of the expected P2WSH deposit transaction. It can be decoded with:
    // https://live.blockcypher.com/btc-testnet/decodetx.
    transaction: {
      transactionHex:
        "010000000001018348cdeb551134fe1f19d378a8adec9b146671cb67b945b71bf56" +
        "b20dc2b952f0100000000ffffffff021027000000000000220020df74a2e385542c" +
        "87acfafa564ea4bc4fc4eb87d2b6a37d6c3b64722be83c636f10d73b00000000001" +
        "600147ac2d9378a1c47e589dfb8095ca95ed2140d272602483045022100ac3d4148" +
        "2338262654418825c37a4c7b327ed4e0b1dfb80eba0c98f264a6cc2e02201cd321f" +
        "1b806cc946141d71b229dd0a440917c9f429b5f8840f7be59d70dbfee012102ee06" +
        "7a0273f2e3ba88d23140a24fdb290f27bbcd0f94117a9c65be3911c5c04e0000000" +
        "0",
    },

    scriptHash:
      "df74a2e385542c87acfafa564ea4bc4fc4eb87d2b6a37d6c3b64722be83c636f",

    mainnetAddress:
      "bc1qma629cu92skg0t86lftyaf9uflzwhp7jk63h6mpmv3ezh6puvdhsdxuv4m",

    testnetAddress:
      "tb1qma629cu92skg0t86lftyaf9uflzwhp7jk63h6mpmv3ezh6puvdhs6w2r05",
  }

  // Expected data of created deposit in P2SH scenarios.
  const expectedP2SHDepositData = {
    transactionHash:
      "f21a9922c0c136c6d288cf1258b732d0f84a7d50d14a01d7d81cb6cd810f3517",

    // HEX of the expected P2SH deposit transaction. It can be decoded with:
    // https://live.blockcypher.com/btc-testnet/decodetx.
    transaction: {
      transactionHex:
        "010000000001018348cdeb551134fe1f19d378a8adec9b146671cb67b945b71bf56" +
        "b20dc2b952f0100000000ffffffff02102700000000000017a9142c1444d23936c5" +
        "7bdd8b3e67e5938a5440cda455877ed73b00000000001600147ac2d9378a1c47e58" +
        "9dfb8095ca95ed2140d27260247304402204582016a3cd3fa61fae1e1911b575625" +
        "fe2ca75319de72349089724e80fb4a2f02207e76f992f64d0615779af763b157699" +
        "a0d37270e136122408196084c1753a19e012102ee067a0273f2e3ba88d23140a24f" +
        "db290f27bbcd0f94117a9c65be3911c5c04e00000000",
    },

    scriptHash: "2c1444d23936c57bdd8b3e67e5938a5440cda455",

    mainnetAddress: "35i5wHdLir1hdjCr6hiQNk3yTH9ufe61eH",

    testnetAddress: "2MwGJ12ZNLJX3qWqPmqLGzh3EfdN5XAEGQ8",
  }

  describe("makeDeposit", () => {
    let bitcoinClient: MockBitcoinClient

    beforeEach(async () => {
      bcoin.set("testnet")

      bitcoinClient = new MockBitcoinClient()

      // Tie used testnetAddress with testnetUTXO to use it during deposit
      // creation.
      const utxos = new Map<string, UnspentTransactionOutput[]>()
      utxos.set(testnetAddress, [testnetUTXO])
      bitcoinClient.unspentTransactionOutputs = utxos

      // Tie testnetTransaction to testnetUTXO. This is needed since makeDeposit
      // attach transaction data to each UTXO.
      const rawTransactions = new Map<string, RawTransaction>()
      rawTransactions.set(testnetTransactionHash, testnetTransaction)
      bitcoinClient.rawTransactions = rawTransactions
    })

    context("when witness option is true", () => {
      beforeEach(async () => {
        await TBTC.makeDeposit(
          depositData,
          testnetPrivateKey,
          bitcoinClient,
          true
        )
      })

      it("should broadcast P2WSH transaction with proper structure", async () => {
        expect(bitcoinClient.broadcastLog.length).to.be.equal(1)
        expect(bitcoinClient.broadcastLog[0]).to.be.eql(
          expectedP2WSHDepositData.transaction
        )
      })
    })

    context("when witness option is false", () => {
      beforeEach(async () => {
        await TBTC.makeDeposit(
          depositData,
          testnetPrivateKey,
          bitcoinClient,
          false
        )
      })

      it("should broadcast P2SH transaction with proper structure", async () => {
        expect(bitcoinClient.broadcastLog.length).to.be.equal(1)
        expect(bitcoinClient.broadcastLog[0]).to.be.eql(
          expectedP2SHDepositData.transaction
        )
      })
    })
  })

  describe("createDepositTransaction", () => {
    context("when witness option is true", () => {
      let transaction: RawTransaction

      beforeEach(async () => {
        transaction = await TBTC.createDepositTransaction(
          depositData,
          [testnetUTXO],
          testnetPrivateKey,
          true
        )
      })

      it("should return P2WSH transaction with proper structure", async () => {
        // Compare HEXes.
        expect(transaction).to.be.eql(expectedP2WSHDepositData.transaction)

        // Convert raw transaction to JSON to make detailed comparison.
        const buffer = Buffer.from(transaction.transactionHex, "hex")
        const txJSON = bcoin.TX.fromRaw(buffer).getJSON("testnet")

        expect(txJSON.hash).to.be.equal(
          expectedP2WSHDepositData.transactionHash
        )
        expect(txJSON.version).to.be.equal(1)

        // Validate inputs.
        expect(txJSON.inputs.length).to.be.equal(1)

        const input = txJSON.inputs[0]

        expect(input.prevout.hash).to.be.equal(testnetUTXO.transactionHash)
        expect(input.prevout.index).to.be.equal(testnetUTXO.outputIndex)
        // Transaction should be signed but this is SegWit input so the `script`
        // field should be empty and the `witness` field should be filled instead.
        expect(input.script.length).to.be.equal(0)
        expect(input.witness.length).to.be.greaterThan(0)
        expect(input.address).to.be.equal(testnetAddress)

        // Validate outputs.
        expect(txJSON.outputs.length).to.be.equal(2)

        const depositOutput = txJSON.outputs[0]
        const changeOutput = txJSON.outputs[1]

        // Value should correspond to the deposit amount.
        expect(depositOutput.value).to.be.equal(depositData.amount.toNumber())
        // Should be OP_0 <script-hash>. The script hash is the same as in
        // expectedP2WSHDepositData.scriptHash (see createDepositScriptHash
        // witness scenario) and it should be prefixed with its byte length:
        // 0x20. The OP_0 opcode is 0x00.
        expect(depositOutput.script).to.be.equal(
          `0020${expectedP2WSHDepositData.scriptHash}`
        )
        // The address should correspond to the script hash
        // expectedP2WSHDepositData.scriptHash on testnet so it should be:
        // expectedP2WSHDepositData.testnetAddress (see createDepositAddress
        // witness scenario).
        expect(depositOutput.address).to.be.equal(
          expectedP2WSHDepositData.testnetAddress
        )

        // Change value should be equal to: inputValue - depositAmount - fee.
        expect(changeOutput.value).to.be.equal(3921680)
        // Should be OP_0 <public-key-hash>. Public key corresponds to
        // depositor BTC address.
        expect(changeOutput.script).to.be.equal(
          "00147ac2d9378a1c47e589dfb8095ca95ed2140d2726"
        )
        // Should return the change to depositor BTC address.
        expect(changeOutput.address).to.be.equal(testnetAddress)
      })
    })

    context("when witness option is false", () => {
      let transaction: RawTransaction

      beforeEach(async () => {
        transaction = await TBTC.createDepositTransaction(
          depositData,
          [testnetUTXO],
          testnetPrivateKey,
          false
        )
      })

      it("should return P2SH transaction with proper structure", async () => {
        // Compare HEXes.
        expect(transaction).to.be.eql(expectedP2SHDepositData.transaction)

        // Convert raw transaction to JSON to make detailed comparison.
        const buffer = Buffer.from(transaction.transactionHex, "hex")
        const txJSON = bcoin.TX.fromRaw(buffer).getJSON("testnet")

        expect(txJSON.hash).to.be.equal(expectedP2SHDepositData.transactionHash)
        expect(txJSON.version).to.be.equal(1)

        // Validate inputs.
        expect(txJSON.inputs.length).to.be.equal(1)

        const input = txJSON.inputs[0]

        expect(input.prevout.hash).to.be.equal(testnetUTXO.transactionHash)
        expect(input.prevout.index).to.be.equal(testnetUTXO.outputIndex)
        // Transaction should be signed but this is SegWit input so the `script`
        // field should be empty and the `witness` field should be filled instead.
        expect(input.script.length).to.be.equal(0)
        expect(input.witness.length).to.be.greaterThan(0)
        expect(input.address).to.be.equal(testnetAddress)

        // Validate outputs.
        expect(txJSON.outputs.length).to.be.equal(2)

        const depositOutput = txJSON.outputs[0]
        const changeOutput = txJSON.outputs[1]

        // Value should correspond to the deposit amount.
        expect(depositOutput.value).to.be.equal(depositData.amount.toNumber())
        // Should be OP_HASH160 <script-hash> OP_EQUAL. The script hash is
        // expectedP2SHDepositData.scriptHash (see createDepositScriptHash
        // non-witness scenario) and it should be prefixed with its byte
        // length: 0x14. The OP_HASH160 opcode is 0xa9 and OP_EQUAL is 0x87.
        expect(depositOutput.script).to.be.equal(
          `a914${expectedP2SHDepositData.scriptHash}87`
        )
        // The address should correspond to the script hash
        // expectedP2SHDepositData.scriptHash on testnet so it should be
        // expectedP2SHDepositData.testnetAddress (see createDepositAddress
        // non-witness scenario).
        expect(depositOutput.address).to.be.equal(
          expectedP2SHDepositData.testnetAddress
        )

        // Change value should be equal to: inputValue - depositAmount - fee.
        expect(changeOutput.value).to.be.equal(3921790)
        // Should be OP_0 <public-key-hash>. Public key corresponds to
        // depositor BTC address.
        expect(changeOutput.script).to.be.equal(
          "00147ac2d9378a1c47e589dfb8095ca95ed2140d2726"
        )
        // Should return the change to depositor BTC address.
        expect(changeOutput.address).to.be.equal(testnetAddress)
      })
    })
  })

  describe("createDepositScript", () => {
    let script: string

    beforeEach(async () => {
      script = await TBTC.createDepositScript(depositData)
    })

    it("should return script with proper structure", async () => {
      // Returned script should ne the same as expectedDepositScript but
      // here we make a breakdown an assert specific parts are as expected.

      expect(script.length).to.be.equal(expectedDepositScript.length)

      // Assert the Ethereum address is encoded correctly.
      // According the Bitcoin script format, the first byte before arbitrary
      // data must determine the length of those data. In this case the first
      // byte is 0x14 which is 20 in decimal, and this is correct because we
      // have a 20 bytes Ethereum address as subsequent data.
      expect(script.substring(0, 2)).to.be.equal("14")
      expect(script.substring(2, 42)).to.be.equal(
        depositData.ethereumAddress.substring(2).toLowerCase()
      )

      // According to https://en.bitcoin.it/wiki/Script#Constants, the
      // OP_DROP opcode is 0x75.
      expect(script.substring(42, 44)).to.be.equal("75")

      // Assert the blinding factor is encoded correctly.
      // The first byte (0x08) before the blinding factor is this byte length.
      // In this case it's 8 bytes.
      expect(script.substring(44, 46)).to.be.equal("08")
      expect(script.substring(46, 62)).to.be.equal(
        depositData.blindingFactor.toHexString().substring(2)
      )

      // OP_DROP opcode is 0x75.
      expect(script.substring(62, 64)).to.be.equal("75")

      // OP_DUP opcode is 0x76.
      expect(script.substring(64, 66)).to.be.equal("76")

      // OP_HASH160 opcode is 0xa9.
      expect(script.substring(66, 68)).to.be.equal("a9")

      // Assert the signing group public key hash is encoded correctly.
      // The first byte (0x14) before the public key is this byte length.
      // In this case it's 20 bytes which is a correct length for a HASH160.
      expect(script.substring(68, 70)).to.be.equal("14")
      expect(script.substring(70, 110)).to.be.equal(
        hash160
          .digest(Buffer.from(await TBTC.getActiveWalletPublicKey(), "hex"))
          .toString("hex")
      )

      // OP_EQUAL opcode is 0x87.
      expect(script.substring(110, 112)).to.be.equal("87")

      // OP_IF opcode is 0x63.
      expect(script.substring(112, 114)).to.be.equal("63")

      // OP_CHECKSIG opcode is 0xac.
      expect(script.substring(114, 116)).to.be.equal("ac")

      // OP_ELSE opcode is 0x67.
      expect(script.substring(116, 118)).to.be.equal("67")

      // OP_DUP opcode is 0x76.
      expect(script.substring(118, 120)).to.be.equal("76")

      // OP_HASH160 opcode is 0xa9.
      expect(script.substring(120, 122)).to.be.equal("a9")

      // Assert the refund public key hash is encoded correctly.
      // The first byte (0x14) before the public key is this byte length.
      // In this case it's 20 bytes which is a correct length for a HASH160.
      expect(script.substring(122, 124)).to.be.equal("14")
      expect(script.substring(124, 164)).to.be.equal(
        hash160
          .digest(Buffer.from(depositData.refundPublicKey, "hex"))
          .toString("hex")
      )

      // OP_EQUALVERIFY opcode is 0x88.
      expect(script.substring(164, 166)).to.be.equal("88")

      // Assert the locktime is encoded correctly.
      // The first byte (0x04) before the locktime is this byte length.
      // In this case it's 4 bytes.
      expect(script.substring(166, 168)).to.be.equal("04")
      expect(script.substring(168, 176)).to.be.equal(
        Buffer.from(
          BigNumber.from(depositData.createdAt + 2592000)
            .toHexString()
            .substring(2),
          "hex"
        )
          .reverse()
          .toString("hex")
      )

      // OP_CHECKLOCKTIMEVERIFY opcode is 0xb1.
      expect(script.substring(176, 178)).to.be.equal("b1")

      // OP_DROP opcode is 0x75.
      expect(script.substring(178, 180)).to.be.equal("75")

      // OP_CHECKSIG opcode is 0xac.
      expect(script.substring(180, 182)).to.be.equal("ac")

      // OP_ENDIF opcode is 0x68.
      expect(script.substring(182, 184)).to.be.equal("68")
    })
  })

  describe("createDepositScriptHash", () => {
    context("when witness option is true", () => {
      let scriptHash: Buffer

      beforeEach(async () => {
        scriptHash = await TBTC.createDepositScriptHash(depositData, true)
      })

      it("should return proper witness script hash", async () => {
        // The script for given depositData should be the same as in
        // createDepositScript test scenario i.e. expectedDepositScript.
        // The hash of this script should correspond to the OP_SHA256 opcode
        // which applies SHA-256 on the input. In this case the hash is
        // expectedP2WSHDepositData.scriptHash and it can be verified with
        // the following command:
        // echo -n $SCRIPT | xxd -r -p | openssl dgst -sha256
        expect(scriptHash.toString("hex")).to.be.equal(
          expectedP2WSHDepositData.scriptHash
        )
      })
    })

    context("when witness option is false", () => {
      let scriptHash: Buffer

      beforeEach(async () => {
        scriptHash = await TBTC.createDepositScriptHash(depositData, false)
      })

      it("should return proper non-witness script hash", async () => {
        // The script for given depositData should be the same as in
        // createDepositScript test scenario i.e. expectedDepositScript.
        // The hash of this script should correspond to the OP_HASH160 opcode
        // which applies SHA-256 and then RIPEMD-160 on the input. In this case
        // the hash is expectedP2SHDepositData.scriptHash and it can be verified
        // with the following command:
        // echo -n $SCRIPT | xxd -r -p | openssl dgst -sha256 -binary | openssl dgst -rmd160
        expect(scriptHash.toString("hex")).to.be.equal(
          expectedP2SHDepositData.scriptHash
        )
      })
    })
  })

  describe("createDepositAddress", () => {
    let address: string

    context("when network is main", () => {
      context("when witness option is true", () => {
        beforeEach(async () => {
          address = await TBTC.createDepositAddress(depositData, "main", true)
        })

        it("should return proper address with prefix bc1", async () => {
          // Address is created from same script hash as presented in the witness
          // createDepositScriptHash scenario i.e. expectedP2WSHDepositData.scriptHash.
          // According to https://en.bitcoin.it/wiki/List_of_address_prefixes
          // the P2WSH (Bech32) address prefix for mainnet is bc1.
          expect(address).to.be.equal(expectedP2WSHDepositData.mainnetAddress)
        })
      })

      context("when witness option is false", () => {
        beforeEach(async () => {
          address = await TBTC.createDepositAddress(depositData, "main", false)
        })

        it("should return proper address with prefix 3", async () => {
          // Address is created from same script hash as presented in the non-witness
          // createDepositScriptHash scenario i.e. expectedP2SHDepositData.scriptHash.
          // According to https://en.bitcoin.it/wiki/List_of_address_prefixes
          // the P2SH address prefix for mainnet is 3.
          expect(address).to.be.equal(expectedP2SHDepositData.mainnetAddress)
        })
      })
    })

    context("when network is testnet", () => {
      context("when witness option is true", () => {
        beforeEach(async () => {
          address = await TBTC.createDepositAddress(
            depositData,
            "testnet",
            true
          )
        })

        it("should return proper address with prefix tb1", async () => {
          // Address is created from same script hash as presented in the witness
          // createDepositScriptHash scenario i.e. expectedP2WSHDepositData.scriptHash.
          // According to https://en.bitcoin.it/wiki/List_of_address_prefixes
          // the P2WSH (Bech32) address prefix for testnet is tb1.
          expect(address).to.be.equal(expectedP2WSHDepositData.testnetAddress)
        })
      })

      context("when witness option is false", () => {
        beforeEach(async () => {
          address = await TBTC.createDepositAddress(
            depositData,
            "testnet",
            false
          )
        })

        it("should return proper address with prefix 2", async () => {
          // Address is created from same script hash as presented in the witness
          // createDepositScriptHash scenario i.e. expectedP2SHDepositData.scriptHash.
          // According to https://en.bitcoin.it/wiki/List_of_address_prefixes
          // the P2SH address prefix for testnet is 2.
          expect(address).to.be.equal(expectedP2SHDepositData.testnetAddress)
        })
      })
    })
  })
})

class MockBitcoinClient implements BitcoinClient {
  private _unspentTransactionOutputs = new Map<
    string,
    UnspentTransactionOutput[]
  >()

  private _rawTransactions = new Map<string, RawTransaction>()

  private _broadcastLog: RawTransaction[] = []

  set unspentTransactionOutputs(
    value: Map<string, UnspentTransactionOutput[]>
  ) {
    this._unspentTransactionOutputs = value
  }

  set rawTransactions(value: Map<string, RawTransaction>) {
    this._rawTransactions = value
  }

  get broadcastLog(): RawTransaction[] {
    return this._broadcastLog
  }

  findAllUnspentTransactionOutputs(
    address: string
  ): Promise<UnspentTransactionOutput[]> {
    return new Promise<UnspentTransactionOutput[]>((resolve, _) => {
      resolve(
        this._unspentTransactionOutputs.get(
          address
        ) as UnspentTransactionOutput[]
      )
    })
  }

  getTransaction(transactionHash: string): Promise<Transaction> {
    // Not implemented.
    return new Promise<Transaction>((resolve, _) => {})
  }

  getRawTransaction(transactionHash: string): Promise<RawTransaction> {
    return new Promise<RawTransaction>((resolve, _) => {
      resolve(this._rawTransactions.get(transactionHash) as RawTransaction)
    })
  }

  broadcast(transaction: RawTransaction): Promise<void> {
    this._broadcastLog.push(transaction)
    return new Promise<void>((resolve, _) => {
      resolve()
    })
  }
}
