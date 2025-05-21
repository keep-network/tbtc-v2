import {
  chainIdFromSigner,
  ethereumAddressFromSigner,
  EthereumSigner,
} from "../ethereum"
import { BaseL2BitcoinDepositor } from "./l2-bitcoin-depositor"
import { BaseL2TBTCToken } from "./l2-tbtc-token"
import { Chains, DestinationChainInterfaces } from "../contracts"

export * from "./l2-bitcoin-depositor"
export * from "./l2-tbtc-token"

/**
 * Loads Base implementation of tBTC cross-chain contracts for the given Base
 * chain ID and attaches the given signer there.
 * @param signer Signer that should be attached to the contracts.
 * @param chainId Base chain ID.
 * @returns Handle to the contracts.
 * @throws Throws an error if the signer's Base chain ID is other than
 *         the one used to load contracts.
 */
export async function loadBaseCrossChainContracts(
  signer: EthereumSigner,
  chainId: Chains.Base
): Promise<DestinationChainInterfaces> {
  const signerChainId = await chainIdFromSigner(signer)
  if (signerChainId !== chainId) {
    throw new Error(
      "Signer uses different chain than Base cross-chain contracts"
    )
  }

  const l2BitcoinDepositor = new BaseL2BitcoinDepositor(
    { signerOrProvider: signer },
    chainId
  )
  l2BitcoinDepositor.setDepositOwner(await ethereumAddressFromSigner(signer))

  const l2TbtcToken = new BaseL2TBTCToken({ signerOrProvider: signer }, chainId)

  return {
    destinationChainBitcoinDepositor: l2BitcoinDepositor,
    destinationChainTbtcToken: l2TbtcToken,
  }
}
