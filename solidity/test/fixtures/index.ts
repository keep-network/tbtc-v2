import { Contract } from "ethers"
import { ethers } from "hardhat"
// eslint-disable-next-line import/extensions
import type { TestERC20, TBTC, VendingMachine, Bridge } from "../../typechain"
import { to1ePrecision } from "../helpers/contract-test-helpers"

export const constants = {
  unmintFee: to1ePrecision(1, 15), // 0.001
}

export interface DeployedContracts {
  [key: string]: Contract
}

export async function vendingMachineDeployment(): Promise<DeployedContracts> {
  const TestERC20 = await ethers.getContractFactory("TestERC20")
  const tbtcV1: TestERC20 = await TestERC20.deploy()
  await tbtcV1.deployed()

  const TBTC = await ethers.getContractFactory("TBTC")
  const tbtcV2: TBTC = await TBTC.deploy()
  await tbtcV2.deployed()

  const VendingMachine = await ethers.getContractFactory("VendingMachine")
  const vendingMachine: VendingMachine = await VendingMachine.deploy(
    tbtcV1.address,
    tbtcV2.address,
    constants.unmintFee
  )
  await vendingMachine.deployed()

  const contracts: DeployedContracts = {
    tbtcV1,
    tbtcV2,
    vendingMachine,
  }

  return contracts
}
