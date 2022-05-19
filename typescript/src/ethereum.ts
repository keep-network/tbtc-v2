import { Bridge as ChainBridge } from "./chain"
import { Contract, providers } from "ethers"
import { abi as BridgeABI } from "@keep-network/tbtc-v2/artifacts/Bridge.json"
import { Deposit } from "./deposit"
import { RedemptionRequest } from "./redemption"
import {
  DecomposedRawTransaction,
  Proof,
  UnspentTransactionOutput,
} from "./bitcoin"

// TODO: Documentation.
export interface ProviderCredentials {
  url: string
  user?: string
  password?: string
}

// TODO: Documentation.
type ContractCredentials = ProviderCredentials & {
  address: string
}

// TODO: Documentation.
export class Bridge implements ChainBridge {
  private _bridge: Contract

  constructor(credentials: ContractCredentials) {
    const { url, user, password, address } = credentials
    const provider = new providers.JsonRpcProvider({ url, user, password })
    this._bridge = new Contract(address, `${BridgeABI}`, provider)
  }

  pendingRedemptions(
    walletPubKeyHash: string,
    redeemerOutputScript: string
  ): Promise<RedemptionRequest> {
    return Promise.resolve(undefined)
  }

  revealDeposit(
    depositTx: DecomposedRawTransaction,
    depositOutputIndex: number,
    deposit: Deposit
  ): Promise<void> {
    return Promise.resolve(undefined)
  }

  submitDepositSweepProof(
    sweepTx: DecomposedRawTransaction,
    sweepProof: Proof,
    mainUtxo: UnspentTransactionOutput
  ): Promise<void> {
    return Promise.resolve(undefined)
  }

  txProofDifficultyFactor(): Promise<number> {
    return Promise.resolve(0)
  }
}
