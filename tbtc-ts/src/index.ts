import { createDeposit, revealDeposit } from "./deposit"

export interface TBTC {
  createDeposit(): Promise<void>
  revealDeposit(): Promise<void>
}

const tbtc: TBTC = {
  createDeposit,
  revealDeposit,
}

export default tbtc
