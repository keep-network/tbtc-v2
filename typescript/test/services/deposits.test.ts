import { expect } from "chai"
import { BigNumber } from "ethers"
import {
  testnetAddress,
  testnetPrivateKey,
  testnetTransaction,
  testnetTransactionHash,
  testnetUTXO,
} from "../data/deposit"
import {
  BitcoinLocktimeUtils,
  BitcoinNetwork,
  BitcoinRawTx,
  BitcoinTxHash,
  BitcoinUtxo,
  Deposit,
  DepositFunding,
  DepositReceipt,
  DepositRefund,
  DepositScript,
  EthereumAddress,
  extractBitcoinRawTxVectors,
} from "../../src"
import { MockBitcoinClient } from "../utils/mock-bitcoin-client"
import { MockTBTCContracts } from "../utils/mock-tbtc-contracts"
import { Hex } from "../../src/lib/utils"
import { txToJSON } from "../utils/helpers"
import {
  depositRefundOfNonWitnessDepositAndWitnessRefunderAddress,
  depositRefundOfWitnessDepositAndNonWitnessRefunderAddress,
  depositRefundOfWitnessDepositAndWitnessRefunderAddress,
  refunderPrivateKey,
} from "../data/deposit-refund"

describe("Deposits", () => {
  const depositCreatedAt: number = 1640181600
  const depositRefundLocktimeDuration: number = 2592000

  const depositAmount = BigNumber.from(10000) // 0.0001 BTC

  const deposit: DepositReceipt = {
    depositor: EthereumAddress.from("934b98637ca318a4d6e7ca6ffd1690b8e77df637"),
    // HASH160 of 03989d253b17a6a0f41838b84ff0d20e8898f9d7b1a98f2564da4cc29dcf8581d9.
    walletPublicKeyHash: Hex.from("8db50eb52063ea9d98b3eac91489a90f738986f6"),
    // HASH160 of 0300d6f28a2f6bf9836f57fcda5d284c9a8f849316119779f0d6090830d97763a9.
    refundPublicKeyHash: Hex.from("28e081f285138ccbe389c1eb8985716230129f89"),
    blindingFactor: Hex.from("f9f0c90d00039523"),
    refundLocktime: BitcoinLocktimeUtils.calculateLocktime(
      depositCreatedAt,
      depositRefundLocktimeDuration
    ),
  }

  // All test scenarios using the deposit script within `Deposit` group
  // expect the same deposit script:
  const expectedDepositScript =
    "14934b98637ca318a4d6e7ca6ffd1690b8e77df6377508f9f0c90d000395237576a9148" +
    "db50eb52063ea9d98b3eac91489a90f738986f68763ac6776a91428e081f285138ccbe3" +
    "89c1eb8985716230129f89880460bcea61b175ac68"

  // Expected data of created deposit in P2WSH scenarios.
  const expectedP2WSHDeposit = {
    transactionHash: BitcoinTxHash.from(
      "9eb901fc68f0d9bcaf575f23783b7d30ac5dd8d95f3c83dceaa13dce17de816a"
    ),

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
  const expectedP2SHDeposit = {
    transactionHash: BitcoinTxHash.from(
      "f21a9922c0c136c6d288cf1258b732d0f84a7d50d14a01d7d81cb6cd810f3517"
    ),

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

  /**
   * Checks if script given in argument is correct
   * @param script - script as an un-prefixed hex string.
   * @returns void
   */
  function assertValidDepositScript(script: string): void {
    // Returned script should be the same as expectedDepositScript but
    // here we make a breakdown and assert specific parts are as expected.
    expect(script.length).to.be.equal(expectedDepositScript.length)

    // Assert the depositor identifier is encoded correctly.
    // According the Bitcoin script format, the first byte before arbitrary
    // data must determine the length of those data. In this case the first
    // byte is 0x14 which is 20 in decimal, and this is correct because we
    // have a 20 bytes depositor identifier as subsequent data.
    expect(script.substring(0, 2)).to.be.equal("14")
    expect(script.substring(2, 42)).to.be.equal(deposit.depositor.identifierHex)

    // According to https://en.bitcoin.it/wiki/Script#Constants, the
    // OP_DROP opcode is 0x75.
    expect(script.substring(42, 44)).to.be.equal("75")

    // Assert the blinding factor is encoded correctly.
    // The first byte (0x08) before the blinding factor is this byte length.
    // In this case it's 8 bytes.
    expect(script.substring(44, 46)).to.be.equal("08")
    expect(script.substring(46, 62)).to.be.equal(
      deposit.blindingFactor.toString()
    )

    // OP_DROP opcode is 0x75.
    expect(script.substring(62, 64)).to.be.equal("75")

    // OP_DUP opcode is 0x76.
    expect(script.substring(64, 66)).to.be.equal("76")

    // OP_HASH160 opcode is 0xa9.
    expect(script.substring(66, 68)).to.be.equal("a9")

    // Assert the wallet public key hash is encoded correctly.
    // The first byte (0x14) before the public key is this byte length.
    // In this case it's 20 bytes which is a correct length for a HASH160.
    expect(script.substring(68, 70)).to.be.equal("14")
    expect(script.substring(70, 110)).to.be.equal(
      deposit.walletPublicKeyHash.toString()
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
      deposit.refundPublicKeyHash.toString()
    )

    // OP_EQUALVERIFY opcode is 0x88.
    expect(script.substring(164, 166)).to.be.equal("88")

    // Assert the locktime is encoded correctly.
    // The first byte (0x04) before the locktime is this byte length.
    // In this case it's 4 bytes.
    expect(script.substring(166, 168)).to.be.equal("04")
    expect(script.substring(168, 176)).to.be.equal(
      Buffer.from(
        BigNumber.from(1640181600 + 2592000)
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
  }

  describe("DepositFunding", () => {
    describe("submitTransaction", () => {
      let bitcoinClient: MockBitcoinClient

      beforeEach(async () => {
        bitcoinClient = new MockBitcoinClient()

        // Tie testnetTransaction to testnetUTXO. This is needed since
        // submitDepositTransaction attach transaction data to each UTXO.
        const rawTransactions = new Map<string, BitcoinRawTx>()
        rawTransactions.set(
          testnetTransactionHash.toString(),
          testnetTransaction
        )
        bitcoinClient.rawTransactions = rawTransactions
      })

      context("when witness option is true", () => {
        let transactionHash: BitcoinTxHash
        let depositUtxo: BitcoinUtxo

        beforeEach(async () => {
          const fee = BigNumber.from(1520)

          const depositFunding = DepositFunding.fromScript(
            DepositScript.fromReceipt(deposit, true)
          )

          ;({ transactionHash, depositUtxo } =
            await depositFunding.submitTransaction(
              depositAmount,
              [testnetUTXO],
              fee,
              testnetPrivateKey,
              bitcoinClient
            ))
        })

        it("should broadcast P2WSH transaction with proper structure", async () => {
          expect(bitcoinClient.broadcastLog.length).to.be.equal(1)
          expect(bitcoinClient.broadcastLog[0]).to.be.eql(
            expectedP2WSHDeposit.transaction
          )
        })

        it("should return the proper transaction hash", async () => {
          expect(transactionHash).to.be.deep.equal(
            expectedP2WSHDeposit.transactionHash
          )
        })

        it("should return the proper deposit UTXO", () => {
          const expectedDepositUtxo = {
            transactionHash: expectedP2WSHDeposit.transactionHash,
            outputIndex: 0,
            value: depositAmount,
          }

          expect(depositUtxo).to.be.eql(expectedDepositUtxo)
        })
      })

      context("when witness option is false", () => {
        let transactionHash: BitcoinTxHash
        let depositUtxo: BitcoinUtxo

        beforeEach(async () => {
          const fee = BigNumber.from(1410)

          const depositFunding = DepositFunding.fromScript(
            DepositScript.fromReceipt(deposit, false)
          )

          ;({ transactionHash, depositUtxo } =
            await depositFunding.submitTransaction(
              depositAmount,
              [testnetUTXO],
              fee,
              testnetPrivateKey,
              bitcoinClient
            ))
        })

        it("should broadcast P2SH transaction with proper structure", async () => {
          expect(bitcoinClient.broadcastLog.length).to.be.equal(1)
          expect(bitcoinClient.broadcastLog[0]).to.be.eql(
            expectedP2SHDeposit.transaction
          )
        })

        it("should return the proper transaction hash", async () => {
          expect(transactionHash).to.be.deep.equal(
            expectedP2SHDeposit.transactionHash
          )
        })

        it("should return the proper deposit UTXO", () => {
          const expectedDepositUtxo = {
            transactionHash: expectedP2SHDeposit.transactionHash,
            outputIndex: 0,
            value: depositAmount,
          }

          expect(depositUtxo).to.be.eql(expectedDepositUtxo)
        })
      })
    })

    describe("assembleTransaction", () => {
      context("when witness option is true", () => {
        let transactionHash: BitcoinTxHash
        let depositUtxo: BitcoinUtxo
        let transaction: BitcoinRawTx

        beforeEach(async () => {
          const fee = BigNumber.from(1520)

          const depositFunding = DepositFunding.fromScript(
            DepositScript.fromReceipt(deposit, true)
          )

          ;({
            transactionHash,
            depositUtxo,
            rawTransaction: transaction,
          } = await depositFunding.assembleTransaction(
            BitcoinNetwork.Testnet,
            depositAmount,
            [testnetUTXO],
            fee,
            testnetPrivateKey
          ))
        })

        it("should return P2WSH transaction with proper structure", async () => {
          // Compare HEXes.
          expect(transaction).to.be.eql(expectedP2WSHDeposit.transaction)

          // Convert raw transaction to JSON to make detailed comparison.
          const txJSON = txToJSON(
            transaction.transactionHex,
            BitcoinNetwork.Testnet
          )

          expect(txJSON.hash).to.be.equal(
            expectedP2WSHDeposit.transactionHash.toString()
          )
          expect(txJSON.version).to.be.equal(1)

          // Validate inputs.
          expect(txJSON.inputs.length).to.be.equal(1)

          const input = txJSON.inputs[0]

          expect(input.hash).to.be.equal(testnetUTXO.transactionHash.toString())
          expect(input.index).to.be.equal(testnetUTXO.outputIndex)
          // Transaction should be signed but this is SegWit input so the `script`
          // field should be empty and the `witness` field should be filled instead.
          expect(input.script.length).to.be.equal(0)
          expect(input.witness.length).to.be.greaterThan(0)

          // Validate outputs.
          expect(txJSON.outputs.length).to.be.equal(2)

          const depositOutput = txJSON.outputs[0]
          const changeOutput = txJSON.outputs[1]

          // Value should correspond to the deposit amount.
          expect(depositOutput.value).to.be.equal(depositAmount.toNumber())
          // Should be OP_0 <script-hash>. The script hash is the same as in
          // expectedP2WSHDeposit.scriptHash (see DepositScript.getHash
          // witness scenario) and it should be prefixed with its byte length:
          // 0x20. The OP_0 opcode is 0x00.
          expect(depositOutput.script).to.be.equal(
            `0020${expectedP2WSHDeposit.scriptHash}`
          )
          // The address should correspond to the script hash
          // expectedP2WSHDeposit.scriptHash on testnet so it should be:
          // expectedP2WSHDeposit.testnetAddress (see DepositScript.deriveAddress
          // witness scenario).
          expect(depositOutput.address).to.be.equal(
            expectedP2WSHDeposit.testnetAddress
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

        it("should return the proper transaction hash", async () => {
          expect(transactionHash).to.be.deep.equal(
            expectedP2WSHDeposit.transactionHash
          )
        })

        it("should return the proper deposit UTXO", () => {
          const expectedDepositUtxo = {
            transactionHash: expectedP2WSHDeposit.transactionHash,
            outputIndex: 0,
            value: depositAmount,
          }

          expect(depositUtxo).to.be.eql(expectedDepositUtxo)
        })
      })

      context("when witness option is false", () => {
        let transactionHash: BitcoinTxHash
        let depositUtxo: BitcoinUtxo
        let transaction: BitcoinRawTx

        beforeEach(async () => {
          const fee = BigNumber.from(1410)

          const depositFunding = DepositFunding.fromScript(
            DepositScript.fromReceipt(deposit, false)
          )

          ;({
            transactionHash,
            depositUtxo,
            rawTransaction: transaction,
          } = await depositFunding.assembleTransaction(
            BitcoinNetwork.Testnet,
            depositAmount,
            [testnetUTXO],
            fee,
            testnetPrivateKey
          ))
        })

        it("should return P2SH transaction with proper structure", async () => {
          // Compare HEXes.
          expect(transaction).to.be.eql(expectedP2SHDeposit.transaction)

          // Convert raw transaction to JSON to make detailed comparison.
          const txJSON = txToJSON(
            transaction.transactionHex,
            BitcoinNetwork.Testnet
          )

          expect(txJSON.hash).to.be.equal(
            expectedP2SHDeposit.transactionHash.toString()
          )
          expect(txJSON.version).to.be.equal(1)

          // Validate inputs.
          expect(txJSON.inputs.length).to.be.equal(1)

          const input = txJSON.inputs[0]

          expect(input.hash).to.be.equal(testnetUTXO.transactionHash.toString())
          expect(input.index).to.be.equal(testnetUTXO.outputIndex)
          // Transaction should be signed but this is SegWit input so the `script`
          // field should be empty and the `witness` field should be filled instead.
          expect(input.script.length).to.be.equal(0)
          expect(input.witness.length).to.be.greaterThan(0)

          // Validate outputs.
          expect(txJSON.outputs.length).to.be.equal(2)

          const depositOutput = txJSON.outputs[0]
          const changeOutput = txJSON.outputs[1]

          // Value should correspond to the deposit amount.
          expect(depositOutput.value).to.be.equal(depositAmount.toNumber())
          // Should be OP_HASH160 <script-hash> OP_EQUAL. The script hash is
          // expectedP2SHDeposit.scriptHash (see DepositScript.getHash
          // non-witness scenario) and it should be prefixed with its byte
          // length: 0x14. The OP_HASH160 opcode is 0xa9 and OP_EQUAL is 0x87.
          expect(depositOutput.script).to.be.equal(
            `a914${expectedP2SHDeposit.scriptHash}87`
          )
          // The address should correspond to the script hash
          // expectedP2SHDeposit.scriptHash on testnet so it should be
          // expectedP2SHDeposit.testnetAddress (see DepositScript.deriveAddress
          // non-witness scenario).
          expect(depositOutput.address).to.be.equal(
            expectedP2SHDeposit.testnetAddress
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

        it("should return the proper transaction hash", async () => {
          expect(transactionHash).to.be.deep.equal(
            expectedP2SHDeposit.transactionHash
          )
        })

        it("should return the proper deposit UTXO", () => {
          const expectedDepositUtxo = {
            transactionHash: expectedP2SHDeposit.transactionHash,
            outputIndex: 0,
            value: depositAmount,
          }

          expect(depositUtxo).to.be.deep.equal(expectedDepositUtxo)
        })
      })
    })
  })

  describe("DepositScript", () => {
    describe("getPlainText", () => {
      let script: Hex

      beforeEach(async () => {
        script = await DepositScript.fromReceipt(deposit).getPlainText()
      })

      it("should return script with proper structure", async () => {
        assertValidDepositScript(script.toString())
      })
    })

    describe("getHash", () => {
      context("when witness option is true", () => {
        let scriptHash: Buffer

        beforeEach(async () => {
          scriptHash = await DepositScript.fromReceipt(deposit, true).getHash()
        })

        it("should return proper witness script hash", async () => {
          // The script for given deposit should be the same as in
          // assembleDepositScript test scenario i.e. expectedDepositScript.
          // The hash of this script should correspond to the OP_SHA256 opcode
          // which applies SHA-256 on the input. In this case the hash is
          // expectedP2WSHDeposit.scriptHash and it can be verified with
          // the following command:
          // echo -n $SCRIPT | xxd -r -p | openssl dgst -sha256
          expect(scriptHash.toString("hex")).to.be.equal(
            expectedP2WSHDeposit.scriptHash
          )
        })
      })

      context("when witness option is false", () => {
        let scriptHash: Buffer

        beforeEach(async () => {
          scriptHash = await DepositScript.fromReceipt(deposit, false).getHash()
        })

        it("should return proper non-witness script hash", async () => {
          // The script for given deposit should be the same as in
          // assembleDepositScript test scenario i.e. expectedDepositScript.
          // The hash of this script should correspond to the OP_HASH160 opcode
          // which applies SHA-256 and then RIPEMD-160 on the input. In this case
          // the hash is expectedP2SHDeposit.scriptHash and it can be verified
          // with the following command:
          // echo -n $SCRIPT | xxd -r -p | openssl dgst -sha256 -binary | openssl dgst -rmd160
          expect(scriptHash.toString("hex")).to.be.equal(
            expectedP2SHDeposit.scriptHash
          )
        })
      })
    })

    describe("deriveAddress", () => {
      let address: string

      context("when network is mainnet", () => {
        context("when witness option is true", () => {
          beforeEach(async () => {
            address = await DepositScript.fromReceipt(
              deposit,
              true
            ).deriveAddress(BitcoinNetwork.Mainnet)
          })

          it("should return proper address with prefix bc1", async () => {
            // Address is created from same script hash as presented in the witness
            // DepositScript.getHash scenario i.e. expectedP2WSHDeposit.scriptHash.
            // According to https://en.bitcoin.it/wiki/List_of_address_prefixes
            // the P2WSH (Bech32) address prefix for mainnet is bc1.
            expect(address).to.be.equal(expectedP2WSHDeposit.mainnetAddress)
          })
        })

        context("when witness option is false", () => {
          beforeEach(async () => {
            address = await DepositScript.fromReceipt(
              deposit,
              false
            ).deriveAddress(BitcoinNetwork.Mainnet)
          })

          it("should return proper address with prefix 3", async () => {
            // Address is created from same script hash as presented in the non-witness
            // DepositScript.getHash scenario i.e. expectedP2SHDeposit.scriptHash.
            // According to https://en.bitcoin.it/wiki/List_of_address_prefixes
            // the P2SH address prefix for mainnet is 3.
            expect(address).to.be.equal(expectedP2SHDeposit.mainnetAddress)
          })
        })
      })

      context("when network is testnet", () => {
        context("when witness option is true", () => {
          beforeEach(async () => {
            address = await DepositScript.fromReceipt(
              deposit,
              true
            ).deriveAddress(BitcoinNetwork.Testnet)
          })

          it("should return proper address with prefix tb1", async () => {
            // Address is created from same script hash as presented in the witness
            // DepositScript.getHash scenario i.e. expectedP2WSHDeposit.scriptHash.
            // According to https://en.bitcoin.it/wiki/List_of_address_prefixes
            // the P2WSH (Bech32) address prefix for testnet is tb1.
            expect(address).to.be.equal(expectedP2WSHDeposit.testnetAddress)
          })
        })

        context("when witness option is false", () => {
          beforeEach(async () => {
            address = await DepositScript.fromReceipt(
              deposit,
              false
            ).deriveAddress(BitcoinNetwork.Testnet)
          })

          it("should return proper address with prefix 2", async () => {
            // Address is created from same script hash as presented in the witness
            // DepositScript.getHash scenario i.e. expectedP2SHDeposit.scriptHash.
            // According to https://en.bitcoin.it/wiki/List_of_address_prefixes
            // the P2SH address prefix for testnet is 2.
            expect(address).to.be.equal(expectedP2SHDeposit.testnetAddress)
          })
        })
      })
    })
  })

  describe("Deposit", () => {
    // TODO: Implement unit tests for other functions.

    describe("detectFunding", () => {
      let bitcoinClient: MockBitcoinClient
      let tbtcContracts: MockTBTCContracts
      let depositService: Deposit
      let utxos: BitcoinUtxo[]

      beforeEach(async () => {
        bitcoinClient = new MockBitcoinClient()
        tbtcContracts = new MockTBTCContracts()

        depositService = await Deposit.fromReceipt(
          deposit,
          tbtcContracts,
          bitcoinClient
        )
      })

      context("when there are no UTXOs from funding transactions", () => {
        context("when Bitcoin client returns undefined", () => {
          beforeEach(async () => {
            // Do not set any value for the address stored in the deposit
            // service so that undefined is returned.
            utxos = await depositService.detectFunding()
          })

          it("should return an empty UTXO array", async () => {
            expect(utxos).to.be.empty
          })
        })

        context("when Bitcoin client returns an empty array", () => {
          beforeEach(async () => {
            const unspentTransactionOutputs = new Map<string, BitcoinUtxo[]>()
            // Set an empty array for the address stored in the deposit service.
            unspentTransactionOutputs.set(
              await depositService.getBitcoinAddress(),
              []
            )
            bitcoinClient.unspentTransactionOutputs = unspentTransactionOutputs
            utxos = await depositService.detectFunding()
          })

          it("should return an empty UTXO array", async () => {
            expect(utxos).to.be.empty
          })
        })
      })

      context("when there are UTXOs from funding transactions", () => {
        const fundingUtxos: BitcoinUtxo[] = [
          {
            transactionHash: BitcoinTxHash.from(
              "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
            ),
            outputIndex: 0,
            value: BigNumber.from(1111),
          },
          {
            transactionHash: BitcoinTxHash.from(
              "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
            ),
            outputIndex: 1,
            value: BigNumber.from(2222),
          },
        ]

        beforeEach(async () => {
          const unspentTransactionOutputs = new Map<string, BitcoinUtxo[]>()
          unspentTransactionOutputs.set(
            await depositService.getBitcoinAddress(),
            fundingUtxos
          )
          bitcoinClient.unspentTransactionOutputs = unspentTransactionOutputs
          utxos = await depositService.detectFunding()
        })

        it("should return funding UTXOs stored in the blockchain", async () => {
          expect(utxos).to.be.equal(fundingUtxos)
        })
      })
    })

    describe("initiateMinting", () => {
      describe("auto funding outpoint detection mode", () => {
        // TODO: Unit test for this case.
      })

      describe("manual funding outpoint provision mode", () => {
        let transaction: BitcoinRawTx
        let depositUtxo: BitcoinUtxo
        let tbtcContracts: MockTBTCContracts
        let bitcoinClient: MockBitcoinClient

        beforeEach(async () => {
          const fee = BigNumber.from(1520)

          const depositFunding = DepositFunding.fromScript(
            DepositScript.fromReceipt(deposit)
          )

          // Create a deposit transaction.
          const result = await depositFunding.assembleTransaction(
            BitcoinNetwork.Testnet,
            depositAmount,
            [testnetUTXO],
            fee,
            testnetPrivateKey
          )

          transaction = result.rawTransaction
          depositUtxo = result.depositUtxo

          // Initialize the mock Bitcoin client to return the raw transaction
          // data for the given deposit UTXO.
          bitcoinClient = new MockBitcoinClient()
          const rawTransactions = new Map<string, BitcoinRawTx>()
          rawTransactions.set(
            depositUtxo.transactionHash.toString(),
            transaction
          )
          bitcoinClient.rawTransactions = rawTransactions

          // Initialize the mock Bridge.
          tbtcContracts = new MockTBTCContracts()

          await (
            await Deposit.fromReceipt(deposit, tbtcContracts, bitcoinClient)
          ).initiateMinting(depositUtxo)
        })

        it("should reveal the deposit to the Bridge", () => {
          expect(tbtcContracts.bridge.revealDepositLog.length).to.be.equal(1)

          const revealDepositLogEntry = tbtcContracts.bridge.revealDepositLog[0]
          expect(revealDepositLogEntry.depositTx).to.be.eql(
            extractBitcoinRawTxVectors(transaction)
          )
          expect(revealDepositLogEntry.depositOutputIndex).to.be.equal(0)
          expect(revealDepositLogEntry.deposit).to.be.eql(deposit)
        })
      })
    })
  })

  describe("DepositsService", () => {
    // TODO: Implement unit tests.
  })

  describe("DepositRefund", () => {
    const fee = BigNumber.from(1520)

    describe("DepositRefund", () => {
      describe("submitTransaction", () => {
        let bitcoinClient: MockBitcoinClient

        beforeEach(async () => {
          bitcoinClient = new MockBitcoinClient()
        })

        context(
          "when the refund transaction is requested to be witness",
          () => {
            context("when the refunded deposit was witness", () => {
              let transactionHash: BitcoinTxHash

              beforeEach(async () => {
                const utxo =
                  depositRefundOfWitnessDepositAndWitnessRefunderAddress.deposit
                    .utxo
                const deposit =
                  depositRefundOfWitnessDepositAndWitnessRefunderAddress.deposit
                    .data
                const refunderAddress =
                  depositRefundOfWitnessDepositAndWitnessRefunderAddress.refunderAddress
                const refunderPrivateKey =
                  "cTWhf1nXc7aW8BN2qLtWcPtcgcWYKfzRXkCJNsuQ86HR8uJBYfMc"

                const rawTransactions = new Map<string, BitcoinRawTx>()
                rawTransactions.set(utxo.transactionHash.toString(), {
                  transactionHex: utxo.transactionHex,
                })
                bitcoinClient.rawTransactions = rawTransactions

                const depositRefund = DepositRefund.fromScript(
                  DepositScript.fromReceipt(deposit)
                )

                ;({ transactionHash } = await depositRefund.submitTransaction(
                  bitcoinClient,
                  fee,
                  utxo,
                  refunderAddress,
                  refunderPrivateKey
                ))
              })

              it("should broadcast refund transaction with proper structure", async () => {
                expect(bitcoinClient.broadcastLog.length).to.be.equal(1)
                expect(bitcoinClient.broadcastLog[0]).to.be.eql(
                  depositRefundOfWitnessDepositAndWitnessRefunderAddress
                    .expectedRefund.transaction
                )
              })

              it("should return the proper transaction hash", async () => {
                expect(transactionHash).to.be.deep.equal(
                  depositRefundOfWitnessDepositAndWitnessRefunderAddress
                    .expectedRefund.transactionHash
                )
              })
            })

            context("when the refunded deposit was non-witness", () => {
              let transactionHash: BitcoinTxHash

              beforeEach(async () => {
                const utxo =
                  depositRefundOfNonWitnessDepositAndWitnessRefunderAddress
                    .deposit.utxo
                const deposit =
                  depositRefundOfNonWitnessDepositAndWitnessRefunderAddress
                    .deposit.data
                const refunderAddress =
                  depositRefundOfNonWitnessDepositAndWitnessRefunderAddress.refunderAddress

                const rawTransactions = new Map<string, BitcoinRawTx>()
                rawTransactions.set(utxo.transactionHash.toString(), {
                  transactionHex: utxo.transactionHex,
                })
                bitcoinClient.rawTransactions = rawTransactions

                const depositRefund = DepositRefund.fromScript(
                  DepositScript.fromReceipt(deposit)
                )

                ;({ transactionHash } = await depositRefund.submitTransaction(
                  bitcoinClient,
                  fee,
                  utxo,
                  refunderAddress,
                  refunderPrivateKey
                ))
              })

              it("should broadcast refund transaction with proper structure", async () => {
                expect(bitcoinClient.broadcastLog.length).to.be.equal(1)
                expect(bitcoinClient.broadcastLog[0]).to.be.eql(
                  depositRefundOfNonWitnessDepositAndWitnessRefunderAddress
                    .expectedRefund.transaction
                )
              })

              it("should return the proper transaction hash", async () => {
                expect(transactionHash).to.be.deep.equal(
                  depositRefundOfNonWitnessDepositAndWitnessRefunderAddress
                    .expectedRefund.transactionHash
                )
              })
            })
          }
        )

        context(
          "when the refund transaction is requested to be non-witness",
          () => {
            let transactionHash: BitcoinTxHash

            beforeEach(async () => {
              const utxo =
                depositRefundOfWitnessDepositAndNonWitnessRefunderAddress
                  .deposit.utxo
              const deposit =
                depositRefundOfWitnessDepositAndNonWitnessRefunderAddress
                  .deposit.data
              const refunderAddress =
                depositRefundOfWitnessDepositAndNonWitnessRefunderAddress.refunderAddress

              const rawTransactions = new Map<string, BitcoinRawTx>()
              rawTransactions.set(utxo.transactionHash.toString(), {
                transactionHex: utxo.transactionHex,
              })

              const depositRefund = DepositRefund.fromScript(
                DepositScript.fromReceipt(deposit)
              )

              bitcoinClient.rawTransactions = rawTransactions
              ;({ transactionHash } = await depositRefund.submitTransaction(
                bitcoinClient,
                fee,
                utxo,
                refunderAddress,
                refunderPrivateKey
              ))
            })

            it("should broadcast refund transaction with proper structure", async () => {
              expect(bitcoinClient.broadcastLog.length).to.be.equal(1)
              expect(bitcoinClient.broadcastLog[0]).to.be.eql(
                depositRefundOfWitnessDepositAndNonWitnessRefunderAddress
                  .expectedRefund.transaction
              )
            })

            it("should return the proper transaction hash", async () => {
              expect(transactionHash).to.be.deep.equal(
                depositRefundOfWitnessDepositAndNonWitnessRefunderAddress
                  .expectedRefund.transactionHash
              )
            })
          }
        )
      })
    })
  })
})
