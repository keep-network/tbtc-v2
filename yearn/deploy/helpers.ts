import {HardhatRuntimeEnvironment} from "hardhat/types";

function addressFromEnv(
  hre: HardhatRuntimeEnvironment,
  envName: string,
  required = true
): string {
  const address: string = process.env[envName]

  if(hre.helpers.address.isValid(address)) {
    return address
  } else {
    if (required) {
      throw new Error(`environment variable ${envName} must be a valid address`)
    }
  }

  return "0x0000000000000000000000000000000000000000"
}

export {
  addressFromEnv
}