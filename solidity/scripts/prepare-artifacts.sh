#!/bin/bash
set -eo pipefail

help() {
  echo -e "\nUsage: $0 --network <network>"

  echo -e "\nCommand line arguments:\n"
  echo -e "\t--network: Ethereum network." \
    "Available networks and settings are specified in 'hardhat.config.ts'"
  exit 1 # Exit script after printing help
}

# Transform long options to short ones
for arg in "$@"; do
  shift
  case "$arg" in
    "--network") set -- "$@" "-n" ;;
    "--help") set -- "$@" "-h" ;;
    *) set -- "$@" "$arg" ;;
  esac
done

# Parse short options
OPTIND=1
while getopts "n:h" opt; do
  case "$opt" in
    n) NETWORK="$OPTARG" ;;
    h) help ;;
    ?) help ;; # Print help in case parameter is non-existent
  esac
done
shift $(expr $OPTIND - 1) # remove options from positional parameters

[ -z "$NETWORK" ] && {
  echo "--network option not provided" >&2
  help
  exit 1
}

# For `development` network we don't expect the deployment artifacts to be published.
# We want to gracefully exit the script, so the package publication can be
# completed. This is a solution we use to publish a NPM package that can be used
# in other projects.
[[ $NETWORK == "development" ]] && {
  echo "Skipping execution for network: $NETWORK"
  exit 0
}

echo "Copying deployments artifacts for network: $NETWORK"

ROOT_DIR="$(realpath "$(dirname "$0")/..")"
SOURCE_DEPLOYMENT_DIR="$(realpath "$ROOT_DIR/deployments/$NETWORK")"
DESTINATION_ARTIFACTS_DIR="$(realpath "$ROOT_DIR/artifacts")"

[ ! -d "${SOURCE_DEPLOYMENT_DIR}" ] && {
  echo "$SOURCE_DEPLOYMENT_DIR does not exist" >&2
  exit 1
}

rm -rf $DESTINATION_ARTIFACTS_DIR
cp -r deployments/$NETWORK $DESTINATION_ARTIFACTS_DIR

echo "Deployment artifacts copied to: $DESTINATION_ARTIFACTS_DIR"
