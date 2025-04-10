import { expect } from "chai"
import { SuiAddress, Hex, setSuiAddressTestMode } from "@src/index"

// Enable test mode before running tests
setSuiAddressTestMode(true)

// Example valid SUI address (32 bytes)
const VALID_SUI_ADDRESS_HEX =
  "0x8e7c19f192126799851cdb2a820ce4cc6934f51bacc578376151b0a506c8ca81"
const VALID_SUI_ADDRESS_HEX_NO_PREFIX =
  "8e7c19f192126799851cdb2a820ce4cc6934f51bacc578376151b0a506c8ca81"

// Another valid SUI address for inequality checks
const OTHER_VALID_SUI_ADDRESS_HEX =
  "0x0000000000000000000000000000000000000000000000000000000000000001"

// Invalid examples
const INVALID_HEX_FORMAT = "0xInvalid"
const SHORT_ADDRESS_HEX = "0x123456"
const LONG_ADDRESS_HEX = VALID_SUI_ADDRESS_HEX + "00"

describe("SuiAddress", () => {
  describe("from", () => {
    it("should create an instance from a valid hex string with prefix", () => {
      const addr = SuiAddress.from(VALID_SUI_ADDRESS_HEX)
      expect(addr).to.be.instanceOf(SuiAddress)
      expect(addr.toString()).to.equal(VALID_SUI_ADDRESS_HEX)
      expect(addr.identifierHex).to.equal(VALID_SUI_ADDRESS_HEX_NO_PREFIX)
      expect(addr.type).to.equal("sui")
    })

    it("should create an instance from a valid hex string without prefix", () => {
      const addr = SuiAddress.from(VALID_SUI_ADDRESS_HEX_NO_PREFIX)
      expect(addr).to.be.instanceOf(SuiAddress)
      // toString() should add the prefix
      expect(addr.toString()).to.equal(VALID_SUI_ADDRESS_HEX)
      expect(addr.identifierHex).to.equal(VALID_SUI_ADDRESS_HEX_NO_PREFIX)
    })

    it("should throw for invalid hex format", () => {
      expect(() => SuiAddress.from(INVALID_HEX_FORMAT)).to.throw(
        /Invalid hex format/i
      )
    })

    it("should throw for addresses shorter than 32 bytes", () => {
      expect(() => SuiAddress.from(SHORT_ADDRESS_HEX)).to.throw(
        /Invalid SUI address format/i
      )
    })

    it("should throw for addresses longer than 32 bytes", () => {
      expect(() => SuiAddress.from(LONG_ADDRESS_HEX)).to.throw(
        /Invalid SUI address format/i
      )
    })

    // TODO: Add test for isValidSuiAddress failure once the import issue is resolved
    // it("should throw if isValidSuiAddress returns false", () => {
    //   // Need a hex string that is 32 bytes but considered invalid by the util
    //   const INVALID_BUT_CORRECT_LENGTH = "0x" + "11".repeat(32)
    //   expect(() => SuiAddress.from(INVALID_BUT_CORRECT_LENGTH)).to.throw(
    //     /Invalid SUI address format/i
    //   )
    // })
  })

  describe("equals", () => {
    it("should return true for the same address instance", () => {
      const addr1 = SuiAddress.from(VALID_SUI_ADDRESS_HEX)
      expect(addr1.equals(addr1)).to.be.true
    })

    it("should return true for different instances of the same address", () => {
      const addr1 = SuiAddress.from(VALID_SUI_ADDRESS_HEX)
      const addr2 = SuiAddress.from(VALID_SUI_ADDRESS_HEX)
      expect(addr1.equals(addr2)).to.be.true
      expect(addr2.equals(addr1)).to.be.true
    })

    it("should return false for different addresses", () => {
      const addr1 = SuiAddress.from(VALID_SUI_ADDRESS_HEX)
      const addr2 = SuiAddress.from(OTHER_VALID_SUI_ADDRESS_HEX)
      expect(addr1.equals(addr2)).to.be.false
      expect(addr2.equals(addr1)).to.be.false
    })

    it("should return false when comparing with other ChainIdentifier types", () => {
      const suiAddr = SuiAddress.from(VALID_SUI_ADDRESS_HEX)
      // Create a mock ChainIdentifier with a different type
      const otherAddr = {
        identifierHex: VALID_SUI_ADDRESS_HEX_NO_PREFIX,
        type: "ethereum", // Different type
        equals: (other: any) => other.identifierHex === VALID_SUI_ADDRESS_HEX_NO_PREFIX,
      }
      expect(suiAddr.equals(otherAddr)).to.be.false
    })

    it("should return false for null or undefined", () => {
      const addr1 = SuiAddress.from(VALID_SUI_ADDRESS_HEX)
      expect(addr1.equals(null as any)).to.be.false
      expect(addr1.equals(undefined as any)).to.be.false
    })
  })

  describe("toString", () => {
    it("should return the prefixed hex string", () => {
      const addr = SuiAddress.from(VALID_SUI_ADDRESS_HEX)
      expect(addr.toString()).to.equal(VALID_SUI_ADDRESS_HEX)
    })
  })

  describe("identifierHex", () => {
    it("should return the unprefixed hex string", () => {
      const addr = SuiAddress.from(VALID_SUI_ADDRESS_HEX)
      expect(addr.identifierHex).to.equal(VALID_SUI_ADDRESS_HEX_NO_PREFIX)
    })
  })

  describe("type", () => {
    it("should return 'sui'", () => {
      const addr = SuiAddress.from(VALID_SUI_ADDRESS_HEX)
      expect(addr.type).to.equal("sui")
    })
  })
}) 