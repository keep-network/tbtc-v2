/**
 * Real SUI Testnet Environment Setup for TD-2 Testing
 * 
 * This file sets up the real SUI testnet environment with funded test wallets
 * for comprehensive testing of the 6-step SUI direct minting workflow.
 * 
 * This implementation follows the "Real Network Integration Testing" approach
 * selected in TD-2 creative analysis, prioritizing production confidence.
 */

import { SuiClient } from "@mysten/sui/client"
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519"
import type { Signer } from "@mysten/sui/cryptography"
import { SuiChainAdapter, SuiNetworkConfig } from "../../src/lib/sui/sui-chain-adapter"
import { SuiAddress } from "../../src/lib/sui/address"

/**
 * Real SUI testnet configuration pointing to actual deployed contracts.
 * Package ID from TD-1 validation: 0x1db1fcdaada7c286d77f3347e593e06d8f33b8255e0861033a0a9f321f4eade7
 */
export const SUI_TESTNET_CONFIG: SuiNetworkConfig = {
  rpcUrl: "https://fullnode.testnet.sui.io:443",
  packageId: "0x1db1fcdaada7c286d77f3347e593e06d8f33b8255e0861033a0a9f321f4eade7",
  bitcoinDepositorModule: "bitcoin_depositor"
}

/**
 * Test wallet configuration for consistent testing.
 * These are test-only credentials and should never be used for real assets.
 */
export interface TestWalletConfig {
  name: string
  mnemonic: string  // Test mnemonics - never use for real funds
  expectedAddress: string
  minimumSuiBalance: number  // Minimum SUI needed for testing (in MIST)
}

/**
 * Pre-configured test wallets for consistent testing.
 * These will need to be funded through SUI testnet faucet.
 */
export const TEST_WALLETS: TestWalletConfig[] = [
  {
    name: "primary-test-wallet",
    mnemonic: "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about", // Standard test mnemonic
    expectedAddress: "0x...", // Will be populated after wallet creation
    minimumSuiBalance: 1000000000 // 1 SUI in MIST for gas fees
  },
  {
    name: "secondary-test-wallet", 
    mnemonic: "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon", // Alternative test mnemonic
    expectedAddress: "0x...", // Will be populated after wallet creation
    minimumSuiBalance: 500000000 // 0.5 SUI in MIST for backup testing
  }
]

/**
 * Real network test environment manager.
 * Handles wallet funding, connection validation, and cleanup.
 */
export class SuiTestnetEnvironment {
  public readonly suiClient: SuiClient
  public readonly config: SuiNetworkConfig
  private testWallets: Map<string, { keypair: Ed25519Keypair; signer: Signer; address: string }> = new Map()

  constructor() {
    this.suiClient = new SuiClient({ url: SUI_TESTNET_CONFIG.rpcUrl })
    this.config = SUI_TESTNET_CONFIG
  }

  /**
   * Initialize the test environment with wallet creation and funding validation.
   * This must be called before running any tests.
   */
  async initialize(): Promise<void> {
    console.log("🚀 Initializing SUI testnet environment...")
    
    // Validate network connectivity
    await this.validateNetworkConnection()
    
    // Create test wallets
    await this.createTestWallets()
    
    // Validate wallet funding
    await this.validateWalletFunding()
    
    // Validate contract deployment
    await this.validateContractDeployment()
    
    console.log("✅ SUI testnet environment ready for testing")
  }

