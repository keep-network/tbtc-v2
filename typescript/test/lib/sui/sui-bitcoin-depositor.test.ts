import chai, { expect } from "chai"
import chaiAsPromised from "chai-as-promised"
import { BigNumber } from "ethers"
import {
  SuiBitcoinDepositor,
  SuiAddress,
  Hex,
  DepositReceipt,
  BitcoinRawTxVectors,
  CrossChainExtraDataEncoder,
  ChainIdentifier,
  setSuiAddressTestMode,
} from "@src/index"

// Import EthereumAddress to create a valid ChainIdentifier
import { EthereumAddress } from "@src/lib/ethereum/address"

// Enable test mode before running the tests
setSuiAddressTestMode(true)

chai.use(chaiAsPromised)

// Mock SuiClient 
const mockSuiClient = {
  getBalance: async (params: { owner: string; coinType: string }) => { 
    // Dummy implementation for token tests if needed
    return { totalBalance: "0" } 
  },
  signAndExecuteTransaction: async (params: { transaction: any; signer: any; options?: any }) => {
    console.log("Mock signAndExecuteTransaction called with:", params.transaction?.kind)
    // Simulate successful transaction execution
    return {
      digest: "mockTxDigest" + Date.now(), // Return a mock digest
      effects: {
        status: { status: "success" },
      },
    }
  },
  // Add other methods if needed by the tests
} as any

// Mock Signer
const mockSigner = {
  getAddress: async () => "0xSIGNER_ADDRESS",
  signData: async (data: any) => "mockSignature",
  // Add other methods if needed
} as any

const TEST_PACKAGE_ID = "0x1234567890123456789012345678901234567890"
const DEPOSIT_OWNER_ADDRESS = "0x8e7c19f192126799851cdb2a820ce4cc6934f51bacc578376151b0a506c8ca81"

describe("SuiBitcoinDepositor", () => {
  let suiDepositor: SuiBitcoinDepositor
  let depositOwner: SuiAddress

  // Mock data (replace with realistic values as needed)
  const mockDepositTx: BitcoinRawTxVectors = {
    version: Hex.from("01000000"),
    inputs: Hex.from("0100000000000000000000000000000000000000000000000000000000000000000000000000000000"),
    outputs: Hex.from("0100000000000000000000000000000000000000000000000000000000000000"),
    locktime: Hex.from("00000000"),
  }
  const mockDepositOutputIndex = 0
  const mockDepositReceipt: DepositReceipt = {
    depositor: EthereumAddress.from("0x0123456789012345678901234567890123456789"), 
    blindingFactor: Hex.from("abcdef010203"), // Use realistic hex
    walletPublicKeyHash: Hex.from("1234abcd".repeat(5)), // Use 20-byte hex
    refundPublicKeyHash: Hex.from("5678efab".repeat(5)), // Use 20-byte hex
    refundLocktime: Hex.from("aabbccdd"),
    extraData: Hex.from("00".repeat(32)), // Will be set properly in tests
  }

  beforeEach(() => {
    depositOwner = SuiAddress.from(DEPOSIT_OWNER_ADDRESS)
    suiDepositor = new SuiBitcoinDepositor(
      mockSuiClient,
      TEST_PACKAGE_ID,
      mockSigner
    )
    suiDepositor.setDepositOwner(depositOwner)

    // Set extraData based on depositOwner for initializeDeposit tests
    const encoder = new CrossChainExtraDataEncoder("Sui")
    mockDepositReceipt.extraData = encoder.encodeDepositOwner(depositOwner)
  })

  describe("constructor", () => {
    it.skip("should create an instance", () => {
      expect(suiDepositor).to.be.instanceOf(SuiBitcoinDepositor)
    })
  })

  describe("set/getDepositOwner", () => {
    it.skip("should set and get the deposit owner", () => {
      expect(suiDepositor.getDepositOwner()).to.equal(depositOwner)
    })

    it.skip("should throw when setting non-SuiAddress as owner", () => {
       const invalidOwner: ChainIdentifier = {
         identifierHex: "whatever",
         equals: () => false,
       }
      expect(() => suiDepositor.setDepositOwner(invalidOwner)).to.throw(
        "Deposit owner must be a SuiAddress"
      )
    })
  })

  describe("extraDataEncoder", () => {
    it.skip("should return a CrossChainExtraDataEncoder instance", () => {
      expect(suiDepositor.extraDataEncoder()).to.be.instanceOf(
        CrossChainExtraDataEncoder
      )
    })
  })

  describe("initializeDeposit", () => {
    it.skip("should call signAndExecuteTransaction with correct parameters", async () => {
      const result = await suiDepositor.initializeDeposit(
        mockDepositTx,
        mockDepositOutputIndex,
        mockDepositReceipt
      )
      expect(result).to.be.instanceOf(Hex)
      expect(result.toString()).to.match(/^0xmockTxDigest/)
      // TODO: Add more specific assertions on the transaction block construction
      // if possible, e.g., by spying on txb.moveCall or inspecting mockSuiClient calls
    })

    it.skip("should throw if deposit owner is not set", async () => {
      // Create instance without setting owner
      const depositor = new SuiBitcoinDepositor(
        mockSuiClient,
        TEST_PACKAGE_ID,
        mockSigner
      )
      await expect(
        depositor.initializeDeposit(
          mockDepositTx,
          mockDepositOutputIndex,
          mockDepositReceipt
        )
      ).to.be.rejectedWith("Deposit owner must be set")
    })

    it.skip("should throw if vault is provided and not a SuiAddress", async () => {
      const invalidVault: ChainIdentifier = {
        identifierHex: "vault",
        equals: () => false,
      }
       await expect(
         suiDepositor.initializeDeposit(
           mockDepositTx,
           mockDepositOutputIndex,
           mockDepositReceipt,
           invalidVault
         )
       ).to.be.rejectedWith("Vault identifier must be a SuiAddress")
    })

    // TODO: Add tests for:
    // - Error handling when signAndExecuteTransaction fails
    // - Correct argument mapping/serialization (requires more detailed mocking/spying)
    // - Handling optional vault correctly if Move function signature differs
  })
}) 