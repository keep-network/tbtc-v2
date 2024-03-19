import { BitcoinNetwork, toBitcoinJsLibNetwork, Hex } from "../../src"
import { Transaction, address } from "bitcoinjs-lib"
import { MockContract } from "@ethereum-waffle/mock-contract"
import { assert } from "chai"
import { MockProvider } from "@ethereum-waffle/provider"

/**
 * Represents a structured JSON format for a Bitcoin transaction. It includes
 * detailed information about its inputs and outputs, as well as the transaction
 * itself.
 */
interface TxJSON {
  hash: string
  version: number
  locktime: number
  inputs: {
    hash: string
    index: number
    sequence: number
    script: string
    witness: string[]
  }[]
  outputs: {
    value: number
    script: string
    address: string
  }[]
}

/**
 * Converts a raw Bitcoin transaction into a structured JSON format.
 * @param rawTransaction - A raw Bitcoin transaction in hexadecimal string format.
 * @param bitcoinNetwork - Bitcoin network.
 * @returns A structured JSON object representing the transaction.
 */
export function txToJSON(
  rawTransaction: string,
  bitcoinNetwork: BitcoinNetwork
): TxJSON {
  const transaction = Transaction.fromHex(rawTransaction)
  const network = toBitcoinJsLibNetwork(bitcoinNetwork)

  const txJSON: TxJSON = {
    hash: transaction.getId(),
    version: transaction.version,
    locktime: transaction.locktime,
    inputs: transaction.ins.map((input) => ({
      hash: Hex.from(input.hash).reverse().toString(),
      index: input.index,
      sequence: input.sequence,
      script: input.script.toString("hex"),
      witness: input.witness.map((w) => w.toString("hex")),
    })),
    outputs: transaction.outs.map((output) => ({
      value: output.value,
      script: output.script.toString("hex"),
      address: address.fromOutputScript(output.script, network),
    })),
  }

  return txJSON
}

// eslint-disable-next-line valid-jsdoc
/**
 * Custom assertion used to check whether the given contract function was
 * called with correct parameters. This is a workaround for Waffle's
 * `calledOnContractWith` assertion bug described in the following issue:
 * https://github.com/TrueFiEng/Waffle/issues/468
 * @param contract Contract handle
 * @param functionName Name of the checked function
 * @param parameters Array of function's parameters
 */
export function assertContractCalledWith(
  contract: MockContract,
  functionName: string,
  parameters: any[]
) {
  const functionCallData = contract.interface.encodeFunctionData(
    functionName,
    parameters
  )

  assert(
    (contract.provider as unknown as MockProvider).callHistory.some(
      (call) =>
        call.address === contract.address && call.data === functionCallData
    ),
    "Expected contract function was not called"
  )
}
