import TBTC from "./../src"
import { expect } from "chai"
import { BigNumber } from "ethers"
import { testnetAddress, testnetPrivateKey, testnetUTXO } from "./data/bitcoin"
import { RawTransaction } from "../src/bitcoin"
// @ts-ignore
import bcoin from "bcoin"

describe("Deposit", () => {
  const depositData = {
    ethereumAddress: "0x934B98637cA318a4D6E7CA6ffd1690b8e77df637",
    amount: BigNumber.from(10000), // 0.0001 BTC
    refundPublicKey:
      "0300d6f28a2f6bf9836f57fcda5d284c9a8f849316119779f0d6090830d97763a9",
    blindingFactor: BigNumber.from("0xf9f0c90d00039523"), // 18010115967526606115
    createdAt: 1640181600, // 22-12-2021 14:00:00 UTC
  }

  describe("createDepositTransaction", () => {
    let transaction: RawTransaction

    beforeEach(async () => {
      transaction = await TBTC.createDepositTransaction(
        depositData,
        [testnetUTXO],
        testnetPrivateKey
      )
    })

    it("should return transaction with proper structure", async () => {
      // Convert raw transaction to JSON.
      bcoin.set("testnet")
      const buffer = Buffer.from(transaction.transactionHex, "hex")
      const txJSON = bcoin.TX.fromRaw(buffer).toJSON()

      expect(txJSON.hash).to.be.equal(
        "c219f45cb5c883161a064e3574c6206d64e5ac67bc349ce4687843202c8d2701"
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
      // Should be OP_HASH160 <script-hash> OP_EQUAL. The script hash is
      // 867120d5480a9cc0c11c1193fa59b3a92e852da7 (see createDepositScriptHash
      // scenario) and it should be prefixed with its byte length: 0x14.
      // The OP_HASH160 opcode is 0xa9 and OP_EQUAL is 0x87. So, the final
      // form should be: a914867120d5480a9cc0c11c1193fa59b3a92e852da787.
      expect(depositOutput.script).to.be.equal(
        "a914867120d5480a9cc0c11c1193fa59b3a92e852da787"
      )
      // The address should correspond to the script hash
      // 867120d5480a9cc0c11c1193fa59b3a92e852da7 on testnet so it should be
      // 2N5W64H5wBX8iGhWQdNP4DLP7TtnLh26PAa (see createDepositAddress scenario).
      expect(depositOutput.address).to.be.equal(
        "2N5W64H5wBX8iGhWQdNP4DLP7TtnLh26PAa"
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

  describe("createDepositScript", () => {
    let script: string

    beforeEach(async () => {
      script = await TBTC.createDepositScript(depositData)
    })

    it("should return script with proper structure", async () => {
      expect(script.length).to.be.equal(236) // 118 bytes

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

      // Assert the signing group public key is encoded correctly.
      // The first byte (0x21) before the public key is this byte length.
      // In this case it's 33 bytes which is a correct length for a compressed
      // Bitcoin public key.
      expect(script.substring(68, 70)).to.be.equal("21")
      expect(script.substring(70, 136)).to.be.equal(
        await TBTC.getActiveWalletPublicKey()
      )

      // OP_EQUAL opcode is 0x87.
      expect(script.substring(136, 138)).to.be.equal("87")

      // OP_IF opcode is 0x63.
      expect(script.substring(138, 140)).to.be.equal("63")

      // OP_CHECKSIG opcode is 0xac.
      expect(script.substring(140, 142)).to.be.equal("ac")

      // OP_ELSE opcode is 0x67.
      expect(script.substring(142, 144)).to.be.equal("67")

      // OP_DUP opcode is 0x76.
      expect(script.substring(144, 146)).to.be.equal("76")

      // OP_HASH160 opcode is 0xa9.
      expect(script.substring(146, 148)).to.be.equal("a9")

      // Assert the refund public key is encoded correctly.
      // The first byte (0x21) before the public key is this byte length.
      // In this case it's 33 bytes which is a correct length for a compressed
      // Bitcoin public key.
      expect(script.substring(148, 150)).to.be.equal("21")
      expect(script.substring(150, 216)).to.be.equal(
        depositData.refundPublicKey
      )

      // OP_EQUALVERIFY opcode is 0x88.
      expect(script.substring(216, 218)).to.be.equal("88")

      // Assert the locktime is encoded correctly.
      // The first byte (0x04) before the locktime is this byte length.
      // In this case it's 4 bytes.
      expect(script.substring(218, 220)).to.be.equal("04")
      expect(script.substring(220, 228)).to.be.equal(
        BigNumber.from(depositData.createdAt + 2592000)
          .toHexString()
          .substring(2)
      )

      // OP_CHECKLOCKTIMEVERIFY opcode is 0xb1.
      expect(script.substring(228, 230)).to.be.equal("b1")

      // OP_DROP opcode is 0x75.
      expect(script.substring(230, 232)).to.be.equal("75")

      // OP_CHECKSIG opcode is 0xac.
      expect(script.substring(232, 234)).to.be.equal("ac")

      // OP_ENDIF opcode is 0x68.
      expect(script.substring(234, 236)).to.be.equal("68")
    })
  })

  describe("createDepositScriptHash", () => {
    let scriptHash: Buffer

    beforeEach(async () => {
      scriptHash = await TBTC.createDepositScriptHash(depositData)
    })

    it("should return proper script hash", async () => {
      // The script for given depositData should be the same as in
      // createDepositScript test scenario:
      // 14934b98637ca318a4d6e7ca6ffd1690b8e77df6377508f9f0c90d000395237576a921
      // 03989d253b17a6a0f41838b84ff0d20e8898f9d7b1a98f2564da4cc29dcf8581d98763
      // ac6776a9210300d6f28a2f6bf9836f57fcda5d284c9a8f849316119779f0d6090830d9
      // 7763a9880461eabc60b175ac68. The hash of this script should correspond
      // to the OP_HASH160 opcode which applies SHA-256 and then RIPEMD-160
      // on the input. In this case the hash is 867120d5480a9cc0c11c1193fa59b3a92e852da7
      // and it can be verified with the following command:
      // echo -n $SCRIPT | xxd -r -p | openssl dgst -sha256 -binary | openssl dgst -rmd160
      expect(scriptHash.toString("hex")).to.be.equal(
        "867120d5480a9cc0c11c1193fa59b3a92e852da7"
      )
    })
  })

  describe("createDepositAddress", () => {
    let address: string

    context("when network is main", () => {
      beforeEach(async () => {
        address = await TBTC.createDepositAddress(depositData, "main")
      })

      it("should return proper address with prefix 3", async () => {
        // Address is created from same script hash as presented in the
        // createDepositScriptHash scenario: 867120d5480a9cc0c11c1193fa59b3a92e852da7.
        // According to https://en.bitcoin.it/wiki/List_of_address_prefixes
        // the P2SH address prefix for mainnet is 3.
        expect(address).to.be.equal("3DwszY9ua4dN4usrxEmBbPPrFYaArCvB47")
      })
    })

    context("when network is testnet", () => {
      beforeEach(async () => {
        address = await TBTC.createDepositAddress(depositData, "testnet")
      })

      it("should return proper address with prefix 2", async () => {
        // Address is created from same script hash as presented in the
        // createDepositScriptHash scenario: 867120d5480a9cc0c11c1193fa59b3a92e852da7.
        // According to https://en.bitcoin.it/wiki/List_of_address_prefixes
        // the P2SH address prefix for testnet is 2.
        expect(address).to.be.equal("2N5W64H5wBX8iGhWQdNP4DLP7TtnLh26PAa")
      })
    })
  })
})
