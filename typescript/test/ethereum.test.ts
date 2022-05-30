import { Bridge } from "../src/ethereum"
import {
  deployMockContract,
  MockContract,
} from "@ethereum-waffle/mock-contract"
import chai, { assert, expect } from "chai"
import { BigNumber } from "ethers"
import { abi as BridgeABI } from "@keep-network/tbtc-v2/artifacts/Bridge.json"
import { MockProvider } from "@ethereum-waffle/provider"
import { waffleChai } from "@ethereum-waffle/chai"

chai.use(waffleChai)

describe("Ethereum", () => {
  describe("Bridge", () => {
    let bridgeContract: MockContract
    let bridgeHandle: Bridge

    beforeEach(async () => {
      const [signer] = new MockProvider().getWallets()

      bridgeContract = await deployMockContract(
        signer,
        `${JSON.stringify(BridgeABI)}`
      )

      bridgeHandle = new Bridge({
        address: bridgeContract.address,
        signer,
      })
    })

    describe("pendingRedemptions", () => {
      beforeEach(async () => {
        // Set the mock to return a specific redemption data when called
        // with the redemption key (built as keccak256(keccak256(redeemerOutputScript) | walletPubKeyHash))
        // that matches the wallet PKH and redeemer output script used during
        // the test call.
        await bridgeContract.mock.pendingRedemptions
          .withArgs(
            "0xa662ed384844519cdf051288008af701eeb24bd4d3bf157b0fc885656135c820"
          )
          .returns({
            redeemer: "0x82883a4C7A8dD73ef165deB402d432613615ced4",
            requestedAmount: BigNumber.from(10000),
            treasuryFee: BigNumber.from(100),
            txMaxFee: BigNumber.from(50),
            requestedAt: BigNumber.from(1650623240),
          } as any)
      })

      it("should return the pending redemption", async () => {
        expect(
          await bridgeHandle.pendingRedemptions(
            "8db50eb52063ea9d98b3eac91489a90f738986f6",
            "a9143ec459d0f3c29286ae5df5fcc421e2786024277e87"
          )
        ).to.be.eql({
          redeemer: {
            identifierHex: "82883a4c7a8dd73ef165deb402d432613615ced4",
          },
          redeemerOutputScript:
            "a9143ec459d0f3c29286ae5df5fcc421e2786024277e87",
          requestedAmount: BigNumber.from(10000),
          treasuryFee: BigNumber.from(100),
          txMaxFee: BigNumber.from(50),
          requestedAt: 1650623240,
        })
      })
    })

    describe("revealDeposit", () => {
      beforeEach(async () => {
        await bridgeContract.mock.revealDeposit.returns()

        await bridgeHandle.revealDeposit(
          // Just short byte strings for clarity.
          {
            version: "00000000",
            inputs: "11111111",
            outputs: "22222222",
            locktime: "33333333",
          },
          2,
          {
            depositor: {
              identifierHex: "934b98637ca318a4d6e7ca6ffd1690b8e77df637",
            },
            amount: BigNumber.from(10000),
            walletPublicKey:
              "03989d253b17a6a0f41838b84ff0d20e8898f9d7b1a98f2564da4cc29dcf8581d9",
            refundPublicKey:
              "0300d6f28a2f6bf9836f57fcda5d284c9a8f849316119779f0d6090830d97763a9",
            blindingFactor: "f9f0c90d00039523",
            refundLocktime: "60bcea61",
            vault: {
              identifierHex: "82883a4c7a8dd73ef165deb402d432613615ced4",
            },
          }
        )
      })

      it("should reveal the deposit", async () => {
        assertContractCalledWith(bridgeContract, "revealDeposit", [
          {
            version: "0x00000000",
            inputVector: "0x11111111",
            outputVector: "0x22222222",
            locktime: "0x33333333",
          },
          {
            fundingOutputIndex: 2,
            depositor: "0x934b98637ca318a4d6e7ca6ffd1690b8e77df637",
            blindingFactor: "0xf9f0c90d00039523",
            walletPubKeyHash: "0x8db50eb52063ea9d98b3eac91489a90f738986f6",
            refundPubKeyHash: "0x28e081f285138ccbe389c1eb8985716230129f89",
            refundLocktime: "0x60bcea61",
            vault: "0x82883a4c7a8dd73ef165deb402d432613615ced4",
          },
        ])
      })
    })

    describe("submitDepositSweepProof", () => {
      beforeEach(async () => {
        await bridgeContract.mock.submitDepositSweepProof.returns()

        await bridgeHandle.submitDepositSweepProof(
          {
            version: "00000000",
            inputs: "11111111",
            outputs: "22222222",
            locktime: "33333333",
          },
          {
            merkleProof: "44444444",
            txIndexInBlock: 5,
            bitcoinHeaders: "66666666",
          },
          {
            transactionHash:
              "f8eaf242a55ea15e602f9f990e33f67f99dfbe25d1802bbde63cc1caabf99668",
            outputIndex: 8,
            value: BigNumber.from(9999),
          },
          {
            identifierHex: "82883a4c7a8dd73ef165deb402d432613615ced4",
          }
        )
      })

      it("should submit the deposit sweep proof", () => {
        assertContractCalledWith(bridgeContract, "submitDepositSweepProof", [
          {
            version: "0x00000000",
            inputVector: "0x11111111",
            outputVector: "0x22222222",
            locktime: "0x33333333",
          },
          {
            merkleProof: "0x44444444",
            txIndexInBlock: 5,
            bitcoinHeaders: "0x66666666",
          },
          {
            txHash:
              "0xf8eaf242a55ea15e602f9f990e33f67f99dfbe25d1802bbde63cc1caabf99668",
            txOutputIndex: 8,
            txOutputValue: BigNumber.from(9999),
          },
          "0x82883a4c7a8dd73ef165deb402d432613615ced4",
        ])
      })
    })

    describe("txProofDifficultyFactor", () => {
      beforeEach(async () => {
        await bridgeContract.mock.txProofDifficultyFactor.returns(
          BigNumber.from(6)
        )
      })

      it("should return the tx proof difficulty factor", async () => {
        expect(await bridgeHandle.txProofDifficultyFactor()).to.be.equal(6)
      })
    })

    describe("requestRedemption", () => {
      beforeEach(async () => {
        await bridgeContract.mock.requestRedemption.returns()

        await bridgeHandle.requestRedemption(
          "03989d253b17a6a0f41838b84ff0d20e8898f9d7b1a98f2564da4cc29dcf8581d9",
          {
            transactionHash:
              "f8eaf242a55ea15e602f9f990e33f67f99dfbe25d1802bbde63cc1caabf99668",
            outputIndex: 8,
            value: BigNumber.from(9999),
          },
          "a9143ec459d0f3c29286ae5df5fcc421e2786024277e87",
          BigNumber.from(10000)
        )
      })

      it("should request the redemption", async () => {
        assertContractCalledWith(bridgeContract, "requestRedemption", [
          "0x8db50eb52063ea9d98b3eac91489a90f738986f6",
          {
            txHash:
              "0xf8eaf242a55ea15e602f9f990e33f67f99dfbe25d1802bbde63cc1caabf99668",
            txOutputIndex: 8,
            txOutputValue: BigNumber.from(9999),
          },
          "0x17a9143ec459d0f3c29286ae5df5fcc421e2786024277e87",
          BigNumber.from(10000),
        ])
      })
    })

    describe("submitRedemptionProof", () => {
      beforeEach(async () => {
        await bridgeContract.mock.submitRedemptionProof.returns()

        await bridgeHandle.submitRedemptionProof(
          {
            version: "00000000",
            inputs: "11111111",
            outputs: "22222222",
            locktime: "33333333",
          },
          {
            merkleProof: "44444444",
            txIndexInBlock: 5,
            bitcoinHeaders: "66666666",
          },
          {
            transactionHash:
              "f8eaf242a55ea15e602f9f990e33f67f99dfbe25d1802bbde63cc1caabf99668",
            outputIndex: 8,
            value: BigNumber.from(9999),
          },
          "03989d253b17a6a0f41838b84ff0d20e8898f9d7b1a98f2564da4cc29dcf8581d9"
        )
      })

      it("should submit the redemption proof", () => {
        assertContractCalledWith(bridgeContract, "submitRedemptionProof", [
          {
            version: "0x00000000",
            inputVector: "0x11111111",
            outputVector: "0x22222222",
            locktime: "0x33333333",
          },
          {
            merkleProof: "0x44444444",
            txIndexInBlock: 5,
            bitcoinHeaders: "0x66666666",
          },
          {
            txHash:
              "0xf8eaf242a55ea15e602f9f990e33f67f99dfbe25d1802bbde63cc1caabf99668",
            txOutputIndex: 8,
            txOutputValue: BigNumber.from(9999),
          },
          "0x8db50eb52063ea9d98b3eac91489a90f738986f6",
        ])
      })
    })
  })

  // eslint-disable-next-line valid-jsdoc
  /**
   * Custom assertion used to check whether the given contract function was
   * called with correct parameters. This is a workaround for Waffle's
   * `calledOnContractWith` assertion bug described in the following issue:
   * https://github.com/TrueFiEng/Waffle/issues/468
   * @param contract Contract handle
   * @param functionName Name of the checked function
   * @param parameters Array of function's parameters
   */
  function assertContractCalledWith(
    contract: MockContract,
    functionName: string,
    parameters: any[]
  ) {
    const functionCallData = contract.interface.encodeFunctionData(
      functionName,
      parameters
    )

    assert(
      (contract.provider as unknown as MockProvider).callHistory.some(
        (call) =>
          call.address === contract.address && call.data === functionCallData
      ),
      "Expected contract function was not called"
    )
  }
})
