import { payments } from "bitcoinjs-lib"

/**
 * Checks if the provided script comes from a P2PKH input.
 * @param script The script to be checked.
 * @returns True if the script is P2PKH, false otherwise.
 */
function isP2PKHScript(script: Buffer): boolean {
  try {
    payments.p2pkh({ output: script })
    return true
  } catch (err) {
    return false
  }
}

/**
 * Checks if the provided script comes from a P2WPKH input.
 * @param script The script to be checked.
 * @returns True if the script is P2WPKH, false otherwise.
 */
function isP2WPKHScript(script: Buffer): boolean {
  try {
    payments.p2wpkh({ output: script })
    return true
  } catch (err) {
    return false
  }
}

/**
 * Checks if the provided script comes from a P2SH input.
 * @param script The script to be checked.
 * @returns True if the script is P2SH, false otherwise.
 */
function isP2SHScript(script: Buffer): boolean {
  try {
    payments.p2sh({ output: script })
    return true
  } catch (err) {
    return false
  }
}

/**
 * Checks if the provided script comes from a P2PKH input.
 * @param script The script to be checked.
 * @returns True if the script is P2WSH, false otherwise.
 */
function isP2WSHScript(script: Buffer): boolean {
  try {
    payments.p2wsh({ output: script })
    return true
  } catch (err) {
    return false
  }
}

/**
 * Utility functions allowing to deal with Bitcoin scripts.
 */
export const BitcoinScriptUtils = {
  isP2PKHScript,
  isP2WPKHScript,
  isP2SHScript,
  isP2WSHScript,
}
