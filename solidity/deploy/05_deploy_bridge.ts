import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { ethers, helpers, deployments, getNamedAccounts } = hre
  const { deploy } = deployments
  const { deployer, treasury } = await getNamedAccounts()

  const Bank = await deployments.get("Bank")
  const Relay = await deployments.get("Relay")

  // TODO: Test for mainnet deployment that when `WalletRegistry` is provided
  // in `external/mainnet/` directory it gets resolved correctly, and the deployment
  // script from `@keep-network/ecdsa` is not invoked once again.
  const WalletRegistry = await deployments.get("WalletRegistry")

  // For local tests use `1`.
  const txProofDifficultyFactor =
    deployments.getNetworkName() === "hardhat" ? 1 : 6

  const Deposit = await deploy("Deposit", { from: deployer, log: true })
  const DepositSweep = await deploy("DepositSweep", {
    from: deployer,
    log: true,
  })
  const Redemption = await deploy("Redemption", { from: deployer, log: true })
  const Wallets = await deploy("Wallets", { from: deployer, log: true })
  const Fraud = await deploy("Fraud", { from: deployer, log: true })
  const MovingFunds = await deploy("MovingFunds", {
    from: deployer,
    log: true,
  })

  const bridge = await helpers.upgrades.deployProxy("Bridge", {
    contractName:
      deployments.getNetworkName() === "hardhat" ? "BridgeStub" : undefined,
    initializerArgs: [
      Bank.address,
      Relay.address,
      treasury,
      WalletRegistry.address,
      txProofDifficultyFactor,
    ],
    factoryOpts: {
      signer: await ethers.getSigner(deployer),
      libraries: {
        Deposit: Deposit.address,
        DepositSweep: DepositSweep.address,
        Redemption: Redemption.address,
        Wallets: Wallets.address,
        Fraud: Fraud.address,
        MovingFunds: MovingFunds.address,
      },
    },
    proxyOpts: {
      unsafeAllowLinkedLibraries: true,
    },
  })

  if (hre.network.tags.tenderly) {
    await hre.tenderly.verify({
      name: "Bridge",
      address: bridge.address,
    })
  }
}

export default func

func.tags = ["Bridge"]
func.dependencies = ["Bank", "Relay", "Treasury", "WalletRegistry"]
