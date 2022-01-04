import { waffle } from "hardhat"
import { BigNumber } from "ethers"
import { bridgeDeployment } from "../fixtures"
import { Bridge } from "../../typechain"

describe.only("Bridge", () => {
  let bridge: Bridge

  before(async () => {
    const contracts = await waffle.loadFixture(bridgeDeployment)
    bridge = contracts.bridge as Bridge
  })

  describe("revealDeposit", () => {
    it("should work", async () => {
      await bridge.revealDeposit(
        {
          version: "0x01000000",
          inputVector:
            "0x01018348cdeb551134fe1f19d378a8adec9b146671cb67b945b71bf56b20d" +
            "c2b952f0100000000ffffffff",
          outputVector:
            "0x02102700000000000017a914867120d5480a9cc0c11c1193fa59b3a92e852" +
            "da7877ed73b00000000001600147ac2d9378a1c47e589dfb8095ca95ed2140d" +
            "2726024730440220508131fc4e8ba454877cc5a44653580fe5de813a2a36ea1" +
            "bba02aac66d6d2a8e022017aa81482239513e672e30ad33db3aa8460fcc09b4" +
            "e5e7933aeb1aee02bf6361012102ee067a0273f2e3ba88d23140a24fdb290f2" +
            "7bbcd0f94117a9c65be3911c5c04e",
          locktime: "0x00000000",
        },
        {
          fundingOutputIndex: 0,
          depositor: "0x934B98637cA318a4D6E7CA6ffd1690b8e77df637",
          blindingFactor: BigNumber.from("0xf9f0c90d00039523"),
          walletPubKey:
            "0x03989d253b17a6a0f41838b84ff0d20e8898f9d7b1a98f2564da4cc29dcf8581d9",
          refundPubKey:
            "0x0300d6f28a2f6bf9836f57fcda5d284c9a8f849316119779f0d6090830d97763a9",
          refundLocktime: 1642773600,
        },
        "0x594cfd89700040163727828AE20B52099C58F02C"
      )
    })
  })
})
