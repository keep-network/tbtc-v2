import { Deposit, calculateDepositRefundLocktime } from "../../deposit"
import { Address as EthereumAddress } from "../../ethereum"
import { BigNumber, utils } from "ethers"

export const DEFAULT_REFUND_PUBLIC_KEY =
  "03989d253b17a6a0f41838b84ff0d20e8898f9d7b1a98f2564da4cc29dcf8581d9"

export function generateDeposit(
  depositorAddress: string,
  amount: BigNumber,
  walletPublicKey: string,
  refundPublicKey?: string
): Deposit {
  const blindingFactor = Buffer.from(utils.randomBytes(8)).toString("hex")

  const resolvedRefundPublicKey = refundPublicKey || DEFAULT_REFUND_PUBLIC_KEY

  const refundLocktime = calculateDepositRefundLocktime(
    Math.floor(Date.now() / 1000)
  )

  return {
    depositor: new EthereumAddress(depositorAddress),
    amount,
    blindingFactor,
    walletPublicKey,
    refundPublicKey: resolvedRefundPublicKey,
    refundLocktime,
  }
}
