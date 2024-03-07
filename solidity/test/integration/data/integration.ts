/**
 * Wallet public key as uncompressed and un-prefixed public key X and Y
 * coordinates derived from the compressed public key
 * 03989d253b17a6a0f41838b84ff0d20e8898f9d7b1a98f2564da4cc29dcf8581d9
 */
export const walletPublicKey =
  "0x989d253b17a6a0f41838b84ff0d20e8898f9d7b1a98f2564da4cc29dcf8581d9d218b65" +
  "e7d91c752f7b22eaceb771a9af3a6f3d3f010a5d471a1aeef7d7713af"

/**
 * Wallet public key hash calculated as HASH160 of compressed public key
 * 03989d253b17a6a0f41838b84ff0d20e8898f9d7b1a98f2564da4cc29dcf8581d9
 */
export const walletPubKeyHash = "0x8db50eb52063ea9d98b3eac91489a90f738986f6"

/**
 * Data used to indicate that the wallet does not have the main UTXO set
 */
export const NO_MAIN_UTXO = {
  txHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
  txOutputIndex: 0,
  txOutputValue: 0,
}

/**
 * Test data based on a testnet deposit transaction:
 * https://live.blockcypher.com/btc-testnet/tx/c872fb11bbca1241aced71c692e7d0b0cf46aadb390ce66ddfcf5fbd8e5bc26f/
 */
export const revealDepositData = {
  fundingTx: {
    version: "0x01000000",
    inputVector:
      "0x0176f251d17d821b938e39b508cd3e02233d71d9b9bfe387a42a050023d3788edb01" +
      "00000000ffffffff",
    outputVector:
      "0x02a08601000000000022002086a303cdd2e2eab1d1679f1a813835dc5a1b65321077" +
      "cdccaf08f98cbf04ca96ba2c0e0000000000160014e257eccafbc07c381642ce6e7e55" +
      "120fb077fbed",
    locktime: "0x00000000",
  },
  depositor: "0x934B98637cA318a4D6E7CA6ffd1690b8e77df637",
  reveal: {
    fundingOutputIndex: 0,
    blindingFactor: "0xf9f0c90d00039523",
    // HASH160 of 03989d253b17a6a0f41838b84ff0d20e8898f9d7b1a98f2564da4cc29dcf8581d9.
    walletPubKeyHash: "0x8db50eb52063ea9d98b3eac91489a90f738986f6",
    // HASH160 of 0300d6f28a2f6bf9836f57fcda5d284c9a8f849316119779f0d6090830d97763a9.
    refundPubKeyHash: "0xe257eccafbc07c381642ce6e7e55120fb077fbed",
    refundLocktime: "0xe0250162",
    vault: "0x0000000000000000000000000000000000000000",
  },
}

/**
 * Test data based on a deposit sweep transaction:
 * https://live.blockcypher.com/btc-testnet/tx/0aa0af5a6de05a7be990ca47f7a523df872b29a0f3be3d54cd99a6a6d43a1366/
 */
export const depositSweepData = {
  sweepTx: {
    // little endian
    hash: "0x66133ad4a6a699cd543dbef3a0292b87df23a5f747ca90e97b5ae06d5aafa00a",
    version: "0x01000000",
    inputVector:
      "0x016fc25b8ebd5fcfdf6de60c39dbaa46cfb0d0e792c671edac4112cabb11fb72c80" +
      "000000000ffffffff",
    outputVector:
      "0x0160800100000000001600148db50eb52063ea9d98b3eac91489a90f738986f6",
    locktime: "0x00000000",
  },
  sweepProof: {
    merkleProof:
      "0xd2d2ec32d817f4cba2834f129c14cf6a201cc6c7d117e996055ce03d891e6e01fc9" +
      "9387d8210318ea8f0b1fd3b0b873f17098562dc81ca666587bc57fc656ad30f4093b0" +
      "0c6e65abe9603552cd9b0ced0c896574f9ecc01297625d2951951e42ffde1c2fbad8e" +
      "49d263870b9672ff2da607d310717a6e6fe5bc4d5a690da2417e20a39c76cffda21d3" +
      "e0ce36c1b382e92b78cd09b5c63ba1d7b0098d88148190",
    txIndexInBlock: 5,
    bitcoinHeaders:
      "0x00e0ff3f0b7757387203041464703bb7d3ae57954c8a30003efd084eb3000000000" +
      "000006c900bb840b7b4cce593dfff74567d5e933ce5f516359549d52c9c9e968a413d" +
      "4afc8f628886021aff93302f00400020cd4746c5454705245006c0b45be789f6471a8" +
      "e2078bb7fd637020000000000005bbffa9b6298c97ba38ed8dc3bd0391db26925f686" +
      "f43a291e52966b780a387556fc8f628886021acfc87ec900008020ab51d62a13dbd5c" +
      "a691b27ccc0d7e993533e0585ed9ed2a8c2010000000000007c36f5e45f083edc4b8a" +
      "8219453b32900f601d5b5874004e94cfa99de2d6e2e158fc8f628886021a153aef4b0" +
      "0a0c3219db742d6b771cc751b754d91b4979adf02e9515ba7fe263292000000000000" +
      "003a267be82ccf921d65d7ad64bdf94b600de661cb8c5674a4123ef4fdd17b76a2a0f" +
      "c8f628886021a61450f9600006020594a0c528455406b771150750d67cbc1c436386e" +
      "2a02e4d933010000000000007c9ce5d550804761ebbc8d533d10f959eda17dc5497ba" +
      "3dc59eda45c085c005015fd8f628886021a51e22cca00008020f5c97ab8177d24ed69" +
      "c30e5f47a406b2f28bc4c55ecf7c2475010000000000009924355d4ead5123b9182df" +
      "f31c16482081ab751ce4de58ab765513cf1ee30c76ffd8f628886021a9334731a0000" +
      "0020a420df9e874f05566015e8b201a0988280e7affc4f93c2807b020000000000003" +
      "efbfe9eca35bf2be96866779ae9bc3543587879d3b04cba026e3666c6b1e1280ffe8f" +
      "628886021a3482464e",
    coinbasePreimage:
      "0x64dedd90eb72570b8ef3534e5d3e26b3bb0c031f099cd0aa44e1d1543592f2df",
    coinbaseProof:
      "0x29265db8e73c23df4a9233934d6b59cad23f36ac872a41550718a6c88bcef724748" +
      "b71fea5bbc725263b8f2afd29995efb22f11bdf9bdcf1c55fd49d72afbbb71fcde63f" +
      "759b314c4876b6d03865248a29c22ca080fb2b35ff7b088f4a9f22edffde1c2fbad8e" +
      "49d263870b9672ff2da607d310717a6e6fe5bc4d5a690da2417e20a39c76cffda21d3" +
      "e0ce36c1b382e92b78cd09b5c63ba1d7b0098d88148190",
  },
  mainUtxo: NO_MAIN_UTXO,
  chainDifficulty: 6642991,
}

