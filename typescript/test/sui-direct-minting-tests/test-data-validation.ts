#!/usr/bin/env npx ts-node
/**
 * Test Data Validation and Cleanup Script
 * 
 * This script validates the real JSON samples against live network data
 * and provides automated test environment cleanup functionality.
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import { getTestEnvironment, cleanupTestEnvironment } from './00-test-environment'
import { 
  REAL_SUI_DEPOSIT_RECEIPT_SAMPLE,
  REAL_SUI_MAINNET_DEPOSIT_RECEIPT,
  DEPOSIT_STATE_SAMPLES,
  SUI_NETWORK_CONFIG_SAMPLES,
  SUI_DEPOSIT_EVENT_SAMPLES,
  BITCOIN_TRANSACTION_SAMPLES,
  SUI_WALLET_SAMPLES,
  PERFORMANCE_METRICS_SAMPLES,
  JSON_SAMPLE_UTILS
} from './test-data/real-json-samples'

/**
 * Test data directory management
 */
class TestDataManager {
  private testDataDir: string
  private tempDir: string
  
  constructor() {
    this.testDataDir = path.join(__dirname, 'test-data')
    this.tempDir = path.join(__dirname, 'temp')
  }
  
  /**
   * Initialize test data directories
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.testDataDir, { recursive: true })
      await fs.mkdir(this.tempDir, { recursive: true })
      console.log('✅ Test data directories initialized')
    } catch (error) {
      console.error('❌ Failed to initialize directories:', error)
      throw error
    }
  }
  
  /**
   * Clean up test data directories
   */
  async cleanup(): Promise<void> {
    try {
      // Clean up temporary files
      const tempFiles = await fs.readdir(this.tempDir).catch(() => [])
      for (const file of tempFiles) {
        await fs.unlink(path.join(this.tempDir, file))
      }
      
      // Clean up test JSON files
      const testFiles = await fs.readdir(this.testDataDir).catch(() => [])
      const jsonFiles = testFiles.filter(file => file.endsWith('.json') && file.includes('test_'))
      
      for (const file of jsonFiles) {
        await fs.unlink(path.join(this.testDataDir, file))
      }
      
      console.log(`✅ Cleaned up ${tempFiles.length + jsonFiles.length} test files`)
    } catch (error) {
      console.error('⚠️  Error during cleanup:', error)
    }
  }
  
  /**
   * Write test JSON file
   */
  async writeTestJSON(filename: string, data: any): Promise<string> {
    const filePath = path.join(this.tempDir, filename)
    await fs.writeFile(filePath, JSON.stringify(data, null, 2))
    return filePath
  }
  
  /**
   * Read and parse test JSON file
   */
  async readTestJSON(filename: string): Promise<any> {
    const filePath = path.join(this.tempDir, filename)
    const content = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(content)
  }
  
  /**
   * Generate test files for all samples
   */
  async generateAllTestFiles(): Promise<string[]> {
    const files: string[] = []
    
    // Generate deposit receipt files
    const receiptFile = await this.writeTestJSON(
      'test_deposit_receipt_testnet.json',
      REAL_SUI_DEPOSIT_RECEIPT_SAMPLE
    )
    files.push(receiptFile)
    
    const mainnetReceiptFile = await this.writeTestJSON(
      'test_deposit_receipt_mainnet.json', 
      REAL_SUI_MAINNET_DEPOSIT_RECEIPT
    )
    files.push(mainnetReceiptFile)
    
    // Generate deposit state files
    for (const [state, data] of Object.entries(DEPOSIT_STATE_SAMPLES)) {
      const stateFile = await this.writeTestJSON(
        `test_deposit_state_${state}.json`,
        data
      )
      files.push(stateFile)
    }
    
    return files
  }
  
  /**
   * Get test data directory path
   */
  getTestDataDir(): string {
    return this.testDataDir
  }
  
  /**
   * Get temp directory path
   */
  getTempDir(): string {
    return this.tempDir
  }
}

/**
 * Performance monitoring for test operations
 */
class TestPerformanceMonitor {
  private measurements: Map<string, number[]> = new Map()
  
  /**
   * Start timing an operation
   */
  startTiming(operation: string): void {
    if (!this.measurements.has(operation)) {
      this.measurements.set(operation, [])
    }
    this.measurements.get(operation)!.push(Date.now())
  }
  
  /**
   * End timing an operation
   */
  endTiming(operation: string): number {
    const times = this.measurements.get(operation)
    if (!times || times.length === 0) {
      throw new Error(`No timing started for operation: ${operation}`)
    }
    
    const startTime = times.pop()!
    const duration = Date.now() - startTime
    
    console.log(`⏱️  ${operation}: ${duration}ms`)
    return duration
  }
  
