import TBTC from "./../src"
import { expect } from "chai"
import { BigNumber } from "ethers"
import { RawTransaction } from "../src/bitcoin"
import { MockBitcoinClient } from "./utils/mock-bitcoin-client"
// @ts-ignore
import bcoin from "bcoin"

describe("Sweep", () => {
  const fee = BigNumber.from(1600)
  const walletPrivateKey =
    "cRk1zdau3jp2X3XsrRKDdviYLuC32fHfyU186wLBEbZWx4uQWW3v"

  const firstSweepData = {
    txHashP2SH:
      "74d0e353cdba99a6c17ce2cfeab62a26c09b5eb756eccdcfb83dbc12e67b18bc",
    rawTxP2SH: {
      transactionHex:
        "01000000000101d9fdf44eb0874a31a462dc0aedce55c0b5be6d20956b4cdfbe1c16" +
        "761f7c4aa60100000000ffffffff02a86100000000000017a9143ec459d0f3c29286" +
        "ae5df5fcc421e2786024277e8716a1110000000000160014e257eccafbc07c381642" +
        "ce6e7e55120fb077fbed0247304402204e779706c5134032f6be73633a4d32de0841" +
        "54a7fd16c82810325584eea6406a022068bf855004476b8776f5a902a4d518a486ff" +
        "7ebc6dc12fc31cd94e3e9b4220bb0121039d61d62dcd048d3f8550d22eb90b4af908" +
        "db60231d117aeede04e7bc11907bfa00000000",
    },
    txHashP2WSH:
      "5c54ecdf946382fab2236f78423ddc22a757776fb8492671c588667b737e55dc",
    rawTxP2WSH: {
      transactionHex:
        "01000000000101a0367a0790e3dfc199df34ca9ce5c35591510b6525d2d586916672" +
        "8a5ed554be0100000000ffffffff02e02e00000000000022002086a303cdd2e2eab1" +
        "d1679f1a813835dc5a1b65321077cdccaf08f98cbf04ca962c2c1100000000001600" +
        "14e257eccafbc07c381642ce6e7e55120fb077fbed0247304402206dafd502aac9d4" +
        "d542416664063533b1fed1d16877f0295740e1b09ec2abe05102200be28d9dd76863" +
        "796addef4b9595aad23b2e9363ac2d64f75c21beb0e2ade5df0121039d61d62dcd04" +
        "8d3f8550d22eb90b4af908db60231d117aeede04e7bc11907bfa00000000",
    },
    utxos: [
      {
        // P2SH
        transactionHash:
          "74d0e353cdba99a6c17ce2cfeab62a26c09b5eb756eccdcfb83dbc12e67b18bc",
        outputIndex: 0,
        value: 25000,
      },
      {
        // P2WSH
        transactionHash:
          "5c54ecdf946382fab2236f78423ddc22a757776fb8492671c588667b737e55dc",
        outputIndex: 0,
        value: 12000,
      },
    ],
    depositData: [
      {
        // P2SH
        ethereumAddress: "0x934B98637cA318a4D6E7CA6ffd1690b8e77df637",
        amount: BigNumber.from(25000),
        refundPublicKey:
          "039d61d62dcd048d3f8550d22eb90b4af908db60231d117aeede04e7bc11907bfa",
        blindingFactor: BigNumber.from("0xf9f0c90d00039523"),
        createdAt: 1641650400,
      },
      {
        // P2WSH
        ethereumAddress: "0x934B98637cA318a4D6E7CA6ffd1690b8e77df637",
        amount: BigNumber.from(12000),
        refundPublicKey:
          "039d61d62dcd048d3f8550d22eb90b4af908db60231d117aeede04e7bc11907bfa",
        blindingFactor: BigNumber.from("0xf9f0c90d00039523"),
        createdAt: 1641650400,
      },
    ],
    sweepResult: {
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

  const secondSweepData = {
    txHashP2SH:
      "d4fe2ef9068d039eae2210e893db518280d4757696fe9db8f3c696a94de90aed",
    rawTxP2SH: {
      transactionHex:
        "01000000000101e37f552fc23fa0032bfd00c8eef5f5c22bf85fe4c6e735857719ff" +
        "8a4ff66eb80100000000ffffffff02684200000000000017a9143ec459d0f3c29286" +
        "ae5df5fcc421e2786024277e8742b7100000000000160014e257eccafbc07c381642" +
        "ce6e7e55120fb077fbed0248304502210084eb60347b9aa48d9a53c6ab0fc2c2357a" +
        "0df430d193507facfb2238e46f034502202a29d11e128dba3ff3a8ad9a1e820a3b58" +
        "e89e37fa90d1cc2b3f05207599fef00121039d61d62dcd048d3f8550d22eb90b4af9" +
        "08db60231d117aeede04e7bc11907bfa00000000",
    },
    txHashP2WSH:
      "b86ef64f8aff19778535e7c6e45ff82bc2f5f5eec800fd2b03a03fc22f557fe3",
    rawTxP2WSH: {
      transactionHex:
        "01000000000101dc557e737b6688c5712649b86f7757a722dc3d42786f23b2fa8263" +
        "94dfec545c0100000000ffffffff02102700000000000022002086a303cdd2e2eab1" +
        "d1679f1a813835dc5a1b65321077cdccaf08f98cbf04ca962cff1000000000001600" +
        "14e257eccafbc07c381642ce6e7e55120fb077fbed02473044022050759dde2c84bc" +
        "cf3c1502b0e33a6acb570117fd27a982c0c2991c9f9737508e02201fcba5d6f6c0ab" +
        "780042138a9110418b3f589d8d09a900f20ee28cfcdb14d2970121039d61d62dcd04" +
        "8d3f8550d22eb90b4af908db60231d117aeede04e7bc11907bfa00000000",
    },
    utxos: [
      {
        // P2SH
        transactionHash:
          "d4fe2ef9068d039eae2210e893db518280d4757696fe9db8f3c696a94de90aed",
        outputIndex: 0,
        value: 17000,
      },
      {
        // P2WSH
        transactionHash:
          "b86ef64f8aff19778535e7c6e45ff82bc2f5f5eec800fd2b03a03fc22f557fe3",
        outputIndex: 0,
        value: 10000,
      },
    ],
    depositData: [
      {
        // P2SH
        ethereumAddress: "0x934B98637cA318a4D6E7CA6ffd1690b8e77df637",
        amount: BigNumber.from(17000),
        refundPublicKey:
          "039d61d62dcd048d3f8550d22eb90b4af908db60231d117aeede04e7bc11907bfa",
        blindingFactor: BigNumber.from("0xf9f0c90d00039523"),
        createdAt: 1641650400,
      },
      {
        // P2WSH
        ethereumAddress: "0x934B98637cA318a4D6E7CA6ffd1690b8e77df637",
        amount: BigNumber.from(10000),
        refundPublicKey:
          "039d61d62dcd048d3f8550d22eb90b4af908db60231d117aeede04e7bc11907bfa",
        blindingFactor: BigNumber.from("0xf9f0c90d00039523"),
        createdAt: 1641650400,
      },
    ],
    previousSweepUtxo: {
      // P2WKH
      transactionHash: firstSweepData.sweepResult.transactionHash,
      outputIndex: 0,
      value: 35400,
    },
    sweepResult: {
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

  describe("sweepDeposits", () => {
    let bitcoinClient: MockBitcoinClient

    beforeEach(async () => {
      bcoin.set("testnet")
      bitcoinClient = new MockBitcoinClient()

      const rawTransactions = new Map<string, RawTransaction>()
      rawTransactions.set(firstSweepData.txHashP2SH, firstSweepData.rawTxP2SH)
      rawTransactions.set(firstSweepData.txHashP2WSH, firstSweepData.rawTxP2WSH)
      rawTransactions.set(secondSweepData.txHashP2SH, secondSweepData.rawTxP2SH)
      rawTransactions.set(
        secondSweepData.txHashP2WSH,
        secondSweepData.rawTxP2WSH
      )
      rawTransactions.set(
        firstSweepData.sweepResult.transactionHash,
        firstSweepData.sweepResult.transaction
      )
      bitcoinClient.rawTransactions = rawTransactions
    })

    context("when there was no previous sweep", () => {
      beforeEach(async () => {
        await TBTC.sweepDeposits(
          bitcoinClient,
          fee,
          walletPrivateKey,
          firstSweepData.utxos,
          firstSweepData.depositData
        )
      })

      it("should broadcast sweep transaction with proper structure", async () => {
        expect(bitcoinClient.broadcastLog.length).to.be.equal(1)
        expect(bitcoinClient.broadcastLog[0]).to.be.eql(
          firstSweepData.sweepResult.transaction
        )
      })
    })

    context("when there was previous sweep", () => {
      beforeEach(async () => {
        await TBTC.sweepDeposits(
          bitcoinClient,
          fee,
          walletPrivateKey,
          secondSweepData.utxos,
          secondSweepData.depositData,
          secondSweepData.previousSweepUtxo
        )
      })

      it("should broadcast sweep transaction with proper structure", async () => {
        expect(bitcoinClient.broadcastLog.length).to.be.equal(1)
        expect(bitcoinClient.broadcastLog[0]).to.be.eql(
          secondSweepData.sweepResult.transaction
        )
      })
    })
  })

  describe("createSweepTransaction", () => {
    context("when there was no previous sweep transaction", () => {
      let transaction: RawTransaction

      const utxosWithRaw = [
        {
          // P2SH
          transactionHash: firstSweepData.utxos[0].transactionHash,
          outputIndex: firstSweepData.utxos[0].outputIndex,
          value: firstSweepData.utxos[0].value,
          transactionHex: firstSweepData.rawTxP2SH.transactionHex,
        },
        {
          // P2WSH
          transactionHash: firstSweepData.utxos[1].transactionHash,
          outputIndex: firstSweepData.utxos[1].outputIndex,
          value: firstSweepData.utxos[1].value,
          transactionHex: firstSweepData.rawTxP2WSH.transactionHex,
        },
      ]

      beforeEach(async () => {
        transaction = await TBTC.createSweepTransaction(
          fee,
          walletPrivateKey,
          utxosWithRaw,
          firstSweepData.depositData
        )
      })

      it("should return sweep transaction with proper structure", () => {
        // Compare HEXes.
        expect(transaction).to.be.eql(firstSweepData.sweepResult.transaction)

        // Convert raw transaction to JSON to make detailed comparison.
        const buffer = Buffer.from(transaction.transactionHex, "hex")
        const txJSON = bcoin.TX.fromRaw(buffer).getJSON("testnet")

        expect(txJSON.hash).to.be.equal(
          firstSweepData.sweepResult.transactionHash
        )
        expect(txJSON.version).to.be.equal(1)

        // Validate inputs.
        expect(txJSON.inputs.length).to.be.equal(2)

        const p2shInput = txJSON.inputs[0]
        expect(p2shInput.prevout.hash).to.be.equal(
          firstSweepData.utxos[0].transactionHash
        )
        expect(p2shInput.prevout.index).to.be.equal(
          firstSweepData.utxos[0].outputIndex
        )
        // Transaction should be signed. As it's not SegWit input, the `witness`
        // field should be empty, while the `script` field should be filled.
        // TODO: Add description
        expect(p2shInput.witness).to.be.equal("00")
        expect(p2shInput.script.length).to.be.greaterThan(0)
        // TODO: Add description
        expect(p2shInput.address).to.be.equal(
          "2Mxy76sc1qAxiJ1fXMXDXqHvVcPLh6Lf12C"
        )

        const p2wshInput = txJSON.inputs[1]
        expect(p2wshInput.prevout.hash).to.be.equal(
          firstSweepData.utxos[1].transactionHash
        )
        expect(p2wshInput.prevout.index).to.be.equal(
          firstSweepData.utxos[1].outputIndex
        )
        // Transaction should be signed. As it's a SegWit input, the `witness`
        // field should be filled, while the `script` field should be empty.
        expect(p2wshInput.witness.length).to.be.greaterThan(0)
        expect(p2wshInput.script.length).to.be.equal(0)
        // TODO: Add description
        expect(p2shInput.address).to.be.equal(
          "2Mxy76sc1qAxiJ1fXMXDXqHvVcPLh6Lf12C"
        )

        // Validate outputs.
        expect(txJSON.outputs.length).to.be.equal(1)
        const sweepOutput = txJSON.outputs[0]

        // TODO: Add description
        expect(sweepOutput.script).to.be.equal(
          "00148db50eb52063ea9d98b3eac91489a90f738986f6"
        )
        // TODO: Add description
        expect(sweepOutput.address).to.be.equal(
          "tb1q3k6sadfqv04fmx9naty3fzdfpaecnphkfm3cf3"
        )
      })
    })
    context("when there was previous sweep transaction", () => {
      let transaction: RawTransaction

      const utxosWithRaw = [
        {
          // P2SH
          transactionHash: secondSweepData.utxos[0].transactionHash,
          outputIndex: secondSweepData.utxos[0].outputIndex,
          value: secondSweepData.utxos[0].value,
          transactionHex: secondSweepData.rawTxP2SH.transactionHex,
        },
        {
          // P2WSH
          transactionHash: secondSweepData.utxos[1].transactionHash,
          outputIndex: secondSweepData.utxos[1].outputIndex,
          value: secondSweepData.utxos[1].value,
          transactionHex: secondSweepData.rawTxP2WSH.transactionHex,
        },
      ]

      // P2WKH
      const previousUtxoWithRaw = {
        transactionHash: secondSweepData.previousSweepUtxo.transactionHash,
        outputIndex: secondSweepData.previousSweepUtxo.outputIndex,
        value: secondSweepData.previousSweepUtxo.value,
        transactionHex: firstSweepData.sweepResult.transaction.transactionHex,
      }

      beforeEach(async () => {
        transaction = await TBTC.createSweepTransaction(
          fee,
          walletPrivateKey,
          utxosWithRaw,
          secondSweepData.depositData,
          previousUtxoWithRaw
        )
      })

      it("should return sweep transaction with proper structure", () => {
        // Compare HEXes.
        expect(transaction).to.be.eql(secondSweepData.sweepResult.transaction)

        // Convert raw transaction to JSON to make detailed comparison.
        const buffer = Buffer.from(transaction.transactionHex, "hex")
        const txJSON = bcoin.TX.fromRaw(buffer).getJSON("testnet")

        expect(txJSON.hash).to.be.equal(
          secondSweepData.sweepResult.transactionHash
        )
        expect(txJSON.version).to.be.equal(1)

        // Validate inputs.
        expect(txJSON.inputs.length).to.be.equal(3)

        const p2wkhInput = txJSON.inputs[0]
        expect(p2wkhInput.prevout.hash).to.be.equal(
          secondSweepData.previousSweepUtxo.transactionHash
        )
        expect(p2wkhInput.prevout.index).to.be.equal(
          secondSweepData.previousSweepUtxo.outputIndex
        )
        // Transaction should be signed. As it's a SegWit input, the `witness`
        // field should be filled, while the `script` field should be empty.
        expect(p2wkhInput.witness.length).to.be.greaterThan(0)
        expect(p2wkhInput.script.length).to.be.equal(0)
        // TODO: Add description
        expect(p2wkhInput.address).to.be.equal(
          "tb1q3k6sadfqv04fmx9naty3fzdfpaecnphkfm3cf3"
        )

        const p2shInput = txJSON.inputs[1]
        expect(p2shInput.prevout.hash).to.be.equal(
          secondSweepData.utxos[0].transactionHash
        )
        expect(p2shInput.prevout.index).to.be.equal(
          secondSweepData.utxos[0].outputIndex
        )
        // Transaction should be signed. As it's not SegWit input, the `witness`
        // field should be empty, while the `script` field should be filled.
        // TODO: check why "00" is set here
        expect(p2shInput.witness).to.be.equal("00")
        expect(p2shInput.script.length).to.be.greaterThan(0)
        // TODO: Add description
        expect(p2shInput.address).to.be.equal(
          "2Mxy76sc1qAxiJ1fXMXDXqHvVcPLh6Lf12C"
        )

        const p2wshInput = txJSON.inputs[2]
        expect(p2wshInput.prevout.hash).to.be.equal(
          secondSweepData.utxos[1].transactionHash
        )
        expect(p2wshInput.prevout.index).to.be.equal(
          secondSweepData.utxos[1].outputIndex
        )
        // Transaction should be signed. As it's a SegWit input, the `witness`
        // field should be filled, while the `script` field should be empty.
        expect(p2wshInput.witness.length).to.be.greaterThan(0)
        expect(p2wshInput.script.length).to.be.equal(0)
        // TODO: Add description
        expect(p2shInput.address).to.be.equal(
          "2Mxy76sc1qAxiJ1fXMXDXqHvVcPLh6Lf12C"
        )

        // Validate outputs.
        expect(txJSON.outputs.length).to.be.equal(1)
        const sweepOutput = txJSON.outputs[0]

        // TODO: Add description
        expect(sweepOutput.script).to.be.equal(
          "00148db50eb52063ea9d98b3eac91489a90f738986f6"
        )
        // TODO: Add description
        expect(sweepOutput.address).to.be.equal(
          "tb1q3k6sadfqv04fmx9naty3fzdfpaecnphkfm3cf3"
        )
      })
    })
  })
})
