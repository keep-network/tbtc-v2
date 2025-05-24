/**
 * Jest configuration for SUI Direct Minting Real Network Tests
 * 
 * This configuration is optimized for real network testing with:
 * - Extended timeouts for network operations
 * - Proper setup/teardown for test environment
 * - Real network error handling
 * - Performance monitoring
 */

module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Test file patterns
  testMatch: [
    '**/test/sui-direct-minting-tests/**/*.test.ts',
    '**/test/sui-direct-minting-tests/**/*.test.js'
  ],
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/'
  ],
  
  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/test/sui-direct-minting-tests/test-setup.ts'
  ],
  
  // Global timeout for real network operations (5 minutes)
  testTimeout: 300000,
  
  // Coverage configuration
  collectCoverageFrom: [
    'test/sui-direct-minting-tests/**/*.ts',
    '!test/sui-direct-minting-tests/**/*.d.ts',
    '!test/sui-direct-minting-tests/**/*.config.ts',
    '!test/sui-direct-minting-tests/**/*.interface.ts'
  ],
  
  // Module resolution
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@test/(.*)$': '<rootDir>/test/$1'
  },
  
  // Transform configuration for TypeScript
  transform: {
    '^.+\\.tsx?$': ['ts-node/esm', {
      tsconfig: '<rootDir>/tsconfig.test.json'
    }]
  },
  
  // Global variables for real network testing
  globals: {
    // Test configuration
    SUI_TESTNET_ENABLED: true,
    REAL_NETWORK_TESTS: true,
    
    // Network timeouts (in milliseconds)
    NETWORK_CONNECTION_TIMEOUT: 30000,
    TRANSACTION_TIMEOUT: 120000,
    DEPOSIT_TRACKING_TIMEOUT: 180000,
    
    // Retry configuration
    MAX_NETWORK_RETRIES: 3,
    RETRY_DELAY_BASE: 1000,
    
    // Test data paths
    TEST_DATA_DIR: '<rootDir>/test/sui-direct-minting-tests/test-data',
    TEMP_FILE_DIR: '<rootDir>/test/sui-direct-minting-tests/temp'
  },
  
  // Reporter configuration
  reporters: [
    'default',
    ['jest-html-reporters', {
      publicPath: './test-results',
      filename: 'sui-direct-minting-test-report.html',
      expand: true,
      hideIcon: false,
      pageTitle: 'SUI Direct Minting Test Results'
    }]
  ],
  
  // Verbose output for debugging
  verbose: true,
  
  // Silent mode (set to false for debugging)
  silent: false,
  
  // Error handling
  errorOnDeprecated: true,
  
  // Performance monitoring
  detectOpenHandles: true,
  detectLeaks: true,
  
  // Force exit after tests complete
  forceExit: true,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Reset modules between tests
  resetModules: true,
  
  // Maximum number of concurrent workers
  maxWorkers: 1, // Single worker for real network tests to avoid conflicts
  
  // Cache configuration
  cache: false, // Disable cache for real network tests
  
  // Module file extensions
  moduleFileExtensions: [
    'ts',
    'tsx',
    'js',
    'jsx',
    'json',
    'node'
  ],
  
  // Root directory
  rootDir: '../..',
  
  // Test directory
  testMatch: [
    '<rootDir>/test/sui-direct-minting-tests/**/*.test.ts'
  ]
}