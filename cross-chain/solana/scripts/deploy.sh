#!/bin/bash
set -eo pipefail

# Setting env variables in the current bash shell
source solana.env

[ -z "$CLUSTER" ] && {
  echo "'--cluster' option not provided" >&2
  help
  exit 1
}

[ -z "$AUTHORITY" ] && {
  echo "'AUTHORITY' env var is not set" >&2
  exit 1
}

echo "Building workspace for cluster: $CLUSTER ..."
anchor build --provider.cluster $CLUSTER

echo "Syncing the program's id ..."
anchor keys sync

echo "Building workspace again to include new program ID in the binary ..."
anchor build --provider.cluster $CLUSTER

echo "Deploying program(s) for cluster: $CLUSTER ..."
anchor deploy --provider.cluster $CLUSTER --provider.wallet $AUTHORITY

echo "Migrating..."
anchor migrate --provider.cluster $CLUSTER --provider.wallet $AUTHORITY