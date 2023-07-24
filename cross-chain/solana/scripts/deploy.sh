#!/bin/bash
set -eo pipefail

help() {
  echo -e "\nUsage: $0 --cluster <cluster>"

  echo -e "\nCommand line arguments:\n"
  echo -e "\t--cluster: <cluster>\n" \
    "\t\tAvailable deployment clusters: 'mainnet-beta', 'devnet', and 'localnet'." \
    "Overrides a cluster set in Anchor.toml"
  exit 1 # Exit script after printing help
}

# Setting env variables in the current bash shell
source solana.env

# Transform long options to short ones
for arg in "$@"; do
  shift
  case "$arg" in
    "--cluster") set -- "$@" "-n" ;;
    "--help") set -- "$@" "-h" ;;
    *) set -- "$@" "$arg" ;;
  esac
done

# Parse short options
OPTIND=1
while getopts "n:w:h" opt; do
  case "$opt" in
    n) CLUSTER="$OPTARG" ;;
    h) help ;;
    ?) help ;; # Print help in case parameter is non-existent
  esac
done
shift $(expr $OPTIND - 1) # remove options from positional parameters

[ -z "$CLUSTER" ] && {
  echo "'--cluster' option not provided" >&2
  help
  exit 1
}

[ -z "$WALLET" ] && {
  echo "'WALLET' env var is not set" >&2
  exit 1
}

[ -z "$TBTC_KEYS" ] && {
  echo "'WALLET' env var is not set" >&2
  exit 1
}

[ -z "$MINTER_KEYS" ] && {
  echo "'MINTER_KEYS' env var is not set" >&2
  exit 1
}

echo "Building workspace for cluster: $CLUSTER ..."
anchor build --provider.cluster $CLUSTER

echo "Syncing the program's id ..."
anchor keys sync

echo "Building workspace again to include new program ID in the binary ..."
anchor build --provider.cluster $CLUSTER

echo "Deploying program(s) for cluster: $CLUSTER ..."
anchor deploy --provider.cluster $CLUSTER --provider.wallet $WALLET

echo "Migrating..."
anchor migrate --provider.cluster $CLUSTER --provider.wallet $WALLET
