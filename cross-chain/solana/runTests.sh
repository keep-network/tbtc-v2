#!/bin/bash
rm -rf SolanaTBTC.json
rm -rf SolanaTBTC.so

solang compile -v --target solana SolanaTBTC.sol

yarn test