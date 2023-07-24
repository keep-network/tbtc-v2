#!/bin/bash
set -eo pipefail

# TODO: transfer upgrade authority to Threshold Council multisig
solana program set-upgrade-authority -k <current_keypair_path> <programID> --new-upgrade-authority <pubkey>
