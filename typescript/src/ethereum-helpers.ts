import {
  Contract as EthersContract,
  Event as EthersEvent,
  EventFilter as EthersEventFilter,
} from "ethers"
import {
  backoffRetrier,
  skipRetryWhenMatched,
  ExecutionLoggerFn,
} from "./backoff"

const GET_EVENTS_BLOCK_INTERVAL = 10_000

/**
 * Sends ethereum transaction with retries.
 * @param fn Function to execute with retries.
 * @param retries The number of retries to perform before bubbling the failure out.
 * @param logger A logger function to pass execution messages.
 * @param nonRetryableErrors List of error messages that if returned from executed
 *        function, should break the retry loop and return immediately.
 * @returns Result of function execution.
 * @throws An error returned by function execution. An error thrown by the executed
 *         function is processed by {@link resolveEthersError} function to resolve
 *         the revert message in case of a transaction revert.
 */
export async function sendWithRetry<T>(
  fn: () => Promise<T>,
  retries: number,
  logger?: ExecutionLoggerFn,
  nonRetryableErrors?: Array<string | RegExp>
): Promise<T> {
  return backoffRetrier<T>(
    retries,
    1000,
    logger,
    nonRetryableErrors ? skipRetryWhenMatched(nonRetryableErrors) : undefined
  )(async () => {
    try {
      return await fn()
    } catch (err: unknown) {
      throw resolveEthersError(err)
    }
  })
}

/**
 * Represents an interface that matches the errors structure thrown by ethers library.
 * {@see {@link https://github.com/ethers-io/ethers.js/blob/c80fcddf50a9023486e9f9acb1848aba4c19f7b6/packages/logger/src.ts/index.ts#L268-L277 ethers source code}}
 */
interface EthersError extends Error {
  reason: string
  code: string
  error: unknown
}

/**
 * Takes an error and tries to resolve a revert message if the error is related
 * to reverted transaction.
 * @param err Error to process.
 * @returns Error with a revert message or the input error when the error could
 *          not be resolved successfully.
 */
function resolveEthersError(err: unknown): unknown {
  const isEthersError = (obj: any): obj is EthersError => {
    return "reason" in obj && "code" in obj && "error" in obj
  }

  if (isEthersError(err) && err !== null) {
    // Ethers errors are nested. The parent UNPREDICTABLE_GAS_LIMIT has a general
    // reason "cannot estimate gas; transaction may fail or may require manual gas limit",
    if (err.code === "UNPREDICTABLE_GAS_LIMIT") {
      if (typeof isEthersError(err["error"]) && err["error"] !== null) {
        // The nested error is expected to contain a reason property with a message
        // of the transaction revert.
        return new Error((err["error"] as EthersError).reason)
      }
    }
  }

  return err
}

/**
 * Looks up all existing events defined by the {@link event} filter on
 * {@link sourceContract}, searching past blocks and then returning them.
 * Does not wait for any new events. It starts searching from provided block number.
 * If the {@link fromBlock} is missing it starts searching from block `0`.
 * It pulls events in one `getLogs` call. If the call fails it fallbacks to querying
 * events in batches of {@link batchedQueryBlockInterval} blocks. If the parameter
 * is not set it queries in {@link GET_EVENTS_BLOCK_INTERVAL} blocks batches.
 * @param sourceContract The contract instance that emits the event.
 * @param event The event filter to query.
 * @param fromBlock Starting block for events search.
 * @param toBlock Ending block for events search.
 * @param batchedQueryBlockInterval Block interval for batched events pulls.
 * @param logger A logger function to pass execution messages.
 * @returns A promise that will be fulfilled by the list of event objects once
 *          they are found.
 */
export async function getEvents(
  sourceContract: EthersContract,
  event: EthersEventFilter,
  fromBlock: number = 0,
  toBlock: number | string = "latest",
  batchedQueryBlockInterval: number = GET_EVENTS_BLOCK_INTERVAL,
  logger: ExecutionLoggerFn = console.debug
): Promise<EthersEvent[]> {
  return new Promise(async (resolve, reject) => {
    let resultEvents: EthersEvent[] = []
    try {
      resultEvents = await sourceContract.queryFilter(event, fromBlock, toBlock)
    } catch (err) {
      logger(
        `switching to partial events pulls; ` +
          `failed to get events in one request from contract: [${event.address}], ` +
          `fromBlock: [${fromBlock}], toBlock: [${toBlock}]: [${err}]`
      )

      try {
        if (typeof toBlock === "string") {
          toBlock = (await sourceContract.provider.getBlock(toBlock)).number
        }

        let batchStartBlock = fromBlock

        while (batchStartBlock <= toBlock) {
          let batchEndBlock = batchStartBlock + batchedQueryBlockInterval
          if (batchEndBlock > toBlock) {
            batchEndBlock = toBlock
          }
          logger(
            `executing partial events pull from contract: [${event.address}], ` +
              `fromBlock: [${batchStartBlock}], toBlock: [${batchEndBlock}]`
          )
          const foundEvents = await sourceContract.queryFilter(
            event,
            batchStartBlock,
            batchEndBlock
          )

          resultEvents = resultEvents.concat(foundEvents)
          logger(
            `fetched [${foundEvents.length}] events, has ` +
              `[${resultEvents.length}] total`
          )

          batchStartBlock = batchEndBlock + 1
        }
      } catch (error) {
        return reject(error)
      }
    }

    return resolve(resultEvents)
  })
}
