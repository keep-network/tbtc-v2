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
export async function createDeposit(
  bitcoinClient: BitcoinClient,
  depositorPrivateKey: string,
  depositData: DepositData
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

  const rawUnsignedTransaction = await assembleDepositTransaction(
    utxosWithRaw,
    depositorAddress,
    depositData
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
export async function assembleDepositTransaction(
  utxos: (UnspentTransactionOutput & RawTransaction)[],
  changeAddress: string,
  depositData: DepositData
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

  transaction.addOutput({
    script: {}, // TODO: Construct the script
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

export async function revealDeposit(): Promise<void> {
  // TODO: Implementation.
}
