#!/bin/bash
set -eo pipefail

# Setting env variables in the current bash shell
source solana.env

# TODO: transfer upgrade authority to Threshold Council Multisig
# solana program set-upgrade-authority -k <current_keypair_path> <programID> --new-upgrade-authority <pubkey>

# Transfer authority to the Threshold Council Multisig
# TODO: verify if the authority was actually transferred.
anchor run authority --provider.cluster $CLUSTER