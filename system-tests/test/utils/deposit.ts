import { BigNumber } from "ethers"
import { Deposit } from "@keep-network/tbtc-v2.ts/dist/deposit"
import crypto from "crypto"
import TBTC from "@keep-network/tbtc-v2.ts"

/**
 * Default refund public key used for deposits. Their corresponding private key:
 * 7c246a5d2fcf476fd6f805cb8174b1cf441b13ea414e5560ca2bdc963aeb7d0c
 */
export const DEFAULT_REFUND_PUBLIC_KEY =
  "03989d253b17a6a0f41838b84ff0d20e8898f9d7b1a98f2564da4cc29dcf8581d9"

// TODO: Documentation
export function generateDeposit(
  depositorAddress: string,
  amount: BigNumber,
  walletPublicKey: string,
  refundPublicKey?: string
): Deposit {
  const blindingFactor = crypto.randomBytes(8).toString("hex")

  const resolvedRefundPublicKey = refundPublicKey
    ? refundPublicKey
    : DEFAULT_REFUND_PUBLIC_KEY

  const refundLocktime = TBTC.computeDepositRefundLocktime(
    Math.floor(Date.now() / 1000)
  )

  return {
    // TODO: The tbtc-v2.ts library should expose the EthereumIdentifier
    //       class that will handle that conversion.
    depositor: {
      identifierHex: depositorAddress.substring(2).toLowerCase(),
    },
    amount: amount,
    blindingFactor: blindingFactor,
    walletPublicKey: walletPublicKey,
    refundPublicKey: resolvedRefundPublicKey,
    refundLocktime: refundLocktime,
  }
}
