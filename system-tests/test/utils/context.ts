import fs from "fs"
import { helpers, network } from "hardhat"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"

/**
 * Represents a context of the given system tests scenario.
 */
export interface SystemTestsContext {
  /**
   * Electrum instance connection URL.
   */
  electrumUrl: string
  /**
   * Bridge address.
   */
  bridgeAddress: string
  /**
   * Bridge ABI.
   */
  bridgeAbi: any
  /**
   * Ethereum signer representing the system maintainer.
   */
  maintainer: SignerWithAddress
  /**
   * Ethereum signer representing the depositor.
   */
  depositor: SignerWithAddress
  /**
   * Bitcoin private key of the depositor.
   */
  depositorBitcoinPrivateKey: string
}

/**
 * Sets up the system tests context.
 * @returns System tests context.
 */
export async function setupSystemTestsContext(): Promise<SystemTestsContext> {
  const electrumUrl = process.env.ELECTRUM_URL
  if (!electrumUrl) {
    throw new Error(`ELECTRUM_URL is not set`)
  }

  if (network.name === "hardhat") {
    throw new Error("Built-in Hardhat network is not supported")
  }

  const deploymentExportFile = getDeploymentExportFile()
  const bridgeAddress = deploymentExportFile.contracts["Bridge"].address
  const bridgeAbi = deploymentExportFile.contracts["Bridge"].abi

  const { maintainer, depositor } = await helpers.signers.getNamedSigners()

  const depositorBitcoinPrivateKey = process.env
    .DEPOSITOR_BITCOIN_PRIVATE_KEY as string
  if (!depositorBitcoinPrivateKey) {
    throw new Error(`DEPOSITOR_BITCOIN_PRIVATE_KEY is not set`)
  }

  console.log(`
    System tests context:
    - Electrum URL: ${electrumUrl}
    - Ethereum network: ${network.name}
    - Bridge address ${bridgeAddress}
    - Maintainer Ethereum address ${maintainer.address}
    - Depositor Ethereum address ${depositor.address}
    - Depositor Bitcoin private key ${depositorBitcoinPrivateKey}
  `)

  return {
    electrumUrl,
    bridgeAddress,
    bridgeAbi,
    maintainer,
    depositor,
    depositorBitcoinPrivateKey,
  }
}

/**
 * Represents a deployment export file. That file must include a `contracts`
 * field that contains necessary information about a contract deployment.
 */
interface DeploymentExportFile {
  contracts: {
    [key: string]: {
      address: string
      abi: any
    }
  }
}

/**
 * Reads the deployment export file. The file path is supposed to be
 * passed as DEPLOYMENT_EXPORT_FILE_PATH env variable. The file should contain
 * a JSON representing the deployment info.
 * @returns Deployment export file.
 */
function getDeploymentExportFile(): DeploymentExportFile {
  const deploymentExportFilePath = process.env.DEPLOYMENT_EXPORT_FILE_PATH
  if (deploymentExportFilePath) {
    const deploymentExportFile = fs.readFileSync(deploymentExportFilePath)
    return JSON.parse(deploymentExportFile)
  }

  throw new Error(`"DEPLOYMENT_EXPORT_FILE_PATH is not set`)
}
