#!/bin/bash
set -eo pipefail

# Setting env variables in the current bash shell
source .env

# Deploy to devnet by default
ARTIFACTS_PATH=artifacts-testnet

[ -z "$NETWORK" ] && {
  echo "'NETWORK' env var is not set" >&2
  exit 1
}

[ -z "$AUTHORITY" ] && {
  echo "'AUTHORITY' env var is not set" >&2
  exit 1
}

if [[ $CLUSTER = mainnet-beta ]]
then
  ARTIFACTS_PATH=artifacts-mainnet
fi

echo "Building workspace for cluster: $NETWORK ..."
make build

echo "Deploying TBTC program for cluster: $CLUSTER ..."
solana program deploy --url $CLUSTER --keypair $AUTHORITY ./$ARTIFACTS_PATH/tbtc.so

echo "Deploying WORMHOLE_GATEWAY program for cluster: $CLUSTER ..."
solana program deploy --url $CLUSTER --keypair $AUTHORITY ./$ARTIFACTS_PATH/wormhole_gateway.so
