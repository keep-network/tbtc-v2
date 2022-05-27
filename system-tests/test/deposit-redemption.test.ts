import { ElectrumClient, EthereumBridge } from "@keep-network/tbtc-v2.ts"
import { parseElectrumCredentials, setupSystemTests } from "./setup"
import { expect } from "chai"

describe("Deposit and redemption", () => {
  let electrumClient: ElectrumClient
  let depositorBridgeHandle: EthereumBridge

  before(async () => {
    const { electrumUrl, depositor, bridgeAddress } = await setupSystemTests()

    electrumClient = new ElectrumClient(parseElectrumCredentials(electrumUrl))

    depositorBridgeHandle = new EthereumBridge({
      address: bridgeAddress,
      signer: depositor,
    })
  })

  // TODO: Temporary assertion.
  it("should work", async () => {
    expect(await electrumClient.latestBlockHeight()).to.be.greaterThan(0)
    expect(await depositorBridgeHandle.txProofDifficultyFactor()).to.be.equal(1)
  })
})
