import crypto from "crypto"

import { calculateDepositRefundLocktime } from "@keep-network/tbtc-v2.ts/dist/src/deposit"
import { EthereumAddress } from "@keep-network/tbtc-v2.ts/dist/src"
import { constants } from "ethers"
import { computeHash160 } from "@keep-network/tbtc-v2.ts/dist/src/bitcoin"

import type { BigNumber } from "ethers"
import type { Deposit } from "@keep-network/tbtc-v2.ts/dist/src/deposit"

/**
 * Default refund public key used for deposits. Their corresponding private key:
 * 7c246a5d2fcf476fd6f805cb8174b1cf441b13ea414e5560ca2bdc963aeb7d0c
 */
export const DEFAULT_REFUND_PUBLIC_KEY =
  "03989d253b17a6a0f41838b84ff0d20e8898f9d7b1a98f2564da4cc29dcf8581d9"

/**
 * Generates a deposit object based on the given parameters.
 * @param depositorAddress Ethereum address of the depositor.
 * @param amount Amount of the deposit in satoshi.
 * @param walletPublicKey Compressed ECDSA public key of the target wallet.
 * @param vaultAddress Ethereum address of the Bank vault to which the deposit
 *        is routed to. Optional parameter, if not set the zero address is used.
 * @param refundPublicKey Compressed ECDSA public key that can be used for
 *        refund. Optional parameter, default value is used if not set
 *        @see {DEFAULT_REFUND_PUBLIC_KEY}.
 * @returns Deposit object.
 */
export function generateDeposit(
  depositorAddress: string,
  amount: BigNumber,
  walletPublicKey: string,
  vaultAddress?: string,
  refundPublicKey?: string
): Deposit {
  const blindingFactor = crypto.randomBytes(8).toString("hex")

  const walletPublicKeyHash = computeHash160(walletPublicKey)

  const resolvedRefundPublicKey = refundPublicKey || DEFAULT_REFUND_PUBLIC_KEY
  const refundPublicKeyHash = computeHash160(resolvedRefundPublicKey)

  const refundLocktime = calculateDepositRefundLocktime(
    Math.floor(Date.now() / 1000),
    2592000 // 30 days
  )

  const resolvedVaultAddress = new EthereumAddress(
    vaultAddress || constants.AddressZero
  )

  return {
    depositor: new EthereumAddress(depositorAddress),
    amount,
    blindingFactor,
    walletPublicKeyHash,
    refundPublicKeyHash,
    refundLocktime,
    vault: resolvedVaultAddress,
  }
}
