#!/bin/bash
set -eo pipefail

## FOR MAINNET ONLY

# Setting env variables in the current bash shell
source solana.env

## Transfer authority to the Threshold Council Multisig. (for mainnet only)
# make transfer_authority

## Transfer upgrade authority to Threshold Council Multisig
# solana program set-upgrade-authority -k <current_keypair_path> <programID> --new-upgrade-authority <pubkey>

## Threshold Council Multisig has to accept the ownership by executing
## `takeAuthority` instruction