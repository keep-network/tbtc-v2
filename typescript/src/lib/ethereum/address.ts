import { Identifier as ChainIdentifier } from "../contracts"
import { utils } from "ethers"

/**
 * Represents an Ethereum address.
 */
// TODO: Make Address extends Hex
export class Address implements ChainIdentifier {
  readonly identifierHex: string

  // TODO: Make constructor private
  constructor(address: string) {
    let validAddress: string

    try {
      validAddress = utils.getAddress(address)
    } catch (e) {
      throw new Error(`Invalid Ethereum address`)
    }

    this.identifierHex = validAddress.substring(2).toLowerCase()
  }

  static from(address: string): Address {
    return new Address(address)
  }

  // TODO: Remove once extends Hex
  equals(otherValue: Address): boolean {
    return this.identifierHex === otherValue.identifierHex
  }
}
