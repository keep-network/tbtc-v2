#!/bin/bash
set -eou pipefail

LOG_START='\n\e[1;36m'           # new line + bold + color
LOG_END='\n\e[0m'                # new line + reset color
DONE_START='\n\e[1;32m'          # new line + bold + green
DONE_END='\n\n\e[0m'             # new line + reset
LOG_WARNING_START='\n\e\033[33m' # new line + bold + warning color
LOG_WARNING_END='\n\e\033[0m'    # new line + reset

ROOT_PATH=$PWD

NETWORK_DEFAULT="mainnet"
ELECTRUM_HOST_DEFAULT="electrumx-server.test.tbtc.network"
ELECTRUM_PORT_DEFAULT="8443"
ELECTRUM_PROTOCOL_DEFAULT="wss"


help() {
  echo -e "\nUsage: $0" \
    "--deposit-json-path <deposit-JSON-file-path>" \
    "--amount <amount>" \
    "--transaction-id <transaction-id>" \
    "--recovery-address <recovery-address>" \
    "--private-key <wallet-private-key>" \
    "--recovery-address <recovery-address>" \
    "--electrum-host <electrum-host>" \
    "--electrum-port <electrum-port>" \
    "--electrum-protocol <electrum-protocol>"
  echo -e "\nRequired command line arguments:\n"
  echo -e "\t--deposit-path: Deposit JSON file path"
  echo -e "\t--amount: Amount of BTC to refund in satoshi"
  echo -e "\t--transaction-id: Transaction ID/hash of the original deposit"
  echo -e "\t--private-key: Private key of the BTC recovery wallet"
  echo -e "\t--recovery-address: Recovery BTC address"
  echo -e "\nOptional command line arguments:\n"
  echo -e "\t--host: Electrum host. Default: ${ELECTRUM_HOST_DEFAULT}"
  echo -e "\t--port: Electrum port. Default: ${ELECTRUM_PORT_DEFAULT}"
  echo -e "\t--protocol: Electrum protocol. Default: ${ELECTRUM_PROTOCOL_DEFAULT}"
  echo -e ""
  exit 1 # Exit script after printing help
}

# Transform long options to short ones
for arg in "$@"; do
  shift
  case "$arg" in
  "--deposit-json-path") set -- "$@" "-d" ;;
  "--amount") set -- "$@" "-a" ;;
  "--transaction-id") set -- "$@" "-t" ;;
  "--private-key") set -- "$@" "-k" ;;
  "--recovery-address") set -- "$@" "-r" ;;
  "--host") set -- "$@" "-o" ;;
  "--port") set -- "$@" "-p" ;;
  "--protocol") set -- "$@" "-r" ;;
  "--help") set -- "$@" "-h" ;;
  *) set -- "$@" "$arg" ;;
  esac
done

# Parse short options
OPTIND=1
while getopts "d:a:t:k:r:o:p:r:h" opt; do
  case "$opt" in
  d) deposit_json_path="$OPTARG" ;;
  a) amount="$OPTARG" ;;
  t) transaction_id="$OPTARG" ;;
  k) private_key="$OPTARG" ;;
  r) recovery_address="$OPTARG" ;;
  o) host="$OPTARG" ;;
  p) port="$OPTARG" ;;
  r) protocol="$OPTARG" ;;
  h) help ;;
  ?) help ;; # Print help in case parameter is non-existent
  esac
done
shift $(expr $OPTIND - 1) # remove options from positional parameters

DEPOSIT_PATH=${deposit_json_path:-""}
AMOUNT=${amount:-""}
TRANSACTION_ID=${transaction_id:-""}
PRIVATE_KEY=${private_key:-""}
RECOVERY_ADDRESS=${recovery_address:-""}
HOST=${host:-${ELECTRUM_HOST_DEFAULT}}
PORT=${port:-${ELECTRUM_PORT_DEFAULT}}
PROTOCOL=${protocol:-${ELECTRUM_PROTOCOL_DEFAULT}}

if [ "$DEPOSIT_PATH" == "" ]; then
  printf "${LOG_WARNING_START}Deposit JSON path must be provided.${LOG_WARNING_END}"
  help
fi

if [ "$AMOUNT" == "" ]; then
  printf "${LOG_WARNING_START}Amount must be provided.${LOG_WARNING_END}"
  help
fi

if [ "$TRANSACTION_ID" == "" ]; then
  printf "${LOG_WARNING_START}Transaction ID must be provided.${LOG_WARNING_END}"
  help
fi

if [ "$PRIVATE_KEY" == "" ]; then
  printf "${LOG_WARNING_START}Wallet recovery private key must be provided.${LOG_WARNING_END}"
  help
fi

if [ "$RECOVERY_ADDRESS" == "" ]; then
  printf "${LOG_WARNING_START}Recovery BTC address must be provided.${LOG_WARNING_END}"
  help
fi

printf "${LOG_START}Installing yarn dependencies...${LOG_END}"
# yarn install

# Run script
printf "${LOG_START}Recovering BTC...${LOG_END}"

yarn refund \
  --deposit-json-path ${DEPOSIT_PATH} \
  --amount ${AMOUNT} \
  --transaction-id ${TRANSACTION_ID} \
  --private-key ${PRIVATE_KEY} \
  --recovery-address ${RECOVERY_ADDRESS} \
  --host ${HOST} \
  --port ${PORT} \
  --protocol ${PROTOCOL} \

printf "${DONE_START}Complete!${DONE_END}"
