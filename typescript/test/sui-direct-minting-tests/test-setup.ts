/**
 * Test Setup for SUI Direct Minting Real Network Tests
 * 
 * This file configures the Jest test environment for real SUI testnet operations.
 * It handles global setup, teardown, and configuration for all test suites.
 */

import { beforeAll, afterAll, beforeEach, afterEach } from 'mocha'
import { getTestEnvironment, cleanupTestEnvironment, SuiTestnetEnvironment } from './00-test-environment'

// Global test environment instance
let globalTestEnv: SuiTestnetEnvironment | null = null

/**
 * Global test setup - runs once before all tests
 */
beforeAll(async () => {
  console.log('\n🚀 Setting up SUI Direct Minting Test Environment')
  console.log('================================================')
  
  try {
    // Initialize the real SUI testnet environment
    globalTestEnv = await getTestEnvironment()
    
    // Validate environment is ready
    const isHealthy = await globalTestEnv.checkNetworkHealth()
    if (!isHealthy) {
      console.warn('⚠️  Network health check failed - tests may be unreliable')
    }
    
    // Log environment details
    console.log(`📡 Network: ${globalTestEnv.config.rpcUrl}`)
    console.log(`📋 Package: ${globalTestEnv.config.packageId}`)
    
    const primaryWallet = globalTestEnv.getTestWallet('primary-test-wallet')
    console.log(`🔑 Primary Wallet: ${primaryWallet.address}`)
    
    // Validate wallet funding
    try {
      const balance = await globalTestEnv.suiClient.getBalance({
        owner: primaryWallet.address,
        coinType: "0x2::sui::SUI"
      })
      
      const suiAmount = (Number(balance.totalBalance) / 1000000000).toFixed(4)
      console.log(`💰 Wallet Balance: ${suiAmount} SUI`)
      
      if (Number(balance.totalBalance) < 100000000) { // Less than 0.1 SUI
        console.warn('⚠️  Low wallet balance - some tests may fail due to insufficient gas')
        console.warn('   Fund wallet at: https://suifaucet.com')
        console.warn(`   Address: ${primaryWallet.address}`)
      }
    } catch (error) {
      console.warn('⚠️  Could not check wallet balance - continuing with tests')
    }
    
    console.log('✅ Test environment ready\n')
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('❌ Failed to setup test environment:', errorMessage)
    throw error
  }
}, 60000) // 60 second timeout for environment setup

/**
 * Global test teardown - runs once after all tests
 */
afterAll(async () => {
  console.log('\n🧹 Cleaning up SUI Direct Minting Test Environment')
  console.log('===============================================')
  
  try {
    await cleanupTestEnvironment()
    globalTestEnv = null
    console.log('✅ Test environment cleaned up')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('⚠️  Error during cleanup:', errorMessage)
  }
}, 30000) // 30 second timeout for cleanup

/**
 * Test suite setup - runs before each test suite
 */
beforeEach(async () => {
  // Validate environment is still healthy before each test
  if (globalTestEnv) {
    const isHealthy = await globalTestEnv.checkNetworkHealth()
    if (!isHealthy) {
      console.warn('⚠️  Network health degraded - test may fail')
    }
  }
})

/**
 * Test suite teardown - runs after each test suite
 */
afterEach(async () => {
  // Basic cleanup after each test
  // Real network tests don't need extensive cleanup between tests
  // as they don't modify persistent state
})

/**
 * Global error handlers for unhandled rejections and exceptions
 */
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
  // Don't exit process in tests, just log
})

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
  // Don't exit process in tests, just log
})

/**
 * Global test environment configuration
 */
declare global {
  namespace NodeJS {
    interface Global {
      testEnvironment: SuiTestnetEnvironment | null
    }
  }
}

// Make test environment available globally
(global as any).testEnvironment = globalTestEnv

/**
 * Custom test utilities
 */
export const testUtils = {
  /**
   * Get the global test environment
   */
  getTestEnvironment(): SuiTestnetEnvironment {
    if (!globalTestEnv) {
      throw new Error('Test environment not initialized. Make sure tests are running with proper setup.')
    }
    return globalTestEnv
  },
  
  /**
   * Wait for a condition with timeout
   */
  async waitFor(
    condition: () => Promise<boolean>,
    timeout: number = 30000,
    interval: number = 1000
  ): Promise<void> {
    const startTime = Date.now()
    
    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return
      }
      await new Promise(resolve => setTimeout(resolve, interval))
    }
    
    throw new Error(`Condition not met within ${timeout}ms`)
  },
  
  /**
   * Retry an operation with exponential backoff
   */
  async retry<T>(
    operation: () => Promise<T>,
    maxAttempts: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error as Error
        
        if (attempt === maxAttempts) {
          throw lastError
        }
        
        const delay = baseDelay * Math.pow(2, attempt - 1)
        console.log(`Retry attempt ${attempt} failed, waiting ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
    
    throw lastError!
  },
  
  /**
   * Validate transaction hash format
   */
  isValidTransactionHash(hash: string): boolean {
    return /^[a-fA-F0-9]{64}$/.test(hash.replace(/^0x/, ''))
  },
  
  /**
   * Validate SUI address format
   */
  isValidSUIAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{64}$/.test(address)
  },
  
  /**
   * Format SUI balance from MIST
   */
  formatSUIBalance(mistBalance: bigint): string {
    const suiAmount = Number(mistBalance) / 1000000000
    return suiAmount.toFixed(4)
  },
  
  /**
   * Generate test file path
   */
  getTestFilePath(filename: string): string {
    const testDataDir = process.env.TEST_DATA_DIR || './test-data'
    return `${testDataDir}/${filename}`
  },
  
  /**
   * Sleep for specified milliseconds
   */
  async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

/**
 * Console logging configuration for tests
 */
const originalConsoleLog = console.log
console.log = (...args) => {
  // Add timestamp to all console.log outputs in tests
  const timestamp = new Date().toISOString()
  originalConsoleLog(`[${timestamp}]`, ...args)
}

/**
 * Network performance monitoring
 */
export class NetworkPerformanceMonitor {
  private static startTimes: Map<string, number> = new Map()
  
  static startTiming(operation: string): void {
    this.startTimes.set(operation, Date.now())
  }
  
  static endTiming(operation: string): number {
    const startTime = this.startTimes.get(operation)
    if (!startTime) {
      throw new Error(`No start time recorded for operation: ${operation}`)
    }
    
    const duration = Date.now() - startTime
    this.startTimes.delete(operation)
    
    console.log(`⏱️  ${operation}: ${duration}ms`)
    return duration
  }
  
  static async measureOperation<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<{ result: T; duration: number }> {
    this.startTiming(operationName)
    const result = await operation()
    const duration = this.endTiming(operationName)
    
    return { result, duration }
  }
}

export { NetworkPerformanceMonitor as PerfMonitor }