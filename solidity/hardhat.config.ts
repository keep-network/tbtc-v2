import { HardhatUserConfig } from "hardhat/config"
import "./tasks"

import "@keep-network/hardhat-helpers"
import "@keep-network/hardhat-local-networks-config"
import "@nomiclabs/hardhat-waffle"
import "@nomiclabs/hardhat-etherscan"
import "hardhat-gas-reporter"
import "hardhat-contract-sizer"
import "hardhat-deploy"
import "@tenderly/hardhat-tenderly"
import "@typechain/hardhat"
import "hardhat-dependency-compiler"

const ecdsaSolidityCompilerConfig = {
  version: "0.8.9",
  settings: {
    optimizer: {
      enabled: true,
      runs: 200,
    },
  },
}

// Reduce the number of optimizer runs to 100 to keep the contract size sane.
// BridgeGovernance contract does not need to be super gas-efficient.
const bridgeGovernanceCompilerConfig = {
  version: "0.8.9",
  settings: {
    optimizer: {
      enabled: true,
      runs: 200,
    },
  },
}

// Configuration for testing environment.
export const testConfig = {
  // How many accounts we expect to define for non-staking related signers, e.g.
  // deployer, thirdParty, governance.
  // It is used as an offset for getting accounts for operators and stakes registration.
  nonStakingAccountsCount: 10,

  // How many roles do we need to define for staking, i.e. stakeOwner, stakingProvider,
  // operator, beneficiary, authorizer.
  stakingRolesCount: 5,

  // Number of operators to register. Should be at least the same as group size.
  operatorsCount: 110,
}

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.9", // TODO: Revisit solidity version before deploying on mainnet!
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000,
          },
        },
      },
    ],
    overrides: {
      "@keep-network/ecdsa/contracts/WalletRegistry.sol":
        ecdsaSolidityCompilerConfig,
      "contracts/bridge/BridgeGovernance.sol": bridgeGovernanceCompilerConfig,
    },
  },

  paths: {
    artifacts: "./build",
  },

  networks: {
    hardhat: {
      forking: {
        // forking is enabled only if FORKING_URL env is provided
        enabled: !!process.env.FORKING_URL,
        // URL should point to a node with archival data (Alchemy recommended)
        url: process.env.FORKING_URL || "",
        // latest block is taken if FORKING_BLOCK env is not provided
        blockNumber:
          process.env.FORKING_BLOCK && parseInt(process.env.FORKING_BLOCK, 10),
      },
      accounts: {
        // Number of accounts that should be predefined on the testing environment.
        count:
          testConfig.nonStakingAccountsCount +
          testConfig.stakingRolesCount * testConfig.operatorsCount,
      },
      tags: ["allowStubs"],
      // we use higher gas price for tests to obtain more realistic results
      // for gas refund tests than when the default hardhat ~1 gwei gas price is
      // used
      gasPrice: 200000000000, // 200 gwei
      // Ignore contract size on deployment to hardhat network, to be able to
      // deploy stub contracts in tests.
      allowUnlimitedContractSize: process.env.TEST_USE_STUBS_TBTC === "true",
    },
    development: {
      url: "http://localhost:8545",
      chainId: 1101,
      tags: ["allowStubs"],
    },
    goerli: {
      url: process.env.CHAIN_API_URL || "",
      chainId: 5,
      accounts: process.env.CONTRACT_OWNER_ACCOUNT_PRIVATE_KEY
        ? [process.env.CONTRACT_OWNER_ACCOUNT_PRIVATE_KEY]
        : undefined,
      tags: ["tenderly"],
    },
  },

  tenderly: {
    username: "thesis",
    project: "",
  },

  // Define local networks configuration file path to load networks from file.
  // localNetworksConfig: "./.hardhat/networks.ts",

  external: {
    contracts:
      process.env.USE_EXTERNAL_DEPLOY === "true"
        ? [
            {
              artifacts: "node_modules/@keep-network/tbtc/artifacts",
            },
            {
              artifacts:
                "node_modules/@threshold-network/solidity-contracts/export/artifacts",
              deploy:
                "node_modules/@threshold-network/solidity-contracts/export/deploy",
            },
            {
              artifacts:
                "node_modules/@keep-network/random-beacon/export/artifacts",
              deploy: "node_modules/@keep-network/random-beacon/export/deploy",
            },
            {
              artifacts: "node_modules/@keep-network/ecdsa/export/artifacts",
              deploy: "node_modules/@keep-network/ecdsa/export/deploy",
            },
          ]
        : undefined,
    deployments: {
      // For development environment we expect the local dependencies to be
      // linked with `yarn link` command.
      development: [
        "node_modules/@keep-network/random-beacon/deployments/development",
        "node_modules/@keep-network/ecdsa/deployments/development",
      ],
      goerli: [
        "node_modules/@keep-network/tbtc/artifacts",
        "node_modules/@keep-network/random-beacon/artifacts",
        "node_modules/@keep-network/ecdsa/artifacts",
      ],
      mainnet: ["./external/mainnet"],
    },
  },

  namedAccounts: {
    deployer: {
      default: 1,
      goerli: 0,
    },
    // TODO: Governance should be the Threshold Council.
    //       Inspect usages and rename.
    governance: {
      default: 2,
      goerli: 0,
    },
    esdm: {
      default: 3,
      goerli: 0,
      // mainnet: ""
    },
    keepTechnicalWalletTeam: {
      default: 4,
      goerli: 0,
      mainnet: "0xB3726E69Da808A689F2607939a2D9E958724FC2A",
    },
    keepCommunityMultiSig: {
      default: 5,
      goerli: 0,
      mainnet: "0x19FcB32347ff4656E4E6746b4584192D185d640d",
    },
    treasury: {
      default: 6,
      goerli: 0,
    },
    spvMaintainer: {
      default: 7,
      goerli: 0,
    },
  },
  dependencyCompiler: {
    paths: [
      "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol",
      "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol",
      // WalletRegistry contract is deployed with @open-zeppelin/hardhat-upgrades
      // plugin that doesn't work well with hardhat-deploy artifacts defined in
      // external artifacts section, hence we have to compile the contracts from
      // sources.
      "@keep-network/ecdsa/contracts/WalletRegistry.sol",
    ],
    keep: true,
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: true,
  },
  mocha: {
    timeout: 60_000,
  },
  typechain: {
    outDir: "typechain",
  },
}

export default config
