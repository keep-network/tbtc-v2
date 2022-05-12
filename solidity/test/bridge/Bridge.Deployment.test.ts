/* eslint-disable @typescript-eslint/no-unused-expressions */
import { deployments, ethers, upgrades } from "hardhat"
import chai, { expect } from "chai"
import chaiAsPromised from "chai-as-promised"

import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import type { ProxyAdmin, Bridge } from "../../typechain"
import type { TransparentUpgradeableProxy } from "../../typechain/TransparentUpgradeableProxy"

chai.use(chaiAsPromised)

const { AddressZero } = ethers.constants

describe("Bridge - Deployment", async () => {
  let deployer: SignerWithAddress
  let governance: SignerWithAddress
  let esdm: SignerWithAddress

  let bridge: Bridge
  let bridgeProxy: TransparentUpgradeableProxy
  let proxyAdmin: ProxyAdmin

  before(async () => {
    await deployments.fixture()
    ;({ deployer, governance, esdm } = await ethers.getNamedSigners())

    bridge = await ethers.getContract<Bridge>("Bridge")

    bridgeProxy = await ethers.getContractAt<TransparentUpgradeableProxy>(
      "TransparentUpgradeableProxy",
      bridge.address
    )

    proxyAdmin = (await upgrades.admin.getInstance()) as ProxyAdmin

    expect(deployer.address).to.be.not.equal(
      governance.address,
      "deployer is the same as governance"
    )
  })

  it("should set Bridge proxy admin", async () => {
    // To let a non-proxy-admin read the admin we have to read it directly from
    // the storage slot, see: https://docs.openzeppelin.com/contracts/4.x/api/proxy#TransparentUpgradeableProxy-admin--
    expect(
      ethers.utils.defaultAbiCoder.decode(
        ["address"],
        await ethers.provider.getStorageAt(
          bridge.address,
          "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103"
        )
      )[0]
    ).to.be.equal(
      proxyAdmin.address,
      "invalid Bridge proxy admin (read from storage slot)"
    )

    expect(
      await bridgeProxy.connect(proxyAdmin.address).callStatic.admin()
    ).to.be.equal(proxyAdmin.address, "invalid Bridge proxy admin")
  })

  it("should set ProxyAdmin owner", async () => {
    expect(await proxyAdmin.owner()).to.be.equal(
      esdm.address,
      "invalid ProxyAdmin owner"
    )
  })

  it("should set Bridge governance", async () => {
    expect(await bridge.governance()).to.be.equal(
      // TODO: Once BridgeGovernance is implemented and set update this expectation
      // to be equal bridgeGovernance.address.
      governance.address,
      "invalid Bridge governance"
    )
  })

  // TODO: Once BridgeGovernance is implemented and set enable this test
  // https://github.com/keep-network/tbtc-v2/issues/147
  // it("should set BridgeGovernance owner", async () => {
  //   expect(
  //     await bridgeGovernance.owner(),
  //     "invalid BridgeGovernance owner"
  //   ).equal(governance.address)
  // })

  it("should revert when initialize called again", async () => {
    await expect(
      bridge.initialize(AddressZero, AddressZero, AddressZero, AddressZero, 0)
    ).to.be.revertedWith("Initializable: contract is already initialized")
  })
})