  /**
   * Validates that we can connect to SUI testnet.
   */
  private async validateNetworkConnection(): Promise<void> {
    try {
      const chainId = await this.suiClient.getChainIdentifier()
      const latestCheckpoint = await this.suiClient.getLatestCheckpointSequenceNumber()
      
      console.log(`📡 Connected to SUI testnet (Chain: ${chainId}, Checkpoint: ${latestCheckpoint})`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to connect to SUI testnet: ${errorMessage}`)
    }
  }

  /**
   * Creates test wallets from configured mnemonics.
   */
  private async createTestWallets(): Promise<void> {
    console.log("🔑 Creating test wallets...")
    
    for (const walletConfig of TEST_WALLETS) {
      try {
        // Create keypair from mnemonic
        const keypair = Ed25519Keypair.deriveKeypair(walletConfig.mnemonic)
        const address = keypair.getPublicKey().toSuiAddress()
        
        // Store wallet info
        this.testWallets.set(walletConfig.name, {
          keypair,
          signer: keypair as Signer,
          address
        })
        
        console.log(`   ✓ ${walletConfig.name}: ${address}`)
        
        // Update expected address if not set
        if (walletConfig.expectedAddress === "0x...") {
          walletConfig.expectedAddress = address
        }
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        throw new Error(`Failed to create wallet ${walletConfig.name}: ${errorMessage}`)
      }
    }
  }

  /**
   * Validates that test wallets have sufficient SUI for testing.
   * Provides instructions for manual funding if needed.
   */
  private async validateWalletFunding(): Promise<void> {
    console.log("💰 Validating wallet funding...")
    
    const underfundedWallets: string[] = []
    
    for (const [name, wallet] of this.testWallets) {
      try {
        const balance = await this.suiClient.getBalance({
          owner: wallet.address,
          coinType: "0x2::sui::SUI"
        })
        
        const currentBalance = BigInt(balance.totalBalance)
        const requiredBalance = BigInt(TEST_WALLETS.find(w => w.name === name)?.minimumSuiBalance || 0)
        
        if (currentBalance >= requiredBalance) {
          console.log(`   ✓ ${name}: ${this.formatSuiBalance(currentBalance)} SUI (sufficient)`)
        } else {
          console.log(`   ⚠️  ${name}: ${this.formatSuiBalance(currentBalance)} SUI (need ${this.formatSuiBalance(requiredBalance)})`)
          underfundedWallets.push(`${name} (${wallet.address})`)
        }
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.log(`   ❌ ${name}: Failed to check balance - ${errorMessage}`)
        underfundedWallets.push(`${name} (${wallet.address})`)
      }
    }
    
    if (underfundedWallets.length > 0) {
      const faucetInstructions = `
⚠️  Some test wallets need funding. Please use the SUI testnet faucet:

🚰 SUI Testnet Faucet: https://suifaucet.com

Addresses to fund:
${underfundedWallets.map(wallet => `   • ${wallet}`).join('\n')}

After funding, run the tests again.
      `
      console.warn(faucetInstructions)
      
      // For automated environments, we might want to continue with warnings
      // but for manual testing, this is sufficient notification
    }
  }

  /**
   * Validates that the SUI contract is deployed and accessible.
   */
  private async validateContractDeployment(): Promise<void> {
    console.log("📋 Validating contract deployment...")
    
    try {
      // Check if the package exists
      const packageObject = await this.suiClient.getObject({
        id: this.config.packageId,
        options: { showContent: true }
      })
      
      if (packageObject.data) {
        console.log(`   ✓ Contract package found: ${this.config.packageId}`)
        
        // Additional validation could check for specific modules/functions
        // but basic existence check is sufficient for environment setup
      } else {
        throw new Error(`Package not found: ${this.config.packageId}`)
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to validate contract deployment: ${errorMessage}`)
    }
  }

  /**
   * Gets a test wallet by name for use in tests.
   */
  getTestWallet(name: string): { keypair: Ed25519Keypair; signer: Signer; address: string } {
    const wallet = this.testWallets.get(name)
    if (!wallet) {
      throw new Error(`Test wallet '${name}' not found. Available wallets: ${Array.from(this.testWallets.keys()).join(', ')}`)
    }
    return wallet
  }

  /**
   * Creates a SuiChainAdapter configured for the test environment.
   */
  createSuiAdapter(walletName: string = "primary-test-wallet"): SuiChainAdapter {
    const wallet = this.getTestWallet(walletName)
    return new SuiChainAdapter(this.suiClient, this.config, wallet.signer)
  }

  /**
   * Gets the primary test wallet address as a SuiAddress.
   */
  getPrimaryTestAddress(): SuiAddress {
    const wallet = this.getTestWallet("primary-test-wallet")
    return SuiAddress.from(wallet.address)
  }

  /**
   * Cleanup method for test teardown (if needed).
   */
  async cleanup(): Promise<void> {
    // For real network testing, cleanup is minimal
    // We don't need to reset network state, just clear local state
    this.testWallets.clear()
    console.log("🧹 Test environment cleaned up")
  }

  /**
   * Formats SUI balance from MIST to human-readable format.
   */
  private formatSuiBalance(mistBalance: bigint): string {
    const suiAmount = Number(mistBalance) / 1000000000 // Convert MIST to SUI
    return suiAmount.toFixed(4)
  }

  /**
   * Network health check for continuous testing.
   */
  async checkNetworkHealth(): Promise<boolean> {
    try {
      await this.validateNetworkConnection()
      return true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.warn(`Network health check failed: ${errorMessage}`)
      return false
    }
  }

  /**
   * Retry wrapper for network operations with exponential backoff.
   */
  async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error as Error
        
        if (attempt === maxRetries) {
          throw lastError
        }
        
        const delay = baseDelay * Math.pow(2, attempt - 1)
        console.log(`   Attempt ${attempt} failed, retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
    
    throw lastError!
  }
}

/**
 * Global test environment instance.
 * This is initialized once per test run and reused across tests.
 */
let globalTestEnvironment: SuiTestnetEnvironment | null = null

/**
 * Gets or creates the global test environment.
 * Call this at the beginning of test suites.
 */
export async function getTestEnvironment(): Promise<SuiTestnetEnvironment> {
  if (!globalTestEnvironment) {
    globalTestEnvironment = new SuiTestnetEnvironment()
    await globalTestEnvironment.initialize()
  }
  return globalTestEnvironment
}

/**
 * Cleanup function for test teardown.
 * Call this after all tests complete.
 */
export async function cleanupTestEnvironment(): Promise<void> {
  if (globalTestEnvironment) {
    await globalTestEnvironment.cleanup()
    globalTestEnvironment = null
  }
}