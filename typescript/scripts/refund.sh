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
    "--deposit-transaction-amount <deposit-transaction-amount>" \
    "--deposit-transaction-id <deposit-transaction-id>" \
    "--deposit-transaction-index <deposit-transaction-index>" \
    "--private-key <recoverer-private-key>" \
    "--transaction-fee <transaction-fee>" \
    "--electrum-host <electrum-host>" \
    "--electrum-port <electrum-port>" \
    "--electrum-protocol <electrum-protocol>"
  echo -e "\nRequired command line arguments:\n"
  echo -e "\t--deposit-json-path: Deposit JSON file path"
  echo -e "\t--deposit-transaction-amount: Amount of BTC to recover in satoshi. Must match the original deposit amount."
  echo -e "\t--deposit-transaction-id: Transaction ID/hash of the original deposit"
  echo -e "\t--deposit-transaction-index: Deposit transaction index"
  echo -e "\t--private-key: Private key of the BTC recovery wallet"
  echo -e "\t--transaction-fee: Recovery transaction fee that a user is willing to pay"
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
  "--deposit-amount") set -- "$@" "-a" ;;
  "--deposit-transaction-id") set -- "$@" "-t" ;;
  "--deposit-transaction-index") set -- "$@" "-i" ;;
  "--private-key") set -- "$@" "-k" ;;
  "--transaction-fee") set -- "$@" "-f" ;;
  "--host") set -- "$@" "-o" ;;
  "--port") set -- "$@" "-p" ;;
  "--protocol") set -- "$@" "-r" ;;
  "--help") set -- "$@" "-h" ;;
  *) set -- "$@" "$arg" ;;
  esac
done

# Parse short options
OPTIND=1
while getopts "d:a:t:i:k:f:o:p:r:h" opt; do
  case "$opt" in
  d) deposit_json_path="$OPTARG" ;;
  a) deposit_amount="$OPTARG" ;;
  t) deposit_transaction_id="$OPTARG" ;;
  i) deposit_transaction_index="$OPTARG" ;;
  k) private_key="$OPTARG" ;;
  f) transaction_fee="$OPTARG" ;;
  o) host="$OPTARG" ;;
  p) port="$OPTARG" ;;
  r) protocol="$OPTARG" ;;
  h) help ;;
  ?) help ;; # Print help in case parameter is non-existent
  esac
done
shift $(expr $OPTIND - 1) # remove options from positional parameters

DEPOSIT_PATH=${deposit_json_path:-""}
DEPOSIT_AMOUNT=${deposit_amount:-""}
DEPOSIT_TRANSACTION_ID=${deposit_transaction_id:-""}
DEPOSIT_TRANSACTION_INDEX=${deposit_transaction_index:-""}
PRIVATE_KEY=${private_key:-""}
TRANSACTION_FEE=${transaction_fee:-""}
HOST=${host:-${ELECTRUM_HOST_DEFAULT}}
PORT=${port:-${ELECTRUM_PORT_DEFAULT}}
PROTOCOL=${protocol:-${ELECTRUM_PROTOCOL_DEFAULT}}

if [ "$DEPOSIT_PATH" == "" ]; then
  printf "${LOG_WARNING_START}Deposit JSON path must be provided.${LOG_WARNING_END}"
  help
fi

if [ "$DEPOSIT_AMOUNT" == "" ]; then
  printf "${LOG_WARNING_START}Deposit amount must be provided.${LOG_WARNING_END}"
  help
fi

if [ "$DEPOSIT_TRANSACTION_ID" == "" ]; then
  printf "${LOG_WARNING_START}Deposit transaction ID must be provided.${LOG_WARNING_END}"
  help
fi

if [ "$DEPOSIT_TRANSACTION_INDEX" == "" ]; then
  printf "${LOG_WARNING_START}Deposit transaction index must be provided.${LOG_WARNING_END}"
  help
fi

if [ "$PRIVATE_KEY" == "" ]; then
  printf "${LOG_WARNING_START}Recoverer private key must be provided.${LOG_WARNING_END}"
  help
fi

if [ "$TRANSACTION_FEE" == "" ]; then
  printf "${LOG_WARNING_START}Transaction fee must be provided.${LOG_WARNING_END}"
  help
fi

printf "${LOG_START}Installing yarn dependencies...${LOG_END}"
yarn install

# Run script
printf "${LOG_START}Recovering BTC...${LOG_END}"

yarn refund \
  --deposit-json-path ${DEPOSIT_PATH} \
  --deposit-amount ${DEPOSIT_AMOUNT} \
  --deposit-transaction-id ${DEPOSIT_TRANSACTION_ID} \
  --deposit-transaction-index ${DEPOSIT_TRANSACTION_INDEX} \
  --private-key ${PRIVATE_KEY} \
  --transaction-fee ${TRANSACTION_FEE} \
  --host ${HOST} \
  --port ${PORT} \
  --protocol ${PROTOCOL} \

printf "${DONE_START}Complete!${DONE_END}"
