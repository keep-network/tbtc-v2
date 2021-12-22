// @ts-ignore
import bcoin from "bcoin"
// @ts-ignore
import { opcodes } from "bcoin/lib/script/common"
// @ts-ignore
import wif from "wif"
import { BigNumber } from "ethers"
import { randomBytes } from "crypto"
import {
  Client as BitcoinClient,
  isCompressedPublicKey,
  RawTransaction,
  UnspentTransactionOutput,
} from "./bitcoin"

// TODO: Documentation
export interface DepositData {
  ethereumAddress: string
  amount: BigNumber
  refundPublicKey: string
}

// TODO: Documentation
export async function makeDeposit(
  depositData: DepositData,
  depositorPrivateKey: string,
  bitcoinClient: BitcoinClient
): Promise<void> {
  const decodedDepositorPrivateKey = wif.decode(depositorPrivateKey)

  const depositorKeyRing = new bcoin.KeyRing({
    witness: true,
    privateKey: decodedDepositorPrivateKey.privateKey,
    compressed: decodedDepositorPrivateKey.compressed,
  })

  const depositorAddress = depositorKeyRing.getAddress("string")

  const utxos = await bitcoinClient.findAllUnspentTransactionOutputs(
    depositorAddress
  )

  const utxosWithRaw: (UnspentTransactionOutput & RawTransaction)[] = []
  for (const utxo of utxos) {
    const rawTransaction = await bitcoinClient.getRawTransaction(
      utxo.transactionHash
    )

    utxosWithRaw.push({
      ...utxo,
      transactionHex: rawTransaction.transactionHex,
    })
  }

  const rawUnsignedTransaction = await createDepositTransaction(
    depositData,
    utxosWithRaw,
    depositorAddress
  )

  const unsignedTransaction = bcoin.MTX.fromRaw(
    rawUnsignedTransaction.transactionHex,
    "hex"
  )
  const signedTransaction = unsignedTransaction.sign(depositorKeyRing)

  await bitcoinClient.broadcast({
    transactionHex: signedTransaction.toRaw().toString("hex"),
  })
}

// TODO: Documentation
export async function createDepositTransaction(
  depositData: DepositData,
  utxos: (UnspentTransactionOutput & RawTransaction)[],
  changeAddress: string
): Promise<RawTransaction> {
  const inputCoins = utxos.map((utxo) =>
    bcoin.Coin.fromTX(
      bcoin.MTX.fromRaw(utxo.transactionHex, "hex"),
      utxo.outputIndex,
      -1
    )
  )

  // TODO: Fail fast if input coins sum is less than deposit amount.

  const transaction = new bcoin.MTX()

  const rawScript = createDepositScript(depositData)

  transaction.addOutput({
    script: bcoin.Script.fromRaw(rawScript, "hex"),
    value: depositData.amount,
  })

  await transaction.fund(inputCoins, {
    rate: null, // set null explicitly to always use the default value
    changeAddress: changeAddress,
    subtractFee: false, // do not subtract the fee from outputs
  })

  return {
    transactionHex: transaction.toRaw().toString("hex"),
  }
}

// TODO: Documentation
export async function createDepositScript(
  depositData: DepositData
): Promise<string> {
  // Make sure Ethereum address is prefixed since the prefix is removed
  // while constructing the script.
  const ethereumAddress = depositData.ethereumAddress
  if (ethereumAddress.substring(0, 2) !== "0x") {
    throw new Error("Ethereum address must be prefixed with 0x")
  }
  // Blinding factor should be an 8 bytes random number.
  // TODO: Must be unique for given Ethereum address, signing group and refund
  //       public keys. If not, multiple deposits can refer to the same P2SH
  //       address and cause wrong bookkeeping during sweep.
  const blindingFactor = randomBytes(8)

  // Get the active wallet public key and use it as signing group public key.
  const signingGroupPublicKey = await getActiveWalletPublicKey()
  if (!isCompressedPublicKey(signingGroupPublicKey)) {
    throw new Error("Signing group public key must be compressed")
  }

  const refundPublicKey = depositData.refundPublicKey
  if (!isCompressedPublicKey(refundPublicKey)) {
    throw new Error("Refund public key must be compressed")
  }

  // Locktime is an Unix timestamp in seconds, computed as now + 30 days.
  const locktime = BigNumber.from(Math.floor(Date.now() / 1000) + 2592000)

  // All HEXes pushed to the script must be un-prefixed.
  const script = new bcoin.Script()
  script.clear()
  script.pushData(Buffer.from(ethereumAddress.substring(2), "hex"))
  script.pushOp(opcodes.OP_DROP)
  script.pushData(blindingFactor)
  script.pushOp(opcodes.OP_DROP)
  script.pushOp(opcodes.OP_DUP)
  script.pushOp(opcodes.OP_HASH160)
  script.pushData(Buffer.from(signingGroupPublicKey, "hex"))
  script.pushOp(opcodes.OP_EQUAL)
  script.pushOp(opcodes.OP_IF)
  script.pushOp(opcodes.OP_CHECKSIG)
  script.pushOp(opcodes.OP_ELSE)
  script.pushOp(opcodes.OP_DUP)
  script.pushOp(opcodes.OP_HASH160)
  script.pushData(Buffer.from(refundPublicKey, "hex"))
  script.pushOp(opcodes.OP_EQUALVERIFY)
  script.pushData(Buffer.from(locktime.toHexString().substring(2), "hex"))
  script.pushOp(opcodes.OP_CHECKLOCKTIMEVERIFY)
  script.pushOp(opcodes.OP_DROP)
  script.pushOp(opcodes.OP_CHECKSIG)
  script.pushOp(opcodes.OP_ENDIF)
  script.compile()

  return script.toRaw().toString("hex")
}

// TODO: Documentation
export async function createDepositAddress(
  depositData: DepositData,
  network: string
): Promise<string> {
  const rawScript = await createDepositScript(depositData)
  const script = bcoin.Script.fromRaw(rawScript, "hex")
  const address = bcoin.Address.fromScripthash(script.hash160())
  return address.toString(network)
}

// TODO: Implementation and documentation. Dummy key is returned for now,
async function getActiveWalletPublicKey(): Promise<string> {
  return "0222a6145ec68cf6f3e94a17e4ed3ee4e092a8cdc551075b1376054479f65b7480"
}

export async function revealDeposit(): Promise<void> {
  // TODO: Implementation.
}
