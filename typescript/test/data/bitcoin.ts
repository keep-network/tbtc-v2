import { BitcoinNetwork } from "../../src/bitcoin-network"
import { Hex } from "../../src/hex"

export const btcAddresses: Record<
  Exclude<BitcoinNetwork, BitcoinNetwork.Unknown>,
  {
    [addressType: string]: {
      address: string
      redeemerOutputScript: string
      scriptPubKey: Hex
    }
  }
> = {
  testnet: {
    P2PKH: {
      address: "mjc2zGWypwpNyDi4ZxGbBNnUA84bfgiwYc",
      redeemerOutputScript:
        "0x1976a9142cd680318747b720d67bf4246eb7403b476adb3488ac",
      scriptPubKey: Hex.from(
        "76a9142cd680318747b720d67bf4246eb7403b476adb3488ac"
      ),
    },
    P2WPKH: {
      address: "tb1qumuaw3exkxdhtut0u85latkqfz4ylgwstkdzsx",
      redeemerOutputScript: "0x160014e6f9d74726b19b75f16fe1e9feaec048aa4fa1d0",
      scriptPubKey: Hex.from("0014e6f9d74726b19b75f16fe1e9feaec048aa4fa1d0"),
    },
    P2SH: {
      address: "2MsM67NLa71fHvTUBqNENW15P68nHB2vVXb",
      redeemerOutputScript:
        "0x17a914011beb6fb8499e075a57027fb0a58384f2d3f78487",
      scriptPubKey: Hex.from("a914011beb6fb8499e075a57027fb0a58384f2d3f78487"),
    },
    P2WSH: {
      address: "tb1qau95mxzh2249aa3y8exx76ltc2sq0e7kw8hj04936rdcmnynhswqqz02vv",
      redeemerOutputScript:
        "0x220020ef0b4d985752aa5ef6243e4c6f6bebc2a007e7d671ef27d4b1d0db8dcc93bc1c",
      scriptPubKey: Hex.from(
        "0020ef0b4d985752aa5ef6243e4c6f6bebc2a007e7d671ef27d4b1d0db8dcc93bc1c"
      ),
    },
  },
  mainnet: {
    P2PKH: {
      address: "12higDjoCCNXSA95xZMWUdPvXNmkAduhWv",
      redeemerOutputScript:
        "0x1976a91412ab8dc588ca9d5787dde7eb29569da63c3a238c88ac",
      scriptPubKey: Hex.from(
        "76a91412ab8dc588ca9d5787dde7eb29569da63c3a238c88ac"
      ),
    },
    P2WPKH: {
      address: "bc1q34aq5drpuwy3wgl9lhup9892qp6svr8ldzyy7c",
      redeemerOutputScript: "0x1600148d7a0a3461e3891723e5fdf8129caa0075060cff",
      scriptPubKey: Hex.from("00148d7a0a3461e3891723e5fdf8129caa0075060cff"),
    },
    P2SH: {
      address: "342ftSRCvFHfCeFFBuz4xwbeqnDw6BGUey",
      redeemerOutputScript:
        "0x17a91419a7d869032368fd1f1e26e5e73a4ad0e474960e87",
      scriptPubKey: Hex.from("a91419a7d869032368fd1f1e26e5e73a4ad0e474960e87"),
    },
    P2WSH: {
      address: "bc1qeklep85ntjz4605drds6aww9u0qr46qzrv5xswd35uhjuj8ahfcqgf6hak",
      redeemerOutputScript:
        "0x220020cdbf909e935c855d3e8d1b61aeb9c5e3c03ae8021b286839b1a72f2e48fdba70",
      scriptPubKey: Hex.from(
        "0020cdbf909e935c855d3e8d1b61aeb9c5e3c03ae8021b286839b1a72f2e48fdba70"
      ),
    },
  },
}

export const btcAddressFromPublicKey: Record<
  Exclude<BitcoinNetwork, BitcoinNetwork.Unknown>,
  Record<string, { publicKey: Hex; address: string }>
> = {
  testnet: {
    P2PKH: {
      publicKey: Hex.from(
        "0304cc460f320822d17d567a9a1b1039f765ff72512758605b5962226b3d8e5329"
      ),
      address: "msVQ3CCdqffxc5BtxUrtHFPq6CoZSTaJTq",
    },
    P2WPKH: {
      publicKey: Hex.from(
        "0304cc460f320822d17d567a9a1b1039f765ff72512758605b5962226b3d8e5329"
      ),
      address: "tb1qsdtz442y5fmay39rj39vancf7jm0jrf40qkulw",
    },
  },
  mainnet: {
    P2PKH: {
      publicKey: Hex.from(
        "0304cc460f320822d17d567a9a1b1039f765ff72512758605b5962226b3d8e5329"
      ),
      address: "1CySk97f2eEhpxiHEutWTLBWEDCrZDbSCr",
    },
    P2WPKH: {
      publicKey: Hex.from(
        "0304cc460f320822d17d567a9a1b1039f765ff72512758605b5962226b3d8e5329"
      ),
      address: "bc1qsdtz442y5fmay39rj39vancf7jm0jrf49xd0ya",
    },
  },
}

// An arbitrary Bitcoin mainnet transaction:
// https://live.blockcypher.com/btc/tx/bb20b27fef136ab1e5ee866a73bc9b33a038c3e258162e6c03e94f6e22941e0e/
export const mainnetTransaction =
  "010000000001015ee91b1679031bdc5ccd17081e5c017316aca46c619ffb4e26c5b57a13" +
  "2d08a40500000000ffffffff022afbb600000000001976a914ee4b7569e9063064323332" +
  "ad07dd18bc32402a0c88ac758b1b0000000000220020701a8d401c84fb13e6baf169d596" +
  "84e17abd9fa216c8cc5b9fc63d622ff8c58d0400473044022022c7d7546fc0bb96a26c04" +
  "823d97f0aa4bbe5d9af54acc8f4bd898e88b86956002206b126720f42b2f200434c6ae77" +
  "0b78aded9b32da4f020aba37f099d804eab0270147304402202b60c2ef3ba68eb473b655" +
  "64e0fd038884407dc684c98309e3141bb53233dfd7022078d14fb2e433c71c6c62bd2019" +
  "dd83859173a3b6973c62444930c15d86d4bd16016952210375e00eb72e29da82b8936794" +
  "7f29ef34afb75e8654f6ea368e0acdfd92976b7c2103a1b26313f430c4b15bb1fdce6632" +
  "07659d8cac749a0e53d70eff01874496feff2103c96d495bfdd5ba4145e3e046fee45e84" +
  "a8a48ad05bd8dbb395c011a32cf9f88053ae00000000"

// An arbitrary Bitcoin testnet transaction:
// https://live.blockcypher.com/btc-testnet/tx/873effe868161e09ab65e1a23c7cecdc2792995c90ec94973f2fdbc59728ba89/
export const testnetTransaction =
  "010000000130b7aadbdea851c01b01c53947464a0db6ed706af10def69b9b474f542eda5" +
  "c0000000006b4830450221009ab9ba3a4c9d81c4ac4431c05eac57388c8332bb19150792" +
  "6a3424ec697ac23802203369c91742a7d5168ba3af429aed4f2d1022749a4ba5052b172b" +
  "b6776d9a07c1012103548c7fe1d7a66f8e705a4299153b87f4874c80aaed2cf828cd552d" +
  "6975a01b80ffffffff01461f0400000000001976a914819850140920deeacfee3a631938" +
  "07daea8fc5d288ac00000000"