  /**
   * Get performance summary
   */
  getSummary(): Record<string, { count: number; total: number; average: number }> {
    const summary: Record<string, { count: number; total: number; average: number }> = {}
    
    for (const [operation, times] of this.measurements.entries()) {
      // Only count completed measurements (even number of entries)
      const completedMeasurements = Math.floor(times.length / 2)
      if (completedMeasurements === 0) continue
      
      let totalDuration = 0
      for (let i = 0; i < completedMeasurements * 2; i += 2) {
        totalDuration += times[i + 1] - times[i]
      }
      
      summary[operation] = {
        count: completedMeasurements,
        total: totalDuration,
        average: totalDuration / completedMeasurements
      }
    }
    
    return summary
  }
  
  /**
   * Reset all measurements
   */
  reset(): void {
    this.measurements.clear()
  }
}

/**
 * Main validation function
 */
async function validateTestData(): Promise<void> {
  console.log('🔧 Test Data Validation & Cleanup')
  console.log('==================================\n')
  
  const dataManager = new TestDataManager()
  const perfMonitor = new TestPerformanceMonitor()
  
  try {
    // Initialize test environment
    console.log('🚀 Initializing test environment...')
    await dataManager.initialize()
    
    perfMonitor.startTiming('Environment Setup')
    const testEnv = await getTestEnvironment()
    perfMonitor.endTiming('Environment Setup')
    
    console.log('\n📋 1. JSON Sample Structure Validation')
    console.log('====================================')
    
    // Test 1: Validate deposit receipt structure
    console.log('Testing deposit receipt structure...')
    
    if (!JSON_SAMPLE_UTILS.isValidDepositReceipt(REAL_SUI_DEPOSIT_RECEIPT_SAMPLE)) {
      throw new Error('Testnet deposit receipt failed validation')
    }
    console.log('   ✓ Testnet deposit receipt structure valid')
    
    if (!JSON_SAMPLE_UTILS.isValidDepositReceipt(REAL_SUI_MAINNET_DEPOSIT_RECEIPT)) {
      throw new Error('Mainnet deposit receipt failed validation')
    }
    console.log('   ✓ Mainnet deposit receipt structure valid')
    
    // Test 2: Validate network configuration compatibility
    console.log('Testing network configuration compatibility...')
    
    const testnetConfig = SUI_NETWORK_CONFIG_SAMPLES.testnet
    if (testnetConfig.rpcUrl !== testEnv.config.rpcUrl) {
      console.warn(`   ⚠️  RPC URL mismatch: sample=${testnetConfig.rpcUrl}, env=${testEnv.config.rpcUrl}`)
    } else {
      console.log('   ✓ Testnet RPC URL matches environment')
    }
    
    if (testnetConfig.packageId !== testEnv.config.packageId) {
      console.warn(`   ⚠️  Package ID mismatch: sample=${testnetConfig.packageId}, env=${testEnv.config.packageId}`)
    } else {
      console.log('   ✓ Package ID matches environment')
    }
    
    console.log('\n📋 2. File Operations Validation')
    console.log('==============================')
    
    // Test 3: File write/read operations
    console.log('Testing file operations...')
    
    perfMonitor.startTiming('File Write')
    const testFiles = await dataManager.generateAllTestFiles()
    perfMonitor.endTiming('File Write')
    
    console.log(`   ✓ Generated ${testFiles.length} test files`)
    
    // Test file reading
    perfMonitor.startTiming('File Read')
    const readReceipt = await dataManager.readTestJSON('test_deposit_receipt_testnet.json')
    perfMonitor.endTiming('File Read')
    
    if (JSON.stringify(readReceipt) !== JSON.stringify(REAL_SUI_DEPOSIT_RECEIPT_SAMPLE)) {
      throw new Error('File read/write integrity check failed')
    }
    console.log('   ✓ File read/write integrity verified')
    
    console.log('\n📋 3. Live Network Data Compatibility')
    console.log('==================================')
    
    // Test 4: Real address compatibility
    console.log('Testing address compatibility...')
    
    const testAddress = testEnv.getPrimaryTestAddress()
    const customReceipt = JSON_SAMPLE_UTILS.createCustomReceipt({
      userWalletAddress: testAddress.toString(),
      btcRecoveryAddress: "tb1qtest123456789abcdef",
      network: 'testnet'
    })
    
    if (customReceipt.userWalletAddress !== testAddress.toString()) {
      throw new Error('Custom receipt generation failed')
    }
    console.log('   ✓ Custom receipt generation working')
    
    if (customReceipt.depositor.identifierHex !== testAddress.toString().replace('0x', '')) {
      throw new Error('Address encoding mismatch')
    }
    console.log('   ✓ Address encoding compatibility verified')
    
    // Test 5: SuiChainAdapter compatibility
    console.log('Testing SuiChainAdapter compatibility...')
    
    const suiAdapter = testEnv.createSuiAdapter()
    const encodedAddress = suiAdapter.encodeDepositOwner(testAddress)
    
    if (encodedAddress.toString() !== testAddress.toString().replace('0x', '')) {
      throw new Error('SuiChainAdapter encoding mismatch with samples')
    }
    console.log('   ✓ SuiChainAdapter encoding matches samples')
    
    console.log('\n📋 4. Performance Benchmarking')
    console.log('============================')
    
    // Test 6: Performance benchmarks
    console.log('Running performance benchmarks...')
    
    perfMonitor.startTiming('Network Request')
    await testEnv.suiClient.getChainIdentifier()
    perfMonitor.endTiming('Network Request')
    
    perfMonitor.startTiming('Address Generation')
    for (let i = 0; i < 10; i++) {
      suiAdapter.encodeDepositOwner(testAddress)
    }
    perfMonitor.endTiming('Address Generation')
    
    const summary = perfMonitor.getSummary()
    console.log('\n📊 Performance Summary:')
    
    for (const [operation, stats] of Object.entries(summary)) {
      console.log(`   • ${operation}: ${stats.average.toFixed(0)}ms avg (${stats.count} samples)`)
      
      // Compare with expected thresholds
      const goodThreshold = getPerformanceThreshold(operation, 'good')
      const acceptableThreshold = getPerformanceThreshold(operation, 'acceptable')
      
      if (stats.average <= goodThreshold) {
        console.log(`     ✅ Performance: GOOD (≤${goodThreshold}ms)`)
      } else if (stats.average <= acceptableThreshold) {
        console.log(`     ⚠️  Performance: ACCEPTABLE (≤${acceptableThreshold}ms)`)
      } else {
        console.log(`     ❌ Performance: POOR (>${acceptableThreshold}ms)`)
      }
    }
    
    console.log('\n📋 5. Test Environment Cleanup')
    console.log('============================')
    
    // Test 7: Cleanup automation
    console.log('Testing cleanup automation...')
    
    perfMonitor.startTiming('Cleanup')
    await dataManager.cleanup()
    await cleanupTestEnvironment()
    perfMonitor.endTiming('Cleanup')
    
    console.log('   ✓ Test environment cleanup completed')
    
    console.log('\n✅ Test Data Validation Complete!')
    console.log('=================================')
    
    const finalSummary = perfMonitor.getSummary()
    const totalOperations = Object.values(finalSummary).reduce((sum, stats) => sum + stats.count, 0)
    const avgTime = Object.values(finalSummary).reduce((sum, stats) => sum + stats.average, 0) / Object.keys(finalSummary).length
    
    console.log(`📊 Final Statistics:`)
    console.log(`   • Total operations tested: ${totalOperations}`)
    console.log(`   • Average operation time: ${avgTime.toFixed(0)}ms`)
    console.log(`   • Test files generated and cleaned: ${testFiles.length}`)
    console.log(`   • All validations: PASSED`)
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('\n❌ Test data validation failed:', errorMessage)
    
    // Attempt cleanup on error
    try {
      await dataManager.cleanup()
      await cleanupTestEnvironment()
    } catch (cleanupError) {
      console.error('⚠️  Cleanup after error failed:', cleanupError)
    }
    
    process.exit(1)
  }
}

/**
 * Get performance threshold for operation
 */
function getPerformanceThreshold(operation: string, level: 'good' | 'acceptable'): number {
  const thresholds: Record<string, Record<string, number>> = {
    'Environment Setup': { good: 5000, acceptable: 15000 },
    'File Write': { good: 100, acceptable: 500 },
    'File Read': { good: 50, acceptable: 200 },
    'Network Request': { good: 1000, acceptable: 5000 },
    'Address Generation': { good: 10, acceptable: 50 },
    'Cleanup': { good: 1000, acceptable: 5000 }
  }
  
  return thresholds[operation]?.[level] || (level === 'good' ? 1000 : 5000)
}

// Run validation if this script is executed directly
if (require.main === module) {
  validateTestData()
}

export { validateTestData, TestDataManager, TestPerformanceMonitor }