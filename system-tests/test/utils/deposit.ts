import crypto from "crypto"

import {
  BitcoinLocktimeUtils,
  BitcoinHashUtils,
  EthereumAddress,
  Hex,
} from "@keep-network/tbtc-v2.ts"

import type { DepositReceipt } from "@keep-network/tbtc-v2.ts"

/**
 * Default refund public key used for deposits. Their corresponding private key:
 * 7c246a5d2fcf476fd6f805cb8174b1cf441b13ea414e5560ca2bdc963aeb7d0c
 */
export const DEFAULT_REFUND_PUBLIC_KEY = Hex.from(
  "03989d253b17a6a0f41838b84ff0d20e8898f9d7b1a98f2564da4cc29dcf8581d9"
)

/**
 * Creates a deposit receipt based on the given parameters.
 * @param depositorAddress Ethereum address of the depositor.
 * @param walletPublicKey Compressed ECDSA public key of the target wallet.
 * @param refundPublicKey Compressed ECDSA public key that can be used for
 *        refund. Optional parameter, default value is used if not set
 *        @see {DEFAULT_REFUND_PUBLIC_KEY}.
 * @returns Deposit receipt.
 */
export function createDepositReceipt(
  depositorAddress: string,
  walletPublicKey: Hex,
  refundPublicKey?: Hex
): DepositReceipt {
  const walletPublicKeyHash = BitcoinHashUtils.computeHash160(walletPublicKey)

  const resolvedRefundPublicKey = refundPublicKey || DEFAULT_REFUND_PUBLIC_KEY
  const refundPublicKeyHash = BitcoinHashUtils.computeHash160(
    resolvedRefundPublicKey
  )

  const blindingFactor = Hex.from(crypto.randomBytes(8).toString("hex"))

  const refundLocktime = BitcoinLocktimeUtils.calculateLocktime(
    Math.floor(Date.now() / 1000),
    2592000 // 30 days
  )
  return {
    depositor: EthereumAddress.from(depositorAddress),
    walletPublicKeyHash,
    refundPublicKeyHash,
    blindingFactor,
    refundLocktime,
  }
}
