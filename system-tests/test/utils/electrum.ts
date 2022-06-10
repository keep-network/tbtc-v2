import type { Credentials as ElectrumCredentials } from "@keep-network/tbtc-v2.ts/dist/electrum"

/**
 * Create Electrum credentials by parsing an URL.
 * @param url - URL to be parsed.
 * @returns Electrum credentials object.
 */
// eslint-disable-next-line import/prefer-default-export
export function parseElectrumCredentials(url: string): ElectrumCredentials {
  const urlObj = new URL(url)

  return {
    host: urlObj.hostname,
    port: Number.parseInt(urlObj.port, 10),
    protocol: urlObj.protocol.replace(":", "") as
      | "tcp"
      | "tls"
      | "ssl"
      | "ws"
      | "wss",
  }
}
