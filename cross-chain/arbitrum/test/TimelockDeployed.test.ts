import { deployments, ethers } from "hardhat"
import { expect } from "chai"

import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import type { TimelockDeployed } from "../typechain"

const ONE_DAY_IN_SECONDS = 86400

describe("TimelockDeployed", async () => {
  let deployer: SignerWithAddress
  let proposer: SignerWithAddress
  let executor: SignerWithAddress
  let timelockDeployed: TimelockDeployed

  let PROPOSER_ROLE: string
  let EXECUTOR_ROLE: string

  before(async () => {
    await deployments.fixture(["TimelockDeployed"])

    const signers = await ethers.getSigners()
    if (signers.length < 3) {
      throw new Error(
        `Not enough signers available for test. Need at least 3, but got ${signers.length}.`
      )
    }
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;[deployer, proposer, executor] = signers

    const TimelockDeployedFactory = await ethers.getContractFactory(
      "TimelockDeployed"
    )
    timelockDeployed = (await TimelockDeployedFactory.connect(deployer).deploy(
      ONE_DAY_IN_SECONDS, // minDelay
      [proposer.address], // proposers
      [executor.address] // executors
    )) as TimelockDeployed

    PROPOSER_ROLE = await timelockDeployed.PROPOSER_ROLE()
    EXECUTOR_ROLE = await timelockDeployed.EXECUTOR_ROLE()
  })

  describe("deployment", async () => {
    it("should deploy the contract", async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      expect(timelockDeployed.address).to.not.be.null
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      expect(timelockDeployed.address).to.not.be.undefined
    })

    it("should set the minDelay", async () => {
      expect(await timelockDeployed.getMinDelay()).to.be.equal(
        ONE_DAY_IN_SECONDS
      )
    })

    it("should set the proposer role", async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      expect(await timelockDeployed.hasRole(PROPOSER_ROLE, proposer.address)).to
        .be.true
    })

    it("should set the executor role", async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      expect(await timelockDeployed.hasRole(EXECUTOR_ROLE, executor.address)).to
        .be.true
    })
  })
})
