import { BigNumber } from "@ethersproject/units/node_modules/@ethersproject/bignumber"
import { ethers } from "hardhat"
import * as env from "hardhat"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"

export function to1ePrecision(n: number, precision: number): BigNumber {
  const decimalMultiplier = ethers.BigNumber.from(10).pow(precision)
  return ethers.BigNumber.from(n).mul(decimalMultiplier)
}

export function to1e18(n: number): BigNumber {
  const decimalMultiplier = ethers.BigNumber.from(10).pow(18)
  return ethers.BigNumber.from(n).mul(decimalMultiplier)
}

export async function getBlockTime(blockNumber: number): Promise<number> {
  return (await ethers.provider.getBlock(blockNumber)).timestamp
}

export async function impersonateAccount(
  accountAddress: string,
  amount = "0x10000000000000000000"
): Promise<SignerWithAddress> {
  await env.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [accountAddress],
  })

  await env.network.provider.send("hardhat_setBalance", [
    accountAddress,
    amount,
  ])

  return ethers.getSigner(accountAddress)
}
