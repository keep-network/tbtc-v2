import { waffle } from "hardhat"
import { bridgeDeployment } from "../fixtures"
import { Bridge } from "../../typechain"

describe("Bridge", () => {
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
            "0x018348cdeb551134fe1f19d378a8adec9b146671cb67b945b71bf56b20d" +
            "c2b952f0100000000ffffffff",
          outputVector:
            "0x02102700000000000017a9146ade1c799a3e5a59678e776f21be14d66dc" +
            "15ed8877ed73b00000000001600147ac2d9378a1c47e589dfb8095ca95ed2" +
            "140d2726",
          locktime: "0x00000000",
        },
        {
          fundingOutputIndex: 0,
          depositor: "0x934B98637cA318a4D6E7CA6ffd1690b8e77df637",
          blindingFactor: "0xf9f0c90d00039523",
          walletPubKey:
            "0x03989d253b17a6a0f41838b84ff0d20e8898f9d7b1a98f2564da4cc29dcf8581d9",
          refundPubKey:
            "0x0300d6f28a2f6bf9836f57fcda5d284c9a8f849316119779f0d6090830d97763a9",
          refundLocktime: "0x60bcea61",
          vault: "0x594cfd89700040163727828AE20B52099C58F02C",
        }
      )
    })
  })
})
