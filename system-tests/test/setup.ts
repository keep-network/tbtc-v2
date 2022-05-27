import fs from "fs"
import { helpers, network } from "hardhat"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { Credentials as ElectrumCredentials } from "@keep-network/tbtc-v2.ts/dist/electrum"

/**
 * Represents a context of the given system tests scenario.
 */
export interface SystemTestsContext {
  /**
   * Electrum instance connection URL.
   */
  electrumUrl: string
  /**
   * Signer representing the depositor.
   */
  depositor: SignerWithAddress
  /**
   * Bridge address.
   */
  bridgeAddress: string
}

/**
 * Sets up the system tests context.
 * @returns System tests context.
 */
export async function setupSystemTests(): Promise<SystemTestsContext> {
  if (network.name === "hardhat") {
    throw new Error("Built-in Hardhat network is not supported")
  }

  const electrumUrl = process.env.ELECTRUM_URL
  if (!electrumUrl) {
    throw new Error(`ELECTRUM_URL is not set`)
  }

  const deploymentExportFile = getDeploymentExportFile()
  const bridgeAddress = deploymentExportFile.contracts["Bridge"].address

  const { depositor } = await helpers.signers.getNamedSigners()

  console.log(`
    System tests context:
    - Electrum URL: ${electrumUrl}
    - Ethereum network: ${network.name}
    - Bridge address ${bridgeAddress}
    - Depositor address ${depositor.address}
  `)

  return {
    electrumUrl,
    depositor,
    bridgeAddress,
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

export function parseElectrumCredentials(url: string): ElectrumCredentials {
  const urlObj = new URL(url)

  return {
    host: urlObj.hostname,
    port: Number.parseInt(urlObj.port),
    protocol: urlObj.protocol.replace(":", "") as
      | "tcp"
      | "tls"
      | "ssl"
      | "ws"
      | "wss",
  }
}
