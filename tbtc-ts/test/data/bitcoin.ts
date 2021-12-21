import { RawTransaction, UnspentTransactionOutput } from "../../src/bitcoin"

/**
 * An example address taken from the BTC testnet and having a non-zero balance.
 * This address and its transaction data can be used to make deposits during tests.
 */
export const testnetAddress = "tb1q0tpdjdu2r3r7tzwlhqy4e2276g2q6fexsz4j0m"

/**
 * Private key corresponding to the testnetAddress.
 */
export const testnetPrivateKey =
  "cRJvyxtoggjAm9A94cB86hZ7Y62z2ei5VNJHLksFi2xdnz1GJ6xt"

/**
 * Hash of one of the transactions originating from testnetAddress.
 */
export const testnetTransactionHash1 =
  "2f952bdc206bf51bb745b967cb7166149becada878d3191ffe341155ebcd4883"

/**
 * Transaction corresponding to testnetTransactionHash1 and originating
 * from testnetAddress. It can be decoded, for example, with:
 * https://live.blockcypher.com/btc-testnet/decodetx
 */
export const testnetTransaction1: RawTransaction = {
  transactionHex:
    "0100000000010162cae24e74ad64f9f0493b09f3964908b3b3038f4924882d3dbd853b" +
    "4c9bc7390100000000ffffffff02102700000000000017a914867120d5480a9cc0c11c" +
    "1193fa59b3a92e852da78710043c00000000001600147ac2d9378a1c47e589dfb8095c" +
    "a95ed2140d272602483045022100b70bd9b7f5d230444a542c7971bea79786b4ebde67" +
    "03cee7b6ee8cd16e115ebf02204d50ea9d1ee08de9741498c2cc64266e40d52c4adb9e" +
    "f68e65aa2727cd4208b5012102ee067a0273f2e3ba88d23140a24fdb290f27bbcd0f94" +
    "117a9c65be3911c5c04e00000000",
}

/**
 * An UTXO with raw transaction data from the
 * 2f952bdc206bf51bb745b967cb7166149becada878d3191ffe341155ebcd4883 transaction.
 */
export const testnetUTXO1: UnspentTransactionOutput = {
  transactionHash: testnetTransactionHash1,
  outputIndex: 1,
  value: 3933200,
}

/**
 * An UTXO with raw transaction data from the
 * 2f952bdc206bf51bb745b967cb7166149becada878d3191ffe341155ebcd4883 transaction.
 */
export const testnetUTXOraw1: UnspentTransactionOutput & RawTransaction = {
  ...testnetUTXO1,
  ...testnetTransaction1,
}

/**
 * Hash of one of the transactions originating from testnetAddress.
 */
export const testnetTransactionHash2 =
  "3dca095a3eb9c4b1312bb47412ded217e2784f24c7db871fe892a5d585df5570"

/**
 * Transaction corresponding to testnetTransactionHash2 and originating
 * from testnetAddress. It can be decoded, for example, with:
 * https://live.blockcypher.com/btc-testnet/decodetx
 */
export const testnetTransaction2: RawTransaction = {
  transactionHex:
    "010000000001010d02f458e75a96e7975956810140729b585a8d90a3082df4b8b2cae2" +
    "c9f8f16a0100000000ffffffff0210270000000000001600144243576fd0f9fde391b8" +
    "ea97d8f669a4b03bcdc0b2893c00000000001600147ac2d9378a1c47e589dfb8095ca9" +
    "5ed2140d27260247304402203008f5e052ee43c37448465904ba4e0cee7455f033b601" +
    "7f903f27d6ebc5c4a9022063c36dfc3c2b3f19f6a4425bc40d8defa8de2392ddbae8f6" +
    "c3af9b5178844e61012102ee067a0273f2e3ba88d23140a24fdb290f27bbcd0f94117a" +
    "9c65be3911c5c04e00000000",
}

/**
 * An UTXO from the
 * 3dca095a3eb9c4b1312bb47412ded217e2784f24c7db871fe892a5d585df5570 transaction.
 */
export const testnetUTXO2: UnspentTransactionOutput = {
  transactionHash: testnetTransactionHash2,
  outputIndex: 1,
  value: 3967410,
}

/**
 * An UTXO with raw transaction data from the
 * 3dca095a3eb9c4b1312bb47412ded217e2784f24c7db871fe892a5d585df5570 transaction.
 */
export const testnetUTXOraw2: UnspentTransactionOutput & RawTransaction = {
  ...testnetUTXO2,
  ...testnetTransaction2,
}

/**
 * Hash of one of the transactions originating from testnetAddress.
 */
export const testnetTransactionHash3 =
  "9b644c73818f0a9403caf028c3c09c9fe8df50c6143c43e7e17ad000576708e8"

/**
 * Transaction corresponding to testnetTransactionHash3 and originating
 * from testnetAddress. It can be decoded, for example, with:
 * https://live.blockcypher.com/btc-testnet/decodetx
 */
export const testnetTransaction3: RawTransaction = {
  transactionHex:
    "010000000001018bff5424def868a1b6ee27159c9cf9cc60aabeb8bf144d1ef98d07c1" +
    "382cda7e0100000000ffffffff0210270000000000001600141a06d653cba0bd76e234" +
    "e8b17a875c159f281fe2fbcc1c00000000001600147ac2d9378a1c47e589dfb8095ca9" +
    "5ed2140d2726024830450221008726838f3d2486f3a7b8d76e2741366e8f435c69143e" +
    "7a378c9f5952fc2f84d702202edb151d111f735cf1c5a4e3eedd210aca07d2014023db" +
    "cfca3e8c80748ea5dc012102ee067a0273f2e3ba88d23140a24fdb290f27bbcd0f9411" +
    "7a9c65be3911c5c04e00000000",
}

/**
 * An UTXO from the
 * 9b644c73818f0a9403caf028c3c09c9fe8df50c6143c43e7e17ad000576708e8 transaction.
 */
export const testnetUTXO3: UnspentTransactionOutput = {
  transactionHash: testnetTransactionHash3,
  outputIndex: 1,
  value: 1887483,
}

/**
 * An UTXO with raw transaction data from the
 * 9b644c73818f0a9403caf028c3c09c9fe8df50c6143c43e7e17ad000576708e8 transaction.
 */
export const testnetUTXOraw3: UnspentTransactionOutput & RawTransaction = {
  ...testnetUTXO3,
  ...testnetTransaction3,
}
