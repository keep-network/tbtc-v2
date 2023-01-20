import { ethers } from "hardhat"
import { FakeContract, smock } from "@defi-wonderland/smock"
import type { BigNumberish } from "ethers"
import type { IRandomBeacon, WalletRegistry } from "../../../typechain"

// eslint-disable-next-line import/prefer-default-export
export async function fakeRandomBeacon(
  walletRegistry: WalletRegistry
): Promise<FakeContract<IRandomBeacon>> {
  const randomBeacon = await smock.fake<IRandomBeacon>("IRandomBeacon", {
    address: await walletRegistry.callStatic.randomBeacon(),
  })

  await (
    await ethers.getSigners()
  )[0].sendTransaction({
    to: randomBeacon.address,
    value: ethers.utils.parseEther("1000"),
  })

  return randomBeacon
}

export async function produceRelayEntry(
  walletRegistry: WalletRegistry,
  randomBeacon: FakeContract<IRandomBeacon>
): Promise<BigNumberish> {
  const relayEntry: BigNumberish = ethers.utils.randomBytes(32)

  // eslint-disable-next-line no-underscore-dangle
  await walletRegistry
    .connect(randomBeacon.wallet)
    .__beaconCallback(relayEntry, 0)

  return relayEntry
}
