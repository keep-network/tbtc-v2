import { expect } from "chai"
import { BigNumber } from "ethers"
import { SuiTBTCToken, SuiAddress, ChainIdentifier } from "@src/index"
// Mock SuiClient (replace with a more robust mocking library if available)
const mockSuiClient = {
  getBalance: async (params: { owner: string; coinType: string }) => {
    console.log("Mock getBalance called with:", params)
    // Simulate returning a balance for a specific owner/coinType
    if (
      params.owner === "0xVALID_OWNER_ADDRESS" &&
      params.coinType === "0xPACKAGE::tbtc::TBTC"
    ) {
      return {
        coinType: params.coinType,
        coinObjectCount: 1,
        totalBalance: "123000000000", // 123 * 10^9 (9 decimals)
        lockedBalance: {},
      }
    }
    return {
      coinType: params.coinType,
      coinObjectCount: 0,
      totalBalance: "0",
      lockedBalance: {},
    }
  },
} as any // Cast to any to avoid implementing all SuiClient methods

const TEST_PACKAGE_ID = "0xPACKAGE"
const TEST_COIN_TYPE = `${TEST_PACKAGE_ID}::tbtc::TBTC`
const VALID_OWNER_SUI_ADDRESS = "0xVALID_OWNER_ADDRESS"
const OTHER_OWNER_SUI_ADDRESS = "0xOTHER_OWNER_ADDRESS"

describe("SuiTBTCToken", () => {
  let suiTbtcToken: SuiTBTCToken

  beforeEach(() => {
    suiTbtcToken = new SuiTBTCToken(
      mockSuiClient,
      TEST_PACKAGE_ID,
      TEST_COIN_TYPE
    )
  })

  describe("constructor", () => {
    it("should create an instance", () => {
      expect(suiTbtcToken).to.be.instanceOf(SuiTBTCToken)
    })
  })

  describe("getChainIdentifier", () => {
    it("should return the contract address as ChainIdentifier", () => {
      const identifier = suiTbtcToken.getChainIdentifier()
      expect(identifier).to.be.instanceOf(SuiAddress)
      expect(identifier.toString()).to.equal(TEST_PACKAGE_ID)
    })
  })

  describe("balanceOf", () => {
    it("should return the correct balance for a known address", async () => {
      const owner = SuiAddress.from(VALID_OWNER_SUI_ADDRESS)
      const balance = await suiTbtcToken.balanceOf(owner)
      // Expected: 123 * 10^9 (SUI decimals) * 10^(18-9) (Interface adjustment)
      //         = 123 * 10^18
      expect(balance.toString()).to.equal("123000000000000000000")
    })

    it("should return zero balance for an unknown address", async () => {
      const owner = SuiAddress.from(OTHER_OWNER_SUI_ADDRESS)
      const balance = await suiTbtcToken.balanceOf(owner)
      expect(balance.toString()).to.equal("0")
    })

    it("should throw if identifier is not a SuiAddress", async () => {
      const invalidIdentifier: ChainIdentifier = {
        identifierHex: "whatever",
        equals: () => false,
      }
      await expect(suiTbtcToken.balanceOf(invalidIdentifier)).to.be.rejectedWith(
        "Identifier must be a SuiAddress"
      )
    })

    // TODO: Add test for error handling in getBalance
  })
}) 