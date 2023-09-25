import { Hex } from "../utils"

/**
 * Bitcoin networks.
 */
export enum BitcoinNetwork {
  /* eslint-disable no-unused-vars */
  /**
   * Unknown network.
   */
  Unknown = "unknown",
  /**
   * Bitcoin Testnet.
   */
  Testnet = "testnet",
  /**
   * Bitcoin Mainnet.
   */
  Mainnet = "mainnet",
  /* eslint-enable no-unused-vars */
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace BitcoinNetwork {
  /**
   * Gets Bitcoin Network type by comparing a provided hash to known
   * {@link https://en.bitcoin.it/wiki/Genesis_block genesis block hashes}.
   * Returns {@link BitcoinNetwork.Unknown}
   * @param hash Hash of a block.
   * @returns Bitcoin Network.
   */
  export function fromGenesisHash(hash: Hex): BitcoinNetwork {
    switch (hash.toString()) {
      case "000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f": {
        return BitcoinNetwork.Mainnet
      }
      case "000000000933ea01ad0ee984209779baaec3ced90fa3f408719526f8d77f4943": {
        return BitcoinNetwork.Testnet
      }
      default: {
        return BitcoinNetwork.Unknown
      }
    }
  }
}

/**
 * Converts enumerated {@link BitcoinNetwork} to a string expected by the
 * {@link https://github.com/keep-network/bcoin/blob/aba6841e43546e8a485e96dc0019d1e788eab2ee/lib/protocol/networks.js#L33| `bcoin` library}
 * @param bitcoinNetwork Bitcoin network.
 * @returns String representing the given network in bcoin library.
 * @throws An error if the network is not supported by bcoin.
 */
export function toBcoinNetwork(bitcoinNetwork: BitcoinNetwork): string {
  switch (bitcoinNetwork) {
    case BitcoinNetwork.Mainnet: {
      return "main"
    }
    case BitcoinNetwork.Testnet: {
      return "testnet"
    }
    default: {
      throw new Error(`network not supported`)
    }
  }
}
