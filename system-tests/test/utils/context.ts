import fs from "fs"
import { helpers, network } from "hardhat"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { KeyPair as BitcoinKeyPair, keyPairFromPrivateWif } from "./bitcoin"

/**
 * Represents a context of the given system tests scenario.
 */
export interface SystemTestsContext {
  /**
   * Electrum instance connection URL.
   */
  electrumUrl: string
  /**
   * Handle to the contracts' deployment info.
   */
  contractsDeploymentInfo: ContractsDeploymentInfo
  /**
   * Ethereum signer representing the contract governance.
   */
  governance: SignerWithAddress
  /**
   * Ethereum signer representing the system maintainer.
   */
  maintainer: SignerWithAddress
  /**
   * Ethereum signer representing the depositor.
   */
  depositor: SignerWithAddress
  /**
   * Bitcoin key pair of the depositor.
   */
  depositorBitcoinKeyPair: BitcoinKeyPair
  /**
   * Bitcoin key pair of the wallet.
   */
  walletBitcoinKeyPair: BitcoinKeyPair
}

/**
 * Contracts deployment info that contains deployed contracts' addresses and ABIs.
 */
interface ContractsDeploymentInfo {
  contracts: {
    [key: string]: {
      address: string
      abi: any
    }
  }
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

  const contractsDeploymentInfo = readContractsDeploymentExportFile()

  const { governance, maintainer, depositor } =
    await helpers.signers.getNamedSigners()

  const depositorBitcoinPrivateKeyWif = process.env
    .DEPOSITOR_BITCOIN_PRIVATE_KEY_WIF as string
  if (!depositorBitcoinPrivateKeyWif) {
    throw new Error(`DEPOSITOR_BITCOIN_PRIVATE_KEY_WIF is not set`)
  }

  const walletBitcoinPrivateKeyWif = process.env
    .WALLET_BITCOIN_PRIVATE_KEY_WIF as string
  if (!walletBitcoinPrivateKeyWif) {
    throw new Error(`WALLET_BITCOIN_PRIVATE_KEY_WIF is not set`)
  }

  console.log(`
    System tests context:
    - Electrum URL: ${electrumUrl}
    - Ethereum network: ${network.name}
    - Bridge address ${contractsDeploymentInfo.contracts["Bridge"].address}
    - Governance Ethereum address ${governance.address}
    - Maintainer Ethereum address ${maintainer.address}
    - Depositor Ethereum address ${depositor.address}
    - Depositor Bitcoin private key WIF ${depositorBitcoinPrivateKeyWif}
    - Wallet Bitcoin private key WIF ${walletBitcoinPrivateKeyWif}
  `)

  return {
    electrumUrl,
    contractsDeploymentInfo,
    governance,
    maintainer,
    depositor,
    depositorBitcoinKeyPair: keyPairFromPrivateWif(
      depositorBitcoinPrivateKeyWif
    ),
    walletBitcoinKeyPair: keyPairFromPrivateWif(walletBitcoinPrivateKeyWif),
  }
}

/**
 * Reads the contract deployment export file. The file path is supposed to be
 * passed as CONTRACTS_DEPLOYMENT_EXPORT_FILE_PATH env variable. The file should
 * contain a JSON representing the deployment info.
 * @returns Deployment export file.
 */
function readContractsDeploymentExportFile(): ContractsDeploymentInfo {
  const contractsDeploymentExportFilePath =
    process.env.CONTRACTS_DEPLOYMENT_EXPORT_FILE_PATH
  if (contractsDeploymentExportFilePath) {
    const contractsDeploymentExportFile = fs.readFileSync(
      contractsDeploymentExportFilePath
    )
    return JSON.parse(contractsDeploymentExportFile)
  }

  throw new Error(`"CONTRACTS_DEPLOYMENT_EXPORT_FILE_PATH is not set`)
}
