/**
 * Represents a generic chain identifier.
 */
export interface Identifier {
  /**
   * Identifier as an un-prefixed hex string.
   */
  identifierHex: string
  /**
   * Checks if two identifiers are equal.
   *
   * @param identifier Another identifier
   */
  equals(identifier: Identifier): boolean
}
