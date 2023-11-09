import {
  WalletAPIClient,
  WindowMessageTransport,
} from "@ledgerhq/wallet-api-client"

export const getWindowMessageTransport = () => {
  return new WindowMessageTransport()
}

export const getWalletAPIClient = (
  windowMessageTransport: WindowMessageTransport
) => {
  const walletApiClient = new WalletAPIClient(windowMessageTransport)

  return walletApiClient
}
