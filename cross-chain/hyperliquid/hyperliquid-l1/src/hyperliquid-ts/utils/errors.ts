export class HyperliquidAPIError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'HyperliquidAPIError';
  }
}

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export function handleApiError(error: any): never {
  if (error.response) {
    //The request was made and the server responded with a status code
    //that falls out of the range of 2xx
    throw new HyperliquidAPIError(
      error.response.data.code || error.response.status || 'UNKNOWN_ERROR',
      error.response.data.message || error.response.data || 'An unknown error occurred'
    );
  } else if (error.request) {
    //The request was made but no response was received
    throw new HyperliquidAPIError('NETWORK_ERROR', 'No response received from the server');
  } else {
    //Something happened in setting up the request that triggered an Error
    throw new HyperliquidAPIError('REQUEST_SETUP_ERROR', error.message);
  }
}
