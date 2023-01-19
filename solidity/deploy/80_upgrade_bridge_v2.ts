import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { ethers, helpers, deployments, getNamedAccounts } = hre
  const { get } = deployments
  const { deployer, treasury } = await getNamedAccounts()

  const Bank = await deployments.get("Bank")
  const LightRelay = await deployments.get("LightRelay")
  const WalletRegistry = await deployments.get("WalletRegistry")
  const ReimbursementPool = await deployments.get("ReimbursementPool")

  const txProofDifficultyFactor = 6

  // WARNING: This script expects no changes in the external libraries and uses
  // `get` function to load the ones that were already published before.
  // If there are any changes in the external libraries make sure to deploy fresh
  // versions of the libraries and link them to the implementation.
  const Deposit = await get("Deposit")
  const DepositSweep = await get("DepositSweep")
  const Redemption = await get("Redemption")
  const Wallets = await get("Wallets")
  const Fraud = await get("Fraud")
  const MovingFunds = await get("MovingFunds")

  const [bridge, proxyDeployment] = await helpers.upgrades.upgradeProxy(
    "Bridge",
    "Bridge",
    {
      contractName: "Bridge",
      initializerArgs: [
        Bank.address,
        LightRelay.address,
        treasury,
        WalletRegistry.address,
        ReimbursementPool.address,
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
        kind: "transparent",
        // Allow external libraries linking. We need to ensure manually that the
        // external  libraries we link are upgrade safe, as the OpenZeppelin plugin
        // doesn't perform such a validation yet.
        // See: https://docs.openzeppelin.com/upgrades-plugins/1.x/faq#why-cant-i-use-external-libraries
        unsafeAllow: ["external-library-linking"],
      },
    }
  )

  if (hre.network.tags.etherscan) {
    // We use `verify` instead of `verify:verify` as the `verify` task is defined
    // in "@openzeppelin/hardhat-upgrades" to perform Etherscan verification
    // of Proxy and Implementation contracts.
    await hre.run("verify", {
      address: proxyDeployment.address,
      constructorArgsParams: proxyDeployment.args,
    })
  }

  if (hre.network.tags.tenderly) {
    await hre.tenderly.verify({
      name: "Bridge",
      address: bridge.address,
    })
  }
}

export default func

func.tags = ["UpgradeBridge"]
// When running an upgrade uncomment the skip below and run the command:
// yarn deploy --tags UpgradeBridge --network <NETWORK>
func.skip = async () => true
