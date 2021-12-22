import { RawTransaction, UnspentTransactionOutput } from "../../src/bitcoin"

/**
 * An example address taken from the BTC testnet and having a non-zero balance.
 */
export const testnetAddress = "mxVFsFW5N4mu1HPkxPttorvocvzeZ7KZyk"

/**
 * Transaction c842fda444ffa2e90fbe652c3bc1797b57cceaf63ed2d432fe53ee06701af028
 * made by testnetAddress. It can be decoded, for example, with:
 * https://live.blockcypher.com/btc-testnet/decodetx
 */
export const testnetTransaction: RawTransaction = {
  transactionHex:
    "0100000001e855ac190e3946a139ad47f8fcdf6ea6dfbc4b0255841d66a591b61bc622" +
    "baaf030000006b483045022100c56843f5e26b1b556313b0897bb6254391946e2bc333" +
    "52a18f220c08699fb61b02203b9e05d0d996e1a1f0edfe2669ce6a1701f14e1e6948e9" +
    "d32ba88d751d51829a0121037435c194e9b01b3d7f7a2802d6684a3af68d05bbf4ec8f" +
    "17021980d777691f1dfdffffff047c15000000000000536a4c5054325b18282567a11e" +
    "ea42b5de940f957fd40d896a226f20705724cc1cddda1b59a9c5003832bff2d69d6763" +
    "cc20b5647076059605ee0c99caa73330615984cf830a0300208b980006002021770009" +
    "2be8230000000000001976a914000000000000000000000000000000000000000088ac" +
    "e8230000000000001976a914000000000000000000000000000000000000000088ac5e" +
    "b76733000000001976a914ba27f99e007c7f605a8305e318c1abde3cd220ac88ac0000" +
    "0000",
}

/**
 * An UTXO from the c842fda444ffa2e90fbe652c3bc1797b57cceaf63ed2d432fe53ee06701af028
 * transaction.
 */
export const testnetUTXO: UnspentTransactionOutput & RawTransaction = {
  transactionHash:
    "c842fda444ffa2e90fbe652c3bc1797b57cceaf63ed2d432fe53ee06701af028",
  outputIndex: 3,
  value: 862435166,
  ...testnetTransaction,
}
