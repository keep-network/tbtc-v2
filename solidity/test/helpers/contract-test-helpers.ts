import { BigNumber } from "@ethersproject/bignumber"
import { ethers } from "hardhat"

// TODO: Replace with the helpers library from hardhat
export function to1ePrecision(n: number, precision: number): BigNumber {
  const decimalMultiplier = ethers.BigNumber.from(10).pow(precision)
  return ethers.BigNumber.from(n).mul(decimalMultiplier)
}

// TODO: Replace with the helpers library from hardhat
export function to1e18(n: number): BigNumber {
  const decimalMultiplier = ethers.BigNumber.from(10).pow(18)
  return ethers.BigNumber.from(n).mul(decimalMultiplier)
}

// TODO: Replace with the helpers library from hardhat
export async function getBlockTime(blockNumber: number): Promise<number> {
  return (await ethers.provider.getBlock(blockNumber)).timestamp
}
