function to1ePrecision(n, precision) {
  const decimalMultiplier = ethers.BigNumber.from(10).pow(precision)
  return ethers.BigNumber.from(n).mul(decimalMultiplier)
}

function to1e18(n) {
  const decimalMultiplier = ethers.BigNumber.from(10).pow(18)
  return ethers.BigNumber.from(n).mul(decimalMultiplier)
}

async function lastBlockTime() {
  return (await ethers.provider.getBlock("latest")).timestamp
}

async function increaseTime(time) {
  const now = await lastBlockTime()
  await ethers.provider.send("evm_setNextBlockTimestamp", [now + time])
  await ethers.provider.send("evm_mine")
}

async function impersonateAccount(accountAddress, purseSigner) {
  // Make the required call against Hardhat Runtime Environment.
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [accountAddress],
  })

  if (purseSigner) {
    // Fund the account using a purse account in order to make transactions.
    // In case the account represents a contract, keep in mind the contract must
    // have a receive or fallback method to be funded successfully.
    await purseSigner.sendTransaction({
      to: accountAddress,
      value: ethers.utils.parseEther("1"),
    })
  }

  // Return the account's signer.
  return await ethers.getSigner(accountAddress)
}

// This function is meant to be used along with the Hardhat forking feature
// (https://hardhat.org/guides/mainnet-forking.html). It resets the fork state
// to the given origin block. It is especially useful in system tests
// environment which leverage mainnet forking feature. For example, it
// can be used to set the environment to the same deterministic state, before
// each test case.
async function resetFork(blockNumber) {
  await hre.network.provider.request({
    method: "hardhat_reset",
    params: [
      {
        forking: {
          jsonRpcUrl: process.env.FORKING_URL,
          blockNumber: blockNumber,
        },
      },
    ],
  })
}

module.exports.to1ePrecision = to1ePrecision
module.exports.to1e18 = to1e18
module.exports.lastBlockTime = lastBlockTime
module.exports.increaseTime = increaseTime
module.exports.impersonateAccount = impersonateAccount
module.exports.resetFork = resetFork
