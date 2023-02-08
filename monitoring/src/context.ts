// List of environment variables used by the monitoring package.
const {
  ENVIRONMENT
} = process.env;

export enum Environment {
  Mainnet = "mainnet",
  Testnet = "testnet"
}

const resolveEnvironment = () => {
  switch (ENVIRONMENT) {
    case Environment.Mainnet: {
      return Environment.Mainnet
    }
    case Environment.Testnet: {
      return Environment.Testnet
    }
    default: {
      throw new Error("unknown environment")
    }
  }
}

export const context = {
  environment: resolveEnvironment(),
}