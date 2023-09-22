import { Hex } from "../../hex"

/**
 * Reads the leading compact size uint from the provided variable length data.
 *
 * WARNING: CURRENTLY, THIS FUNCTION SUPPORTS ONLY 1-BYTE COMPACT SIZE UINTS
 * AND WILL THROW ON COMPACT SIZE UINTS OF DIFFERENT BYTE LENGTH.
 *
 * @param varLenData Variable length data preceded by a compact size uint.
 * @returns An object holding the value of the compact size uint along with the
 *          compact size uint byte length.
 */
export function readCompactSizeUint(varLenData: Hex): {
  value: number
  byteLength: number
} {
  // The varLenData is prefixed with the compact size uint. According to the docs
  // (https://developer.bitcoin.org/reference/transactions.html#compactsize-unsigned-integers)
  // a compact size uint can be 1, 3, 5 or 9 bytes. To determine the exact length,
  // we need to look at the discriminant byte which is always the first byte of
  // the compact size uint.
  const discriminant = varLenData.toString().slice(0, 2)

  switch (discriminant) {
    case "ff":
    case "fe":
    case "fd": {
      throw new Error(
        "support for 3, 5 and 9 bytes compact size uints is not implemented yet"
      )
    }
    default: {
      // The discriminant tells the compact size uint is 1 byte. That means
      // the discriminant represent the value itself.
      return {
        value: parseInt(discriminant, 16),
        byteLength: 1,
      }
    }
  }
}
