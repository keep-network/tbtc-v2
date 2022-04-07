/* eslint-disable no-underscore-dangle */
import { ethers, helpers, waffle } from "hardhat"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import chai, { expect } from "chai"
import { smock } from "@defi-wonderland/smock"
import type { FakeContract } from "@defi-wonderland/smock"
import type { Bridge, BridgeStub, IWalletRegistry } from "../../typechain"
import bridgeFixture from "./bridge-fixture"

chai.use(smock.matchers)

const fixture = async () => bridgeFixture()

describe("Bridge - Wallets", () => {
  let governance: SignerWithAddress
  let thirdParty: SignerWithAddress

  let walletRegistry: FakeContract<IWalletRegistry>
  let bridge: Bridge & BridgeStub

  before(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({ governance, thirdParty, walletRegistry, bridge } =
      await waffle.loadFixture(fixture))
  })
})
