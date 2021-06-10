function to1e18(n) {
  const decimalMultiplier = ethers.BigNumber.from(10).pow(18)
  return ethers.BigNumber.from(n).mul(decimalMultiplier)
}

async function lastBlockTime() {
  return (await ethers.provider.getBlock("latest")).timestamp
}

module.exports.to1e18 = to1e18
module.exports.lastBlockTime = lastBlockTime

module.exports.ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
