#!/usr/bin/env npx ts-node
/**
 * Simple environment validation script for SUI Direct Minting tests
 * This is a standalone validation without Mocha dependencies
 */

import { getTestEnvironment, cleanupTestEnvironment } from './00-test-environment'

async function validateEnvironment(): Promise<void> {
  console.log('🔧 SUI Testnet Environment Validation')
  console.log('=====================================\n')
  
  try {
    console.log('🚀 Initializing test environment...')
    const env = await getTestEnvironment()
    
    // Test 1: Network Connectivity
    console.log('\n📡 Testing network connectivity...')
    const chainId = await env.suiClient.getChainIdentifier()
    const checkpoint = await env.suiClient.getLatestCheckpointSequenceNumber()
    console.log(`   ✓ Connected to chain: ${chainId}`)
    console.log(`   ✓ Latest checkpoint: ${checkpoint}`)
    
    // Test 2: Wallet Configuration
    console.log('\n🔑 Testing wallet configuration...')
    const primaryWallet = env.getTestWallet('primary-test-wallet')
    console.log(`   ✓ Primary wallet: ${primaryWallet.address}`)
    
    const secondaryWallet = env.getTestWallet('secondary-test-wallet')
    console.log(`   ✓ Secondary wallet: ${secondaryWallet.address}`)
    
    // Test 3: Wallet Funding Check
    console.log('\n💰 Checking wallet funding...')
    try {
      const balance = await env.suiClient.getBalance({
        owner: primaryWallet.address,
        coinType: "0x2::sui::SUI"
      })
      
      const balanceNumber = Number(balance.totalBalance)
      const suiAmount = (balanceNumber / 1000000000).toFixed(4)
      console.log(`   ✓ Primary wallet balance: ${suiAmount} SUI`)
      
      if (balanceNumber < 100000000) { // Less than 0.1 SUI
        console.log(`   ⚠️  Low balance detected. Fund wallet at: https://suifaucet.com`)
        console.log(`   ⚠️  Wallet address: ${primaryWallet.address}`)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.log(`   ⚠️  Could not check balance: ${errorMessage}`)
    }
    
    // Test 4: Contract Validation
    console.log('\n📋 Validating contract deployment...')
    const packageObject = await env.suiClient.getObject({
      id: env.config.packageId,
      options: { showContent: true }
    })
    
    if (packageObject.data) {
      console.log(`   ✓ Contract package found: ${env.config.packageId}`)
    } else {
      throw new Error(`Package not found: ${env.config.packageId}`)
    }
    
    // Test 5: SUI Chain Adapter
    console.log('\n🔧 Testing SUI chain adapter...')
    const adapter = env.createSuiAdapter()
    console.log(`   ✓ SuiChainAdapter created successfully`)
    console.log(`   ✓ Has valid signer: ${adapter.hasValidSigner()}`)
    
    const testAddress = env.getPrimaryTestAddress()
    const encodedAddress = adapter.encodeDepositOwner(testAddress)
    console.log(`   ✓ Address encoding works: ${encodedAddress.toString()}`)
    
    // Test 6: Network Health
    console.log('\n🩺 Network health check...')
    const isHealthy = await env.checkNetworkHealth()
    console.log(`   ✓ Network health: ${isHealthy ? 'GOOD' : 'POOR'}`)
    
    console.log('\n✅ All validation checks completed!')
    console.log('\n📋 Environment Summary:')
    console.log(`   Network: ${env.config.rpcUrl}`)
    console.log(`   Package: ${env.config.packageId}`)
    console.log(`   Module: ${env.config.bitcoinDepositorModule}`)
    console.log(`   Primary Wallet: ${primaryWallet.address}`)
    
    await cleanupTestEnvironment()
    console.log('\n🎉 SUI testnet environment is ready for testing!')
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('\n❌ Environment validation failed:', errorMessage)
    
    if (error instanceof Error && error.stack) {
      console.error('\nStack trace:')
      console.error(error.stack)
    }
    
    process.exit(1)
  }
}

// Run validation if this script is executed directly
if (require.main === module) {
  validateEnvironment()
}

export { validateEnvironment }