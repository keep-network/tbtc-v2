import { deployments, ethers } from "hardhat"
import { TestERC20, TBTC, VendingMachine } from "../../typechain"

// eslint-disable-next-line import/prefer-default-export
export default async function vendingMachineFixture(): Promise<{
  tbtcV1: TestERC20
  tbtcV2: TBTC
  vendingMachine: VendingMachine
}> {
  await deployments.fixture("VendingMachine")

  const tbtcV1: TestERC20 = await ethers.getContract("TBTCToken")
  const tbtcV2: TBTC = await ethers.getContract("TBTC")

  const vendingMachine: VendingMachine = await ethers.getContract(
    "VendingMachine"
  )

  return { tbtcV1, tbtcV2, vendingMachine }
}