/**
 * Test data based on a testnet redemption transaction:
 * https://live.blockcypher.com/btc-testnet/tx/14b6c9b70530ff0cabd1d28513bf82a7c2781da0ce3bc50df72e2a1b6745e36e/
 */
export const redemptionData = {
  redemptionTx: {
    // little endian
    hash: "0x6ee345671b2a2ef70dc53bcea01d78c2a782bf1385d2d1ab0cff3005b7c9b614",
    version: "0x01000000",
    inputVector:
      "0x0166133ad4a6a699cd543dbef3a0292b87df23a5f747ca90e97b5ae06d5aafa00a00" +
      "00000000ffffffff",
    outputVector:
      "0x02279c00000000000017a91486884e6be1525dab5ae0b451bd2c72cee67dcf418729" +
      "bd0000000000001600148db50eb52063ea9d98b3eac91489a90f738986f6",
    locktime: "0x00000000",
  },
  redemptionProof: {
    merkleProof:
      "0xbbd3856c4905b3ad333b0c983ec8054037f4aee063ebf11e616a5de184ebadcbb89b" +
      "63b065209daf4a02c791569e3b8dd9b757ec3ca0987bb8350c4262a3cd23ac4914f3f6" +
      "3b8662f63c74d4fb45c4d17321b62dfb963be7d86edba9ad0019070462084966bce982" +
      "617181989be75de2a5d979ec5b9e464b965b32b073d9824d",
    txIndexInBlock: 3,
    bitcoinHeaders:
      "0x0020002075c389e96e3f51146e7721971c3475a9c6c34d65f0570c96040100000000" +
      "0000b19c82d8511a85bd8ab761c3247b10359b4808a360f505834814a66ac9bc493532" +
      "d490628886021ae4bc58ab0000e0205ba8b6dbc9549bada90b659462a297769da473b3" +
      "716016c36a02000000000000bb1d2c391a063c6a7033737ef7aa0f527505dc1f1ad5e9" +
      "e3a94dd742bf58b98381d490628886021a2f4bc8dd00200020cda405cc32aab0e33d7d" +
      "44d0bf494288ad77a170ccf98d08820000000000000041e22ae5c9fbee788909afeccd" +
      "d1afa3bf73e559af3fe54e581d12a1bf5a13ff84d490628886021ac33913c200c03f28" +
      "67a0223297ab9988f8b0d0aa1b86dcb9d5148644f8fe7b523501000000000000729c46" +
      "406357331e606a917f5e5bda15f52f279b80deb56ba9a82c5a2533b3e6b7d490628886" +
      "021a76ee51250000262bed6a4dd34cb4f7dbe3d2635a1aeb53ec4a2e66254e060559ba" +
      "010000000000007c91333dcdd3f36fbe2e984105046c4f44eafbbad83d1ed83d62c6c4" +
      "f410b32ec2d490628886021a1bc0509d0000a0207bffc975d2f879018901c33f7c0994" +
      "5b8456b0da414605ca0a00000000000000426a4dbc2b68663d750cf29e57b9e521895e" +
      "ad57f73696be93e08d485e05d36fcfd490628886021a786a19ef008000209d30775f9f" +
      "4f6452fcc83c6a1e54a9010c65b0af1791405989000000000000007b118930c4716d17" +
      "ea8e5322cf029014be251ac968f38d8cdcfdcdf6cff8e4fdeed490628886021ab1663024",
    coinbasePreimage:
      "0xe60591b38934a0f670f234e71d15a26e55b38490f4273c4631cfb4b2fc8ff190",
    coinbaseProof:
      "0x5752f5c6f24dc3ad705305332bb132d756e683ec53f7d565bc81d1887b9d1a31756c" +
      "371cd7a07bd4ae8d81ef77e6c4041e41ee0235cec0c5a378f61a901c39f2ac4914f3f6" +
      "3b8662f63c74d4fb45c4d17321b62dfb963be7d86edba9ad0019070462084966bce982" +
      "617181989be75de2a5d979ec5b9e464b965b32b073d9824d",
  },
}

export const governanceDelay = 604800
export const dkgResultChallengePeriodLength = 100
export const offchainDkgTime = 72
