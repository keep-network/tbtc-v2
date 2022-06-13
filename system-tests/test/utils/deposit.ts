import crypto from "crypto"

import { Contract, utils } from "ethers"
import TBTC from "@keep-network/tbtc-v2.ts"

import type { BigNumber } from "ethers"
import type { UnspentTransactionOutput } from "@keep-network/tbtc-v2.ts/dist/bitcoin"
import type { Deposit } from "@keep-network/tbtc-v2.ts/dist/deposit"
import type { SystemTestsContext } from "./context"

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
 * @param refundPublicKey Compressed ECDSA public key that can be used for
 *        refund. Optional parameter, default value is used if not set
 *        @see {DEFAULT_REFUND_PUBLIC_KEY}.
 * @returns Deposit object.
 */
export function generateDeposit(
  depositorAddress: string,
  amount: BigNumber,
  walletPublicKey: string,
  refundPublicKey?: string
): Deposit {
  const blindingFactor = crypto.randomBytes(8).toString("hex")

  const resolvedRefundPublicKey = refundPublicKey || DEFAULT_REFUND_PUBLIC_KEY

  const refundLocktime = TBTC.computeDepositRefundLocktime(
    Math.floor(Date.now() / 1000)
  )

  return {
    // TODO: The tbtc-v2.ts library should expose the EthereumIdentifier
    //       class that will handle that conversion.
    depositor: {
      identifierHex: depositorAddress.substring(2).toLowerCase(),
    },
    amount,
    blindingFactor,
    walletPublicKey,
    refundPublicKey: resolvedRefundPublicKey,
    refundLocktime,
  }
}

/**
 * Gets a deposit from the bridge.
 * @param systemTestsContext System tests context.
 * @param depositUtxo The UTXO produced by the deposit Bitcoin transaction.
 * @returns Deposit data as stored in the bridge.
 */
export async function getDepositFromBridge(
  systemTestsContext: SystemTestsContext,
  depositUtxo: UnspentTransactionOutput
): Promise<{ revealedAt: number; sweptAt: number; treasuryFee: BigNumber }> {
  // TODO: The tbtc-v2.ts library should expose a method to get the deposit in a
  //       seamless way. The current implementation of this function is
  //       just a workaround and the tbtc-v2.ts library implementation should
  //       be preferred once it is ready.

  const bridgeDeploymentInfo = systemTestsContext.deployedContracts.Bridge

  const bridge = new Contract(
    bridgeDeploymentInfo.address,
    bridgeDeploymentInfo.abi,
    systemTestsContext.maintainer
  )

  const transactionHashLE = Buffer.from(depositUtxo.transactionHash, "hex")
    .reverse()
    .toString("hex")

  const depositKey = utils.solidityKeccak256(
    ["bytes32", "uint32"],
    [`0x${transactionHashLE}`, depositUtxo.outputIndex]
  )

  return bridge.deposits(depositKey)
}
