import { deployments, helpers } from "hardhat"
import { TestERC20, TBTC, VendingMachine } from "../../typechain"

// eslint-disable-next-line import/prefer-default-export
export default async function vendingMachineFixture(): Promise<{
  tbtcV1: TestERC20
  tbtcV2: TBTC
  vendingMachine: VendingMachine
}> {
  await deployments.fixture("VendingMachine")

  const tbtcV1: TestERC20 = await helpers.contracts.getContract("TBTCToken")
  const tbtcV2: TBTC = await helpers.contracts.getContract("TBTC")

  const vendingMachine: VendingMachine = await helpers.contracts.getContract(
    "VendingMachine"
  )

  return { tbtcV1, tbtcV2, vendingMachine }
}
