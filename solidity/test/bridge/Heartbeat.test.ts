/* eslint-disable @typescript-eslint/no-unused-expressions */

import { expect } from "chai"
import { ethers } from "hardhat"
import type { HeartbeatStub, HeartbeatStub__factory } from "../../typechain"

describe("Heartbeat", () => {
  let heartbeat: HeartbeatStub

  before(async () => {
    const HeartbeatStub =
      await ethers.getContractFactory<HeartbeatStub__factory>("HeartbeatStub")
    heartbeat = await HeartbeatStub.deploy()
  })

  context("when the message is empty", () => {
    it("should return false", async () => {
      const message = "0x"
      expect(await heartbeat.isValidHeartbeatMessage(message)).to.be.false
    })
  })

  context("when the message has less than 40 bytes", () => {
    it("should return false", async () => {
      // 39 bytes
      const message =
        "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"
      expect(await heartbeat.isValidHeartbeatMessage(message)).to.be.false
    })
  })

  context("when the message has more than 40 bytes", () => {
    it("should return false", async () => {
      // 41 bytes
      const message =
        "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"
      expect(await heartbeat.isValidHeartbeatMessage(message)).to.be.false
    })
  })

  context("when the message has 40 bytes", () => {
    context("when the message does not have the required prefix", () => {
      it("should return false", async () => {
        const messages = [
          "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF",
          "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000",
          "0xFF000000000000000000000000000000000000000000000000000000000000000000000000000000",
          "0xFFFF0000000000000000000000000000000000000000000000000000000000000000000000000000",
          "0xFFFFFF00000000000000000000000000000000000000000000000000000000000000000000000000",
          "0xFFFFFFFF000000000000000000000000000000000000000000000000000000000000000000000000",
          "0xFFFFFFFFFF0000000000000000000000000000000000000000000000000000000000000000000000",
          "0xFFFFFFFFFFFF00000000000000000000000000000000000000000000000000000000000000000000",
          "0xFFFFFFFFFFFFFF000000000000000000000000000000000000000000000000000000000000000000",
          "0x11111111111111111111111111111111111111111111111111111111111111111111111111111111",
          "0xFF111111111111111111111111111111111111111111111111111111111111111111111111111111",
          "0xFFFF1111111111111111111111111111111111111111111111111111111111111111111111111111",
          "0xFFFFFF11111111111111111111111111111111111111111111111111111111111111111111111111",
          "0xFFFFFFFF111111111111111111111111111111111111111111111111111111111111111111111111",
          "0xFFFFFFFFFF1111111111111111111111111111111111111111111111111111111111111111111111",
          "0xFFFFFFFFFFFF11111111111111111111111111111111111111111111111111111111111111111111",
          "0xFFFFFFFFFFFFFF111111111111111111111111111111111111111111111111111111111111111111",
          "0xFFFFFFFFFFFFF0FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF",
          "0x0FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF",
        ]

        for (let i = 0; i < messages.length; i++) {
          // eslint-disable-next-line no-await-in-loop
          expect(await heartbeat.isValidHeartbeatMessage(messages[i])).to.be
            .false
        }
      })
    })

    context("when the message has the required prefix", () => {
      it("should return true", async () => {
        const messages = [
          "0xFFFFFFFFFFFFFFFF0000000000000000000000000000000000000000000000000000000000000000",
          "0xFFFFFFFFFFFFFFFF1111111111111111111111111111111111111111111111111111111111111111",
          "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF",
        ]

        for (let i = 0; i < messages.length; i++) {
          // eslint-disable-next-line no-await-in-loop
          expect(await heartbeat.isValidHeartbeatMessage(messages[i])).to.be
            .true
        }
      })
    })
  })
})
