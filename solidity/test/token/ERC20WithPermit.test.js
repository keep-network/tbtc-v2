const { expect } = require("chai")
const {
  lastBlockTime,
  to1e18,
  ZERO_ADDRESS,
} = require("../helpers/contract-test-helpers")

describe("ERC20WithPermit", () => {
  // default Hardhat's networks blockchain, see https://hardhat.org/config/
  const hardhatNetworkId = 31337

  const initialSupply = to1e18(100)

  let owner
  let initialHolder
  let recipient
  let anotherAccount

  let token

  beforeEach(async () => {
    ;[owner, initialHolder, recipient, anotherAccount] =
      await ethers.getSigners()

    const ERC20WithPermit = await ethers.getContractFactory("ERC20WithPermit")
    token = await ERC20WithPermit.deploy("My Token", "MT")
    await token.deployed()

    await token.mint(initialHolder.address, initialSupply)
  })

  it("should have a name", async () => {
    expect(await token.name()).to.equal("My Token")
  })

  it("should have a symbol", async () => {
    expect(await token.symbol()).to.equal("MT")
  })

  it("should have 18 decimals", async () => {
    expect(await token.decimals()).to.equal(18)
  })

  describe("totalSupply", () => {
    it("should return the total amount of tokens", async () => {
      expect(await token.totalSupply()).to.equal(initialSupply)
    })
  })

  describe("permit_typehash", () => {
    it("should be keccak256 of EIP2612 Permit message", async () => {
      const expected = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes(
          "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
        )
      )
      expect(await token.PERMIT_TYPEHASH()).to.equal(expected)
    })
  })

  describe("domain_separator", () => {
    it("should be keccak256 of EIP712 domain struct", async () => {
      const keccak256 = ethers.utils.keccak256
      const defaultAbiCoder = ethers.utils.defaultAbiCoder
      const toUtf8Bytes = ethers.utils.toUtf8Bytes

      const expected = keccak256(
        defaultAbiCoder.encode(
          ["bytes32", "bytes32", "bytes32", "uint256", "address"],
          [
            keccak256(
              toUtf8Bytes(
                "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
              )
            ),
            keccak256(toUtf8Bytes("My Token")),
            keccak256(toUtf8Bytes("1")),
            hardhatNetworkId,
            token.address,
          ]
        )
      )
      expect(await token.DOMAIN_SEPARATOR()).to.equal(expected)
    })
  })

  describe("balanceOf", () => {
    context("when the requested account has no tokens", () => {
      it("should return zero", async () => {
        expect(await token.balanceOf(anotherAccount.address)).to.equal(0)
      })
    })

    context("when the requested account has some tokens", () => {
      it("should return the total amount of tokens", async () => {
        expect(await token.balanceOf(initialHolder.address)).to.equal(
          initialSupply
        )
      })
    })
  })

  describe("transfer", () => {
    context("when the recipient is not the zero address", () => {
      context("when the sender does not have enough balance", () => {
        const amount = initialSupply.add(1)

        it("should revert", async () => {
          await expect(
            token.connect(initialHolder).transfer(recipient.address, amount)
          ).to.be.revertedWith("Transfer amount exceeds balance")
        })
      })

      context("when the sender transfers all balance", () => {
        const amount = initialSupply

        it("should transfer the requested amount", async () => {
          await token.connect(initialHolder).transfer(recipient.address, amount)

          expect(await token.balanceOf(initialHolder.address)).to.equal(0)

          expect(await token.balanceOf(recipient.address)).to.equal(amount)
        })

        it("should emit a transfer event", async () => {
          const tx = await token
            .connect(initialHolder)
            .transfer(recipient.address, amount)

          await expect(tx)
            .to.emit(token, "Transfer")
            .withArgs(initialHolder.address, recipient.address, amount)
        })
      })

      context("when the sender transfers zero tokens", () => {
        const amount = ethers.BigNumber.from(0)

        it("should transfer the requested amount", async () => {
          await token.connect(initialHolder).transfer(recipient.address, amount)

          expect(await token.balanceOf(initialHolder.address)).to.equal(
            initialSupply
          )

          expect(await token.balanceOf(recipient.address)).to.equal(0)
        })

        it("should emit a transfer event", async () => {
          const tx = await token
            .connect(initialHolder)
            .transfer(recipient.address, amount)

          await expect(tx)
            .to.emit(token, "Transfer")
            .withArgs(initialHolder.address, recipient.address, amount)
        })
      })
    })

    context("when the recipient is the zero address", () => {
      it("should revert", async () => {
        await expect(
          token.connect(initialHolder).transfer(ZERO_ADDRESS, initialSupply)
        ).to.be.revertedWith("Transfer to the zero address")
      })
    })
  })

  describe("transferFrom", () => {
    context("when the token owner is not the zero address", () => {
      context("when the recipient is not the zero address", () => {
        context("when the spender has enough approved balance", () => {
          const allowance = initialSupply
          beforeEach(async function () {
            await token
              .connect(initialHolder)
              .approve(anotherAccount.address, allowance)
          })

          context("when the token owner has enough balance", () => {
            const amount = initialSupply

            it("should transfer the requested amount", async () => {
              await token
                .connect(anotherAccount)
                .transferFrom(initialHolder.address, recipient.address, amount)

              expect(await token.balanceOf(initialHolder.address)).to.equal(0)

              expect(await token.balanceOf(recipient.address)).to.equal(amount)
            })

            it("should decrease the spender allowance", async () => {
              await token
                .connect(anotherAccount)
                .transferFrom(initialHolder.address, recipient.address, amount)

              expect(
                await token.allowance(
                  initialHolder.address,
                  anotherAccount.address
                )
              ).to.equal(0)
            })

            it("should emit a transfer event", async () => {
              const tx = await token
                .connect(anotherAccount)
                .transferFrom(initialHolder.address, recipient.address, amount)

              await expect(tx)
                .to.emit(token, "Transfer")
                .withArgs(initialHolder.address, recipient.address, amount)
            })

            it("should emit an approval event", async () => {
              const tx = await token
                .connect(anotherAccount)
                .transferFrom(initialHolder.address, recipient.address, amount)

              await expect(tx)
                .to.emit(token, "Approval")
                .withArgs(
                  initialHolder.address,
                  anotherAccount.address,
                  allowance.sub(amount)
                )
            })
          })

          context("when the token owner does not have enough balance", () => {
            const amount = initialSupply

            beforeEach(async () => {
              await token
                .connect(initialHolder)
                .transfer(anotherAccount.address, 1)
            })

            it("should revert", async () => {
              await expect(
                token
                  .connect(anotherAccount)
                  .transferFrom(
                    initialHolder.address,
                    recipient.address,
                    amount
                  )
              ).to.be.revertedWith("Transfer amount exceeds balance")
            })
          })
        })

        context(
          "when the spender does not have enough approved balance",
          () => {
            const allowance = initialSupply.sub(1)

            beforeEach(async () => {
              await token
                .connect(initialHolder)
                .approve(anotherAccount.address, allowance)
            })

            context("when the token owner has enough balance", () => {
              const amount = initialSupply

              it("should revert", async () => {
                await expect(
                  token
                    .connect(anotherAccount)
                    .transferFrom(
                      initialHolder.address,
                      recipient.address,
                      amount
                    )
                ).to.be.revertedWith("Transfer amount exceeds allowance")
              })
            })

            context("when the token owner does not have enough balance", () => {
              const amount = initialSupply

              beforeEach(async () => {
                await token
                  .connect(initialHolder)
                  .transfer(anotherAccount.address, 1)
              })

              it("should revert", async () => {
                await expect(
                  token
                    .connect(anotherAccount)
                    .transferFrom(
                      initialHolder.address,
                      recipient.address,
                      amount
                    )
                ).to.be.revertedWith("Transfer amount exceeds allowance")
              })
            })

            context("when the token owner is the zero address", () => {
              const allowance = initialSupply

              it("should revert", async () => {
                await expect(
                  token
                    .connect(anotherAccount)
                    .transferFrom(ZERO_ADDRESS, recipient.address, allowance)
                ).to.be.revertedWith("Transfer amount exceeds allowance")
              })
            })
          }
        )
      })

      context("when the recipient is the zero address", () => {
        const allowance = initialSupply

        beforeEach(async () => {
          await token
            .connect(initialHolder)
            .approve(anotherAccount.address, allowance)
        })

        it("should revert", async () => {
          await expect(
            token
              .connect(anotherAccount)
              .transferFrom(initialHolder.address, ZERO_ADDRESS, allowance)
          ).to.be.revertedWith("Transfer to the zero address")
        })
      })
    })
  })

  describe("approve", () => {
    context("when the spender is not the zero address", () => {
      context("when the sender has enough balance", () => {
        const allowance = initialSupply

        it("should emit an approval event", async () => {
          const tx = await token
            .connect(initialHolder)
            .approve(anotherAccount.address, allowance)

          await expect(tx)
            .to.emit(token, "Approval")
            .withArgs(initialHolder.address, anotherAccount.address, allowance)
        })

        context("when there was no approved amount before", () => {
          it("should approve the requested amount", async () => {
            await token
              .connect(initialHolder)
              .approve(anotherAccount.address, allowance)

            expect(
              await token.allowance(
                initialHolder.address,
                anotherAccount.address
              )
            ).to.equal(allowance)
          })
        })

        context("when the spender had an approved amount", () => {
          beforeEach(async () => {
            await token
              .connect(initialHolder)
              .approve(anotherAccount.address, allowance)
          })

          it("should approve the requested amount and replaces the previous one", async () => {
            const newAllowance = to1e18(100)

            await token
              .connect(initialHolder)
              .approve(anotherAccount.address, newAllowance)
            expect(
              await token.allowance(
                initialHolder.address,
                anotherAccount.address
              )
            ).to.equal(newAllowance)
          })
        })
      })

      context("when the sender does not have enough balance", () => {
        const allowance = initialSupply.add(1)

        it("should emit an approval event", async () => {
          const tx = await token
            .connect(initialHolder)
            .approve(anotherAccount.address, allowance)

          await expect(tx)
            .to.emit(token, "Approval")
            .withArgs(initialHolder.address, anotherAccount.address, allowance)
        })

        context("when there was no approved amount before", () => {
          it("should approve the requested amount", async () => {
            await token
              .connect(initialHolder)
              .approve(anotherAccount.address, allowance)

            expect(
              await token.allowance(
                initialHolder.address,
                anotherAccount.address
              )
            ).to.equal(allowance)
          })
        })

        context("when the spender had an approved amount", () => {
          beforeEach(async () => {
            await token
              .connect(initialHolder)
              .approve(anotherAccount.address, to1e18(1))
          })

          it("should approve the requested amount and replaces the previous one", async () => {
            await token
              .connect(initialHolder)
              .approve(anotherAccount.address, allowance)
            expect(
              await token.allowance(
                initialHolder.address,
                anotherAccount.address
              )
            ).to.equal(allowance)
          })
        })
      })
    })

    context("when the spender is the zero address", () => {
      const allowance = initialSupply
      it("should revert", async () => {
        await expect(
          token.connect(initialHolder).approve(ZERO_ADDRESS, allowance)
        ).to.be.revertedWith("Approve to the zero address")
      })
    })
  })

  describe("mint", () => {
    const amount = to1e18(50)
    it("should reject a zero account", async () => {
      await expect(
        token.connect(owner).mint(ZERO_ADDRESS, amount)
      ).to.be.revertedWith("Mint to the zero address")
    })

    context("when called not by the owner", () => {
      it("should revert", async () => {
        await expect(
          token.connect(initialHolder).mint(initialHolder.address, amount)
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("for a non zero account", () => {
      let mintTx
      beforeEach("minting", async () => {
        mintTx = await token.connect(owner).mint(anotherAccount.address, amount)
      })

      it("should incement totalSupply", async () => {
        const expectedSupply = initialSupply.add(amount)
        expect(await token.totalSupply()).to.equal(expectedSupply)
      })

      it("should increment recipient balance", async () => {
        expect(await token.balanceOf(anotherAccount.address)).to.equal(amount)
      })

      it("should emit Transfer event", async () => {
        await expect(mintTx)
          .to.emit(token, "Transfer")
          .withArgs(ZERO_ADDRESS, anotherAccount.address, amount)
      })
    })
  })

  describe("burn", () => {
    it("should reject burning more than balance", async () => {
      await expect(
        token.connect(initialHolder).burn(initialSupply.add(1))
      ).to.be.revertedWith("Burn amount exceeds balance")
    })

    const describeBurn = (description, amount) => {
      describe(description, () => {
        let burnTx
        beforeEach("burning", async () => {
          burnTx = await token.connect(initialHolder).burn(amount)
        })

        it("should decrement totalSupply", async () => {
          const expectedSupply = initialSupply.sub(amount)
          expect(await token.totalSupply()).to.equal(expectedSupply)
        })

        it("should decrement owner's balance", async () => {
          const expectedBalance = initialSupply.sub(amount)
          expect(await token.balanceOf(initialHolder.address)).to.equal(
            expectedBalance
          )
        })

        it("should emit Transfer event", async () => {
          await expect(burnTx)
            .to.emit(token, "Transfer")
            .withArgs(initialHolder.address, ZERO_ADDRESS, amount)
        })
      })
    }

    describeBurn("for entire balance", initialSupply)
    describeBurn("for less amount than balance", initialSupply.sub(1))
  })

  describe("burnFrom", () => {
    it("should reject burning more than balance", async () => {
      await token
        .connect(initialHolder)
        .approve(anotherAccount.address, initialSupply.add(1))
      await expect(
        token
          .connect(anotherAccount)
          .burnFrom(initialHolder.address, initialSupply.add(1))
      ).to.be.revertedWith("Burn amount exceeds balance")
    })

    it("should reject burning more than the allowance", async () => {
      await token
        .connect(initialHolder)
        .approve(anotherAccount.address, initialSupply.sub(1))
      await expect(
        token
          .connect(anotherAccount)
          .burnFrom(initialHolder.address, initialSupply)
      ).to.be.revertedWith("Burn amount exceeds allowance")
    })

    const describeBurnFrom = (description, amount) => {
      describe(description, () => {
        let burnTx
        beforeEach("burning from", async () => {
          await token
            .connect(initialHolder)
            .approve(anotherAccount.address, amount)
          burnTx = await token
            .connect(anotherAccount)
            .burnFrom(initialHolder.address, amount)
        })

        it("should decrement totalSupply", async () => {
          const expectedSupply = initialSupply.sub(amount)
          expect(await token.totalSupply()).to.equal(expectedSupply)
        })

        it("should decrement owner's balance", async () => {
          const expectedBalance = initialSupply.sub(amount)
          expect(await token.balanceOf(initialHolder.address)).to.equal(
            expectedBalance
          )
        })

        it("should decrement allowance", async () => {
          const allowance = await token.allowance(
            initialHolder.address,
            anotherAccount.address
          )

          expect(allowance).to.equal(0)
        })

        it("should emit Transfer event", async () => {
          await expect(burnTx)
            .to.emit(token, "Transfer")
            .withArgs(initialHolder.address, ZERO_ADDRESS, amount)
        })
      })
    }

    describeBurnFrom("for entire balance", initialSupply)
    describeBurnFrom("for less amount than balance", initialSupply.sub(1))
  })

  describe("permit", () => {
    const permittingHolderBalance = to1e18(650000)
    let permittingHolder

    let yesterday
    let tomorrow

    beforeEach(async () => {
      permittingHolder = await ethers.Wallet.createRandom()
      await token.mint(permittingHolder.address, permittingHolderBalance)

      const lastBlockTimestamp = await lastBlockTime()
      yesterday = lastBlockTimestamp - 86400 // -1 day
      tomorrow = lastBlockTimestamp + 86400 // +1 day
    })

    const getApproval = async (amount, spender, deadline) => {
      // We use ethers.utils.SigningKey for a Wallet instead of
      // Signer.signMessage to do not add '\x19Ethereum Signed Message:\n'
      // prefix to the signed message. The '\x19` protection (see EIP191 for
      // more details on '\x19' rationale and format) is already included in
      // EIP2612 permit signed message and '\x19Ethereum Signed Message:\n'
      // should not be used there.
      const signingKey = new ethers.utils.SigningKey(
        permittingHolder.privateKey
      )

      const domainSeparator = await token.DOMAIN_SEPARATOR()
      const permitTypehash = await token.PERMIT_TYPEHASH()
      const nonce = await token.nonces(permittingHolder.address)

      const approvalDigest = ethers.utils.keccak256(
        ethers.utils.solidityPack(
          ["bytes1", "bytes1", "bytes32", "bytes32"],
          [
            "0x19",
            "0x01",
            domainSeparator,
            ethers.utils.keccak256(
              ethers.utils.defaultAbiCoder.encode(
                [
                  "bytes32",
                  "address",
                  "address",
                  "uint256",
                  "uint256",
                  "uint256",
                ],
                [
                  permitTypehash,
                  permittingHolder.address,
                  spender,
                  amount,
                  nonce,
                  deadline,
                ]
              )
            ),
          ]
        )
      )

      return ethers.utils.splitSignature(
        await signingKey.signDigest(approvalDigest)
      )
    }

    context("when permission expired", () => {
      it("should revert", async () => {
        const deadline = yesterday
        const signature = await getApproval(
          permittingHolderBalance,
          anotherAccount.address,
          deadline
        )

        await expect(
          token
            .connect(anotherAccount)
            .permit(
              permittingHolder.address,
              anotherAccount.address,
              permittingHolderBalance,
              deadline,
              signature.v,
              signature.r,
              signature.s
            )
        ).to.be.revertedWith("Permission expired")
      })
    })

    context("when permission has an invalid signature", () => {
      it("should revert", async () => {
        const deadline = tomorrow
        const signature = await getApproval(
          permittingHolderBalance,
          anotherAccount.address,
          deadline
        )

        await expect(
          token.connect(anotherAccount).permit(
            anotherAccount.address, // does not match the signature
            anotherAccount.address,
            permittingHolderBalance,
            deadline,
            signature.v,
            signature.r,
            signature.s
          )
        ).to.be.revertedWith("Invalid signature")
      })
    })

    context("when the spender is not the zero address", () => {
      context("when the sender has enough balance", () => {
        const allowance = permittingHolderBalance
        it("should emit an approval event", async () => {
          const deadline = tomorrow
          const signature = await getApproval(
            allowance,
            anotherAccount.address,
            deadline
          )

          const tx = await token
            .connect(anotherAccount)
            .permit(
              permittingHolder.address,
              anotherAccount.address,
              allowance,
              deadline,
              signature.v,
              signature.r,
              signature.s
            )

          await expect(tx)
            .to.emit(token, "Approval")
            .withArgs(
              permittingHolder.address,
              anotherAccount.address,
              allowance
            )
        })

        context("when there was no approved amount before", () => {
          it("should approve the requested amount", async () => {
            const deadline = tomorrow
            const signature = await getApproval(
              allowance,
              anotherAccount.address,
              deadline
            )

            await token
              .connect(anotherAccount)
              .permit(
                permittingHolder.address,
                anotherAccount.address,
                allowance,
                deadline,
                signature.v,
                signature.r,
                signature.s
              )

            expect(
              await token.allowance(
                permittingHolder.address,
                anotherAccount.address
              )
            ).to.equal(allowance)
          })
        })

        context("when the spender had an approved amount", () => {
          beforeEach(async () => {
            const deadline = tomorrow
            const initialAllowance = allowance.sub(10)
            const signature = await getApproval(
              initialAllowance,
              anotherAccount.address,
              deadline
            )

            await token
              .connect(anotherAccount)
              .permit(
                permittingHolder.address,
                anotherAccount.address,
                initialAllowance,
                deadline,
                signature.v,
                signature.r,
                signature.s
              )
          })

          it("should approve the requested amount and replaces the previous one", async () => {
            const deadline = tomorrow
            const signature = await getApproval(
              allowance,
              anotherAccount.address,
              deadline
            )

            await token
              .connect(anotherAccount)
              .permit(
                permittingHolder.address,
                anotherAccount.address,
                allowance,
                deadline,
                signature.v,
                signature.r,
                signature.s
              )

            expect(
              await token.allowance(
                permittingHolder.address,
                anotherAccount.address
              )
            ).to.equal(allowance)
          })
        })
      })

      context("when the sender does not have enough balance", () => {
        const allowance = permittingHolderBalance.add(1)
        it("should emit an approval event", async () => {
          const deadline = tomorrow
          const signature = await getApproval(
            allowance,
            anotherAccount.address,
            deadline
          )

          const tx = await token
            .connect(anotherAccount)
            .permit(
              permittingHolder.address,
              anotherAccount.address,
              allowance,
              deadline,
              signature.v,
              signature.r,
              signature.s
            )

          await expect(tx)
            .to.emit(token, "Approval")
            .withArgs(
              permittingHolder.address,
              anotherAccount.address,
              allowance
            )
        })

        context("when there was no approved amount before", () => {
          it("should approve the requested amount", async () => {
            const deadline = tomorrow
            const signature = await getApproval(
              allowance,
              anotherAccount.address,
              deadline
            )

            await token
              .connect(anotherAccount)
              .permit(
                permittingHolder.address,
                anotherAccount.address,
                allowance,
                deadline,
                signature.v,
                signature.r,
                signature.s
              )

            expect(
              await token.allowance(
                permittingHolder.address,
                anotherAccount.address
              )
            ).to.equal(allowance)
          })
        })

        context("when the spender had an approved amount", () => {
          beforeEach(async () => {
            const deadline = tomorrow
            const initialAllowance = allowance.sub(10)
            const signature = await getApproval(
              initialAllowance,
              anotherAccount.address,
              deadline
            )

            await token
              .connect(anotherAccount)
              .permit(
                permittingHolder.address,
                anotherAccount.address,
                initialAllowance,
                deadline,
                signature.v,
                signature.r,
                signature.s
              )
          })

          it("should approve the requested amount and replaces the previous one", async () => {
            const deadline = tomorrow
            const signature = await getApproval(
              allowance,
              anotherAccount.address,
              deadline
            )

            await token
              .connect(anotherAccount)
              .permit(
                permittingHolder.address,
                anotherAccount.address,
                allowance,
                deadline,
                signature.v,
                signature.r,
                signature.s
              )

            expect(
              await token.allowance(
                permittingHolder.address,
                anotherAccount.address
              )
            ).to.equal(allowance)
          })
        })
      })
    })

    context("when the spender is the zero address", () => {
      const allowance = permittingHolderBalance
      it("should revert", async () => {
        const deadline = tomorrow
        const signature = await getApproval(allowance, ZERO_ADDRESS, deadline)

        await expect(
          token
            .connect(anotherAccount)
            .permit(
              permittingHolder.address,
              ZERO_ADDRESS,
              allowance,
              deadline,
              signature.v,
              signature.r,
              signature.s
            )
        ).to.be.revertedWith("Approve to the zero address")
      })
    })

    context("when given never expiring permit", () => {
      // uint(-1)
      const allowance = ethers.BigNumber.from(
        "115792089237316195423570985008687907853269984665640564039457584007913129639935"
      )

      beforeEach(async () => {
        const deadline = tomorrow
        const signature = await getApproval(
          allowance,
          anotherAccount.address,
          deadline
        )

        await token
          .connect(anotherAccount)
          .permit(
            permittingHolder.address,
            anotherAccount.address,
            allowance,
            deadline,
            signature.v,
            signature.r,
            signature.s
          )
      })
      it("should not reduce approved amount", async () => {
        expect(
          await token.allowance(
            permittingHolder.address,
            anotherAccount.address
          )
        ).to.equal(allowance)

        await token
          .connect(anotherAccount)
          .transferFrom(
            permittingHolder.address,
            recipient.address,
            to1e18(100)
          )

        expect(
          await token.allowance(
            permittingHolder.address,
            anotherAccount.address
          )
        ).to.equal(allowance)
      })
    })
  })

  describe("approveAndCall", () => {
    const amount = to1e18(3)
    let approvalReceiver

    beforeEach(async () => {
      const ReceiveApprovalStub = await ethers.getContractFactory(
        "ReceiveApprovalStub"
      )
      approvalReceiver = await ReceiveApprovalStub.deploy()
      await approvalReceiver.deployed()
    })

    context("when approval fails", () => {
      it("should revert", async () => {
        await expect(
          token.connect(initialHolder).approveAndCall(ZERO_ADDRESS, amount, [])
        ).to.be.reverted
      })
    })

    context("when receiveApproval fails", () => {
      beforeEach(async () => {
        await approvalReceiver.setShouldRevert(true)
      })

      it("should revert", async () => {
        await expect(
          token
            .connect(initialHolder)
            .approveAndCall(approvalReceiver.address, amount, [])
        ).to.be.revertedWith("i am your father luke")
      })
    })

    it("approves the provided amount for transfer", async () => {
      await token
        .connect(initialHolder)
        .approveAndCall(approvalReceiver.address, amount, [])
      expect(
        await token.allowance(initialHolder.address, approvalReceiver.address)
      ).to.equal(amount)
    })

    it("calls approveAndCall with the provided parameters", async () => {
      const tx = await token
        .connect(initialHolder)
        .approveAndCall(approvalReceiver.address, amount, "0xbeef")
      await expect(tx)
        .to.emit(approvalReceiver, "ApprovalReceived")
        .withArgs(initialHolder.address, amount, token.address, "0xbeef")
    })
  })
})
