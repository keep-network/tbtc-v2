import bcoin from "bcoin"
import wif from "wif"
import {
  Client as BitcoinClient,
  RawTransaction,
  UnspentTransactionOutput,
} from "./bitcoin"

// TODO: Documentation
export interface DepositData {
  ethereumAddress: string
  amount: number
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
// TODO: Consider introducing a dedicated return type.
export function createDepositScript(depositData: DepositData): string {
  // TODO: Should eth address be prefixed? Can be important during
  //       script serialization.
  const ethereumAddress = depositData.ethereumAddress
  // TODO: Generate blinding factor. Dummy factor is used so far.
  const blindingFactor = 20
  // TODO: Select active wallet key. Dummy key is used for now.
  const signingGroupPublicKey =
    "0222a6145ec68cf6f3e94a17e4ed3ee4e092a8cdc551075b1376054479f65b7480"
  const refundPublicKey = depositData.refundPublicKey
  const locktime = Math.floor(Date.now() / 1000) + 2592000 // +30 days

  const script = new bcoin.Script()

  script.clear()
  script.pushData(ethereumAddress)
  script.pushOp(bcoin.opcodes.OP_DROP)
  script.pushData(blindingFactor)
  script.pushOp(bcoin.opcodes.OP_DROP)
  script.pushOp(bcoin.opcodes.OP_DUP)
  script.pushOp(bcoin.opcodes.OP_HASH160)
  script.pushData(signingGroupPublicKey)
  script.pushOp(bcoin.opcodes.OP_EQUAL)
  script.pushOp(bcoin.opcodes.OP_IF)
  script.pushOp(bcoin.opcodes.OP_CHECKSIG)
  script.pushOp(bcoin.opcodes.OP_ELSE)
  script.pushOp(bcoin.opcodes.OP_DUP)
  script.pushOp(bcoin.opcodes.OP_HASH160)
  script.pushData(refundPublicKey)
  script.pushOp(bcoin.opcodes.OP_EQUALVERIFY)
  script.pushData(locktime)
  script.pushOp(bcoin.opcodes.OP_CHECKLOCKTIMEVERIFY)
  script.pushOp(bcoin.opcodes.OP_DROP)
  script.pushOp(bcoin.opcodes.OP_CHECKSIG)
  script.pushOp(bcoin.opcodes.OP_ENDIF)

  return script.toRaw("hex")
}

// TODO: Documentation
// TODO: Consider introducing a dedicated return type.
export function createDepositAddress(
  depositData: DepositData,
  network: string
): string {
  const rawScript = createDepositScript(depositData)
  const script = bcoin.Script.fromRaw(rawScript, "hex")
  const address = bcoin.Address.fromScripthash(script.hash160())
  return address.toString(network)
}

export async function revealDeposit(): Promise<void> {
  // TODO: Implementation.
}
