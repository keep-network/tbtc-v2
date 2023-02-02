import {
  backoffRetrier,
  skipRetryWhenMatched,
  ExecutionLoggerFn,
} from "./backoff"

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
