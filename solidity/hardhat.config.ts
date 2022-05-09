import { HardhatUserConfig } from "hardhat/config"

import "@keep-network/hardhat-helpers"
import "@keep-network/hardhat-local-networks-config"
import "@nomiclabs/hardhat-waffle"
import "@nomiclabs/hardhat-etherscan"
import "hardhat-gas-reporter"
import "hardhat-contract-sizer"
import "hardhat-deploy"
import "@tenderly/hardhat-tenderly"
import "@typechain/hardhat"

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
  operatorsCount: 100,
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
      tags: ["local"],
    },
    development: {
      url: "http://localhost:8545",
      chainId: 1101,
      tags: ["local"],
    },
    ropsten: {
      url: process.env.CHAIN_API_URL || "",
      chainId: 3,
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
    contracts: [
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
        artifacts: "node_modules/@keep-network/ecdsa/export/artifacts",
        deploy: "node_modules/@keep-network/ecdsa/export/deploy",
      },
    ],
    deployments: {
      // For development environment we expect the local dependencies to be
      // linked with `yarn link` command.
      development: ["node_modules/@keep-network/tbtc/artifacts"],
      ropsten: ["node_modules/@keep-network/tbtc/artifacts"],
      mainnet: ["./external/mainnet"],
    },
  },

  namedAccounts: {
    deployer: {
      default: 1,
    },
    treasury: {
      default: 2,
    },
    governance: {
      default: 3,
    },
    keepTechnicalWalletTeam: {
      mainnet: "0xB3726E69Da808A689F2607939a2D9E958724FC2A",
    },
    keepCommunityMultiSig: {
      mainnet: "0x19FcB32347ff4656E4E6746b4584192D185d640d",
    },
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
  typechain: {
    outDir: "typechain",
    // TODO: Is this the proper way to get the types of the external contracts
    //       (needed for the integration test)?
    externalArtifacts: [
      "./node_modules/@keep-network/ecdsa/export/artifacts/IRandomBeacon.json",
      "./node_modules/@keep-network/ecdsa/export/artifacts/ReimbursementPool.json",
      "./node_modules/@keep-network/ecdsa/export/artifacts/SortitionPool.json",
      "./node_modules/@keep-network/ecdsa/export/artifacts/T.json",
      "./node_modules/@keep-network/ecdsa/export/artifacts/TokenStaking.json",
      "./node_modules/@keep-network/ecdsa/export/artifacts/WalletRegistry.json",
      "./node_modules/@keep-network/ecdsa/export/artifacts/WalletRegistryGovernance.json",
    ],
  },
}

export default config
