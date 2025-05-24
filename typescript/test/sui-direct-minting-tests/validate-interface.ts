#!/usr/bin/env npx ts-node
/**
 * Interface Validation Script for Real Network SUI Operations
 * 
 * This script validates that our TypeScript interface definitions work
 * correctly with the simplified SDK from TD-1 and live SUI contracts.
 */

import { getTestEnvironment, cleanupTestEnvironment } from './00-test-environment'
import { SuiChainAdapter } from '../../src/lib/sui/sui-chain-adapter'
import { SuiAddress } from '../../src/lib/sui/address'

async function validateInterface(): Promise<void> {
  console.log('🔧 SUI Interface Validation')
  console.log('============================\n')
  
  try {
    console.log('🚀 Initializing test environment...')
    const testEnv = await getTestEnvironment()
    
    console.log('\n📋 1. Interface Type Compatibility')
    console.log('================================')
    
    // Test 1: SuiChainAdapter method validation
    console.log('Testing SuiChainAdapter methods...')
    const suiAdapter = testEnv.createSuiAdapter()
    
    const requiredMethods = [
      'encodeDepositOwner',
      'initializeDeposit', 
      'setSigner',
      'getSigner',
      'hasValidSigner'
    ]
    
    for (const method of requiredMethods) {
      if (typeof (suiAdapter as any)[method] !== 'function') {
        throw new Error(`Missing required method: ${method}`)
      }
    }
    console.log('   ✓ All required SuiChainAdapter methods exist')
    
    // Test 2: SuiAddress type compatibility
    console.log('Testing SuiAddress type compatibility...')
    const testAddress = testEnv.getPrimaryTestAddress()
    
    if (!(testAddress instanceof SuiAddress)) {
      throw new Error('testAddress is not an instance of SuiAddress')
    }
    
    if (typeof testAddress.toString !== 'function') {
      throw new Error('SuiAddress missing toString method')
    }
    
    if (typeof testAddress.toHex !== 'function') {
      throw new Error('SuiAddress missing toHex method')
    }
    
    const addressString = testAddress.toString()
    if (!/^0x[a-fA-F0-9]{64}$/.test(addressString)) {
      throw new Error(`Invalid SUI address format: ${addressString}`)
    }
    
    console.log(`   ✓ SuiAddress compatibility validated: ${addressString}`)
    
    // Test 3: Network configuration interface
    console.log('Testing network configuration interface...')
    const config = testEnv.config
    
    const requiredConfigProps = ['rpcUrl', 'packageId', 'bitcoinDepositorModule']
    for (const prop of requiredConfigProps) {
      if (!(prop in config)) {
        throw new Error(`Missing required config property: ${prop}`)
      }
      if (typeof (config as any)[prop] !== 'string') {
        throw new Error(`Config property ${prop} is not a string`)
      }
    }
    
    if (!config.rpcUrl.match(/^https?:\/\/.+/)) {
      throw new Error(`Invalid RPC URL format: ${config.rpcUrl}`)
    }
    
    if (!config.packageId.match(/^0x[a-fA-F0-9]{64}$/)) {
      throw new Error(`Invalid package ID format: ${config.packageId}`)
    }
    
    console.log('   ✓ Network configuration interface validated')
    
    console.log('\n📋 2. Live Contract Interface Validation')
    console.log('=====================================')
    
    // Test 4: Contract deployment validation
    console.log('Testing contract deployment...')
    const startTime = Date.now()
    
    const packageObject = await testEnv.suiClient.getObject({
      id: testEnv.config.packageId,
      options: { showContent: true, showType: true }
    })
    
    const duration = Date.now() - startTime
    
    if (!packageObject.data) {
      throw new Error(`Contract package not found: ${testEnv.config.packageId}`)
    }
    
    if (packageObject.data.objectId !== testEnv.config.packageId) {
      throw new Error(`Package ID mismatch: expected ${testEnv.config.packageId}, got ${packageObject.data.objectId}`)
    }
    
    if (duration > 10000) {
      console.warn(`   ⚠️  Contract validation took ${duration}ms (>10s)`)
    }
    
    console.log(`   ✓ Contract package validated in ${duration}ms`)
    
    // Test 5: SuiChainAdapter with live contracts
    console.log('Testing SuiChainAdapter with live contracts...')
    
    const encodeStartTime = Date.now()
    const encodedAddress = suiAdapter.encodeDepositOwner(testAddress)
    const encodeDuration = Date.now() - encodeStartTime
    
    if (!encodedAddress) {
      throw new Error('Address encoding returned falsy value')
    }
    
    const encodedString = encodedAddress.toString()
    if (!/^[a-fA-F0-9]{64}$/.test(encodedString)) {
      throw new Error(`Invalid encoded address format: ${encodedString}`)
    }
    
    if (encodeDuration > 1000) {
      console.warn(`   ⚠️  Address encoding took ${encodeDuration}ms (>1s)`)
    }
    
    console.log(`   ✓ Address encoding validated: ${encodedString}`)
    
    // Test 6: Signer management interface
    console.log('Testing signer management interface...')
    
    if (!suiAdapter.hasValidSigner()) {
      throw new Error('SuiChainAdapter reports no valid signer')
    }
    
    const signer = suiAdapter.getSigner()
    if (!signer) {
      throw new Error('getSigner() returned null/undefined')
    }
    
    // Test signer replacement
    const originalSigner = signer
    const newWallet = testEnv.getTestWallet('secondary-test-wallet')
    
    suiAdapter.setSigner(newWallet.signer)
    if (!suiAdapter.hasValidSigner()) {
      throw new Error('hasValidSigner() returned false after setSigner()')
    }
    
    if (suiAdapter.getSigner() !== newWallet.signer) {
      throw new Error('getSigner() did not return the new signer')
    }
    
    // Restore original signer
    suiAdapter.setSigner(originalSigner)
    if (suiAdapter.getSigner() !== originalSigner) {
      throw new Error('Failed to restore original signer')
    }
    
    console.log('   ✓ Signer management interface validated')
    
    console.log('\n📋 3. Type Safety Validation')
    console.log('============================')
    
    // Test 7: Hex type compatibility
    console.log('Testing Hex type compatibility...')
    
    if (typeof encodedAddress.toString !== 'function') {
      throw new Error('Hex type missing toString method')
    }
    
    if (typeof encodedAddress.toBuffer !== 'function') {
      throw new Error('Hex type missing toBuffer method')
    }
    
    const addressString2 = encodedAddress.toString()
    if (typeof addressString2 !== 'string') {
      throw new Error('Hex.toString() did not return string')
    }
    
    console.log('   ✓ Hex type compatibility validated')
    
    // Test 8: Error handling types
    console.log('Testing error handling types...')
    
    try {
      await testEnv.suiClient.getObject({
        id: '0x0000000000000000000000000000000000000000000000000000000000000000',
        options: { showContent: true }
      })
    } catch (error) {
      if (!(error instanceof Error)) {
        throw new Error('Error is not an instance of Error')
      }
      
      if (typeof error.message !== 'string') {
        throw new Error('Error.message is not a string')
      }
      
      console.log('   ✓ Error handling types validated')
    }
    
    console.log('\n📋 4. Performance Interface Validation')
    console.log('====================================')
    
    // Test 9: Network operation performance
    console.log('Testing network operation performance...')
    
    const connectionStartTime = Date.now()
    await testEnv.suiClient.getChainIdentifier()
    const connectionDuration = Date.now() - connectionStartTime
    
    if (connectionDuration > 15000) {
      console.warn(`   ⚠️  Network connection took ${connectionDuration}ms (>15s)`)
    } else {
      console.log(`   ✓ Network connection performance: ${connectionDuration}ms`)
    }
    
    const primaryWallet = testEnv.getTestWallet('primary-test-wallet')
    const balanceStartTime = Date.now()
    await testEnv.suiClient.getBalance({
      owner: primaryWallet.address,
      coinType: "0x2::sui::SUI"
    })
    const balanceDuration = Date.now() - balanceStartTime
    
    if (balanceDuration > 10000) {
      console.warn(`   ⚠️  Balance query took ${balanceDuration}ms (>10s)`)
    } else {
      console.log(`   ✓ Balance query performance: ${balanceDuration}ms`)
    }
    
    console.log('\n📋 5. Real Network Data Format Validation')
    console.log('======================================')
    
    // Test 10: Network response format validation
    console.log('Testing network response formats...')
    
    const balanceResponse = await testEnv.suiClient.getBalance({
      owner: primaryWallet.address,
      coinType: "0x2::sui::SUI"
    })
    
    const requiredBalanceProps = ['coinType', 'coinObjectCount', 'totalBalance', 'lockedBalance']
    for (const prop of requiredBalanceProps) {
      if (!(prop in balanceResponse)) {
        throw new Error(`Missing required balance response property: ${prop}`)
      }
    }
    
    if (typeof balanceResponse.totalBalance !== 'string') {
      throw new Error('totalBalance is not a string')
    }
    
    if (typeof balanceResponse.coinObjectCount !== 'number') {
      throw new Error('coinObjectCount is not a number')
    }
    
    console.log('   ✓ Network response format validation passed')
    
    console.log('\n✅ Interface Validation Complete!')
    console.log('=================================')
    
    console.log(`📊 Performance Summary:`)
    console.log(`   • Contract validation: ${duration}ms`)
    console.log(`   • Address encoding: ${encodeDuration}ms`)
    console.log(`   • Network connection: ${connectionDuration}ms`)
    console.log(`   • Balance query: ${balanceDuration}ms`)
    
    const overallPerformance = duration + encodeDuration + connectionDuration + balanceDuration
    console.log(`   • Overall test time: ${overallPerformance}ms`)
    
    if (overallPerformance > 30000) {
      console.warn('⚠️  Overall performance is slow - network may be congested')
    } else {
      console.log('🚀 Performance meets expectations')
    }
    
    await cleanupTestEnvironment()
    console.log('\n🎉 All interface validations passed!')
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('\n❌ Interface validation failed:', errorMessage)
    
    if (error instanceof Error && error.stack) {
      console.error('\nStack trace:')
      console.error(error.stack)
    }
    
    process.exit(1)
  }
}

// Run validation if this script is executed directly
if (require.main === module) {
  validateInterface()
}

export { validateInterface }