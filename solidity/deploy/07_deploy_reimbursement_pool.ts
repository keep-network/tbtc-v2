import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers } = hre
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  const staticGas = 40800 // gas amount consumed by the refund() + tx cost
  const maxGasPrice = ethers.utils.parseUnits("500", "gwei")

  const ReimbursementPool = await deploy("ReimbursementPool", {
    contract:
      deployments.getNetworkName() === "hardhat"
        ? "ReimbursementPool"
        : undefined,
    from: deployer,
    args: [staticGas, maxGasPrice],
    log: true,
  })

  const deployerSigner = await ethers.getSigner(deployer)

  await deployerSigner.sendTransaction({
    to: ReimbursementPool.address,
    value: ethers.utils.parseEther("100.0"), // Send 100.0 ETH
  })

  if (hre.network.tags.tenderly) {
    await hre.tenderly.verify({
      name: "ReimbursementPool",
      address: ReimbursementPool.address,
    })
  }
}

export default func

func.tags = ["ReimbursementPool"]
