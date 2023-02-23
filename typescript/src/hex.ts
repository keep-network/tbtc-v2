/**
 * Represents a hexadecimal value.
 */
export class Hex {
  protected readonly _hex: Buffer

  protected constructor(value: Buffer | string) {
    if (typeof value === "string") {
      if (!value.match(/^(0x|0X)?[0-9A-Fa-f]*$/)) {
        throw new Error(`invalid format of hex string`)
      }

      if (value.length % 2 !== 0) {
        throw new Error(`invalid length of hex string: ${value.length}`)
      }

      value = value.replace(/^(0x|0X)/, "")

      this._hex = Buffer.from(value, "hex")
    } else {
      this._hex = Buffer.from(value)
    }
  }

  static from(value: Buffer | string): Hex {
    return new Hex(value)
  }

  /**
   * @returns Hexadecimal value as a Buffer.
   */
  toBuffer(): Buffer {
    return Buffer.from(this._hex)
  }

  /**
   * @returns Unprefixed hexadecimal string.
   */
  toString(): string {
    return this._hex.toString("hex")
  }

  /**
   * @returns Hexadecimal string prefixed with '0x'.
   */
  toPrefixedString(): string {
    const str = this.toString()
    return str.length > 0 ? "0x" + str : ""
  }

  /**
   * Checks if other value equals the current value.
   *
   * @param otherValue Other value that will be compared to this value.
   * @returns True if both values are equal, false otherwise.
   */
  equals(otherValue: Hex): boolean {
    return this.toString() === otherValue.toString()
  }

  /**
   * @returns Reversed hexadecimal value.
   */
  reverse(): Hex {
    return Hex.from(Buffer.from(this._hex).reverse())
  }
}
