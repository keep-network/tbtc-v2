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
 * @throws An error returned by function execution.
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
      throw err
    }
  })
}
