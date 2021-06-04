function to1e18(n) {
  const decimalMultiplier = ethers.BigNumber.from(10).pow(18)
  return ethers.BigNumber.from(n).mul(decimalMultiplier)
}

module.exports.to1e18 = to1e18
module.exports.ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
