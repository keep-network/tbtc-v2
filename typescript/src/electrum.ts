// @ts-ignore
import bcoin from "bcoin"
import {
  Client as BitcoinClient,
  RawTransaction,
  Transaction,
  TransactionInput,
  TransactionMerkleBranch,
  TransactionOutput,
  UnspentTransactionOutput,
} from "./bitcoin"
// @ts-ignore
import Electrum from "electrum-client-js"
// @ts-ignore
import sha256 from "bcrypto/lib/sha256-browser.js"

/**
 * Represents a set of credentials required to establish an Electrum connection.
 */
export interface Credentials {
  /**
   * Host pointing to the Electrum server.
   */
  host: string
  /**
   * Port the Electrum server listens on.
   */
  port: number
  /**
   * Protocol used by the Electrum server.
   */
  protocol: "tcp" | "tls" | "ssl" | "ws" | "wss"
}

/**
 * Represents an action that makes use of the Electrum connection. An action
 * is supposed to take a proper Electrum connection, do the work, and return
 * a promise holding the outcome of given type.
 */
type Action<T> = (electrum: Electrum) => Promise<T>

/**
 * Electrum-based implementation of the Bitcoin client.
 */
export class Client implements BitcoinClient {
  private credentials: Credentials

  constructor(credentials: Credentials) {
    this.credentials = credentials
  }

  /**
   * Initiates an Electrum connection and uses it to feed the given action.
   * Closes the connection regardless of the action outcome.
   * @param action - Action that makes use of the Electrum connection.
   * @returns Promise holding the outcome.
   */
  private async withElectrum<T>(action: Action<T>): Promise<T> {
    const electrum = new Electrum(
      this.credentials.host,
      this.credentials.port,
      this.credentials.protocol
    )

    try {
      console.log("Connecting to Electrum server...")
      await electrum.connect("tbtc-v2", "1.4.2")
    } catch (error) {
      throw new Error(`Electrum server connection failure: [${error}]`)
    }

    try {
      return await action(electrum)
    } catch (error) {
      throw new Error(`Electrum action failure: [${error}]`)
    } finally {
      console.log("Closing connection to Electrum server...")
      electrum.close()
    }
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {BitcoinClient#findAllUnspentTransactionOutputs}
   */
  findAllUnspentTransactionOutputs(
    address: string
  ): Promise<UnspentTransactionOutput[]> {
    return this.withElectrum<UnspentTransactionOutput[]>(
      async (electrum: Electrum) => {
        const script = bcoin.Script.fromAddress(address).toRaw().toString("hex")

        const unspentTransactions =
          await electrum.blockchain_scripthash_listunspent(
            computeScriptHash(script)
          )

        return unspentTransactions.reverse().map((tx: any) => ({
          transactionHash: tx.tx_hash,
          outputIndex: tx.tx_pos,
          value: tx.value,
        }))
      }
    )
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {BitcoinClient#getTransaction}
   */
  getTransaction(transactionHash: string): Promise<Transaction> {
    return this.withElectrum<Transaction>(async (electrum: Electrum) => {
      const transaction = await electrum.blockchain_transaction_get(
        transactionHash,
        true
      )

      const inputs = transaction.vin.map(
        (input: any): TransactionInput => ({
          transactionHash: input.txid,
          outputIndex: input.vout,
          scriptSig: input.scriptSig,
        })
      )

      const outputs = transaction.vout.map(
        (output: any): TransactionOutput => ({
          outputIndex: output.n,
          // The `output.value` is in BTC so it must be converted to satoshis.
          value: parseFloat(output.value) * 1e8,
          scriptPubKey: output.scriptPubKey,
        })
      )

      return {
        transactionHash: transaction.txid,
        inputs: inputs,
        outputs: outputs,
      }
    })
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {BitcoinClient#getRawTransaction}
   */
  getRawTransaction(transactionHash: string): Promise<RawTransaction> {
    return this.withElectrum<RawTransaction>(async (electrum: Electrum) => {
      const transaction = await electrum.blockchain_transaction_get(
        transactionHash,
        true
      )

      return {
        transactionHex: transaction.hex,
      }
    })
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {BitcoinClient#getTransactionConfirmations}
   */
  getTransactionConfirmations(transactionHash: string): Promise<number> {
    return this.withElectrum<number>(async (electrum: Electrum) => {
      const transaction = await electrum.blockchain_transaction_get(
        transactionHash,
        true
      )

      return transaction.confirmations
    })
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {BitcoinClient#latestBlockHeight}
   */
  latestBlockHeight(): Promise<number> {
    return this.withElectrum<number>(async (electrum: Electrum) => {
      const header = await electrum.blockchain_headers_subscribe()

      return header.height
    })
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {BitcoinClient#getHeadersChain}
   */
  getHeadersChain(blockHeight: number, chainLength: number): Promise<string> {
    return this.withElectrum<string>(async (electrum: Electrum) => {
      const headersChain = await electrum.blockchain_block_headers(
        blockHeight,
        chainLength + 1
      )

      return headersChain.hex
    })
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {BitcoinClient#getTransactionMerkle}
   */
  getTransactionMerkle(
    transactionHash: string,
    blockHeight: number
  ): Promise<TransactionMerkleBranch> {
    return this.withElectrum<TransactionMerkleBranch>(
      async (electrum: Electrum) => {
        const merkle = await electrum.blockchain_transaction_getMerkle(
          transactionHash,
          blockHeight
        )

        return {
          blockHeight: merkle.block_height,
          merkle: merkle.merkle,
          position: merkle.pos,
        }
      }
    )
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {BitcoinClient#broadcast}
   */
  broadcast(transaction: RawTransaction): Promise<void> {
    return this.withElectrum<void>(async (electrum: Electrum) => {
      await electrum.blockchain_transaction_broadcast(
        transaction.transactionHex
      )
    })
  }
}

/**
 * Converts a Bitcoin script to an Electrum script hash. See
 * [Electrum protocol]{@link https://electrumx.readthedocs.io/en/stable/protocol-basics.html#script-hashes}
 * @param script - Bitcoin script as hex string
 * @returns Electrum script hash as a hex string.
 */
function computeScriptHash(script: string): string {
  return sha256.digest(Buffer.from(script, "hex")).reverse().toString("hex")
}
