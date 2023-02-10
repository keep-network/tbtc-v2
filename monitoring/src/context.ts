// List of environment variables used by the monitoring package.
const {
  ENVIRONMENT,
  ETHEREUM_URL,
  LARGE_DEPOSIT_THRESHOLD_SAT,
  GCS_BUCKET
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

const resolveGcsBucket = (): string => {
  if (GCS_BUCKET) {
    return GCS_BUCKET
  }

  throw new Error("unknown GCS bucket; please set the GCS_BUCKET env variable")
}

export const context = {
  environment: resolveEnvironment(),
  ethereumUrl: ETHEREUM_URL,
  largeDepositThresholdSat: LARGE_DEPOSIT_THRESHOLD_SAT ?? 1000000000, // 10 BTC by default
  gcsBucket: resolveGcsBucket()
}