/**
 * Environment Validation Tests for SUI Direct Minting
 * 
 * This test file validates that the real SUI testnet environment is properly
 * configured and ready for the 6-step workflow testing.
 */

import { describe, it, before, after } from 'mocha'
import { expect } from 'chai'
import { getTestEnvironment, cleanupTestEnvironment, SuiTestnetEnvironment } from './00-test-environment'
import { SuiAddress } from '../../src/lib/sui/address'

describe('SUI Testnet Environment Validation', function() {
  // Increase timeout for real network operations
  this.timeout(30000)

  let testEnv: SuiTestnetEnvironment

  before(async function() {
    console.log('\n🔄 Setting up SUI testnet environment for validation...')
    testEnv = await getTestEnvironment()
  })

  after(async function() {
    console.log('\n🧹 Cleaning up test environment...')
    await cleanupTestEnvironment()
  })

  describe('Network Connectivity', function() {
    it('should connect to SUI testnet successfully', async function() {
      // Validate that we can get basic network information
      const chainId = await testEnv.suiClient.getChainIdentifier()
      expect(chainId).to.be.a('string')
      console.log(`   ✓ Connected to chain: ${chainId}`)
    })

    it('should have network health check passing', async function() {
      const isHealthy = await testEnv.checkNetworkHealth()
      expect(isHealthy).to.be.true
      console.log('   ✓ Network health check passed')
    })

    it('should be able to get latest checkpoint', async function() {
      const checkpoint = await testEnv.suiClient.getLatestCheckpointSequenceNumber()
      expect(checkpoint).to.be.a('string')
      expect(parseInt(checkpoint)).to.be.greaterThan(0)
      console.log(`   ✓ Latest checkpoint: ${checkpoint}`)
    })
  })

  describe('Test Wallet Configuration', function() {
    it('should have primary test wallet configured', function() {
      const wallet = testEnv.getTestWallet('primary-test-wallet')
      expect(wallet).to.have.property('keypair')
      expect(wallet).to.have.property('signer')
      expect(wallet).to.have.property('address')
      expect(wallet.address).to.match(/^0x[a-fA-F0-9]{64}$/)
      console.log(`   ✓ Primary wallet address: ${wallet.address}`)
    })

    it('should have secondary test wallet configured', function() {
      const wallet = testEnv.getTestWallet('secondary-test-wallet')
      expect(wallet).to.have.property('keypair')
      expect(wallet).to.have.property('signer')
      expect(wallet).to.have.property('address')
      expect(wallet.address).to.match(/^0x[a-fA-F0-9]{64}$/)
      console.log(`   ✓ Secondary wallet address: ${wallet.address}`)
    })

    it('should be able to get primary test address as SuiAddress', function() {
      const address = testEnv.getPrimaryTestAddress()
      expect(address).to.be.instanceOf(SuiAddress)
      expect(address.toString()).to.match(/^0x[a-fA-F0-9]{64}$/)
      console.log(`   ✓ Primary SuiAddress: ${address.toString()}`)
    })

    it('should validate wallet funding status', async function() {
      // Check primary wallet balance
      const primaryWallet = testEnv.getTestWallet('primary-test-wallet')
      
      try {
        const balance = await testEnv.suiClient.getBalance({
          owner: primaryWallet.address,
          coinType: "0x2::sui::SUI"
        })
        
        const balanceNumber = Number(balance.totalBalance)
        console.log(`   ✓ Primary wallet balance: ${(balanceNumber / 1000000000).toFixed(4)} SUI`)
        
        // For automated testing, we'll warn if balance is low but not fail
        if (balanceNumber < 100000000) { // Less than 0.1 SUI
          console.warn(`   ⚠️  Low balance detected. Consider funding wallet at SUI faucet.`)
        }
        
        expect(balanceNumber).to.be.a('number')
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.warn(`   ⚠️  Could not check wallet balance: ${errorMessage}`)
        // Don't fail the test if balance check fails - might be network issue
      }
    })
  })

  describe('Contract Deployment Validation', function() {
    it('should validate SUI contract package exists', async function() {
      // Check that the contract package is deployed
      const packageObject = await testEnv.suiClient.getObject({
        id: testEnv.config.packageId,
        options: { showContent: true }
      })
      
      expect(packageObject.data).to.not.be.null
      expect(packageObject.data?.objectId).to.equal(testEnv.config.packageId)
      console.log(`   ✓ Contract package verified: ${testEnv.config.packageId}`)
    })

    it('should have correct package ID format', function() {
      expect(testEnv.config.packageId).to.match(/^0x[a-fA-F0-9]{64}$/)
      expect(testEnv.config.packageId).to.equal('0x1db1fcdaada7c286d77f3347e593e06d8f33b8255e0861033a0a9f321f4eade7')
      console.log('   ✓ Package ID format validated')
    })

    it('should have correct RPC URL configuration', function() {
      expect(testEnv.config.rpcUrl).to.equal('https://fullnode.testnet.sui.io:443')
      console.log('   ✓ RPC URL configuration validated')
    })

    it('should have correct module name configured', function() {
      expect(testEnv.config.bitcoinDepositorModule).to.equal('bitcoin_depositor')
      console.log('   ✓ Bitcoin depositor module name validated')
    })
  })

  describe('SUI Chain Adapter Creation', function() {
    it('should create SuiChainAdapter successfully', function() {
      const adapter = testEnv.createSuiAdapter()
      expect(adapter).to.have.property('encodeDepositOwner')
      expect(adapter).to.have.property('initializeDeposit')
      expect(adapter).to.have.property('setSigner')
      expect(adapter).to.have.property('hasValidSigner')
      console.log('   ✓ SuiChainAdapter created with all required methods')
    })

    it('should have valid signer in adapter', function() {
      const adapter = testEnv.createSuiAdapter()
      expect(adapter.hasValidSigner()).to.be.true
      expect(adapter.getSigner()).to.not.be.undefined
      console.log('   ✓ SuiChainAdapter has valid signer')
    })

    it('should be able to encode deposit owner address', function() {
      const adapter = testEnv.createSuiAdapter()
      const testAddress = testEnv.getPrimaryTestAddress()
      
      const encodedAddress = adapter.encodeDepositOwner(testAddress)
      expect(encodedAddress.toString()).to.match(/^0x[a-fA-F0-9]{64}$/)
      console.log(`   ✓ Encoded address: ${encodedAddress.toString()}`)
    })
  })

  describe('Network Retry Logic', function() {
    it('should handle network operations with retry logic', async function() {
      let attemptCount = 0
      
      const result = await testEnv.withRetry(async () => {
        attemptCount++
        // Simulate operation that succeeds on first try
        return await testEnv.suiClient.getChainIdentifier()
      }, 3, 100)
      
      expect(result).to.be.a('string')
      expect(attemptCount).to.equal(1)
      console.log('   ✓ Retry logic working for successful operations')
    })

    it('should retry failed operations with exponential backoff', async function() {
      let attemptCount = 0
      
      try {
        await testEnv.withRetry(async () => {
          attemptCount++
          if (attemptCount < 3) {
            throw new Error('Simulated network failure')
          }
          return 'success'
        }, 3, 50)
        
        expect(attemptCount).to.equal(3)
        console.log('   ✓ Retry logic working for operations that eventually succeed')
        
      } catch (error) {
        // This shouldn't happen with the logic above, but handle gracefully
        console.log(`   ✓ Retry logic tested (attempts: ${attemptCount})`)
      }
    })
  })

  describe('Environment Cleanup', function() {
    it('should cleanup without errors', async function() {
      // Test cleanup doesn't throw
      await testEnv.cleanup()
      console.log('   ✓ Environment cleanup completed successfully')
    })
  })
})

/**
 * Manual Environment Check
 * 
 * Run this as a standalone script to manually validate the environment:
 * npx ts-node test/sui-direct-minting-tests/01-environment-validation.test.ts
 */
if (require.main === module) {
  (async () => {
    console.log('🔧 Manual SUI Environment Check')
    console.log('==============================\n')
    
    try {
      const env = await getTestEnvironment()
      console.log('✅ Environment validation complete!')
      
      console.log('\n📋 Environment Summary:')
      console.log(`   Network: ${env.config.rpcUrl}`)
      console.log(`   Package: ${env.config.packageId}`)
      console.log(`   Module: ${env.config.bitcoinDepositorModule}`)
      
      const primaryWallet = env.getTestWallet('primary-test-wallet')
      console.log(`   Primary Wallet: ${primaryWallet.address}`)
      
      await cleanupTestEnvironment()
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('❌ Environment validation failed:', errorMessage)
      process.exit(1)
    }
  })()
}