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

# Build and deploy process should be split in a couple of steps. Here is a 
# checklist:

## First run the following 'make build'
# echo "Building workspace for cluster: $NETWORK ..."
# make build

## Now check the program IDs by running
## `solana-keygen pubkey target/deploy/tbtc-keypair.json`
## `solana-keygen pubkey target/deploy/wormhole_gateway-keypair.json`
## Copy and paste these addresses in both programs 'lib.rs' and in Anchor.toml
## In Anchor toml make sure that cluster and program point to the right network:
## e.g. devnet, mainnet-beta

## Now run the build again to. his step is to include the new program id in the binary.
# anchor build --arch sbf -- --features "<NETWORK>" -- --no-default-features
## where NETWORK can be one of the following: solana-devnet OR mainnet

## Deploy programs
# echo "Deploying program(s) for cluster: $CLUSTER ..."
# anchor deploy --provider.cluster $CLUSTER --provider.wallet $AUTHORITY

## And now it's time to initialize tbtc and wormhole_gatewa programs
# make init_programs

## The last step is to transfer authority to the Threshold Council. (for mainnet only)
# make transfer_authority

## Also run transfer_authority.sh script to transfer upgrade authority. (for mainnet only)

## Publishing IDL so that Solana ecosystem can detect and display data nicely (nice to have)
# anchor idl init --provider.cluster $CLUSTER --provider.wallet $AUTHORITY -f target/idl/<program_idl>.json <program_id>