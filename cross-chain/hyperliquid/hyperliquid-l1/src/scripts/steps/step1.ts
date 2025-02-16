import { Hyperliquid } from '../../hyperliquid-ts';
import type { RegisterToken } from '../../hyperliquid-ts/types'; // (Optional) for type-safety
import dotenv from 'dotenv';
dotenv.config();

export default async function step1() {
  console.log('Running Step 1...');

  // Read from environment variables or config
  const privateKey = process.env.private_key;
  const walletAddress = process.env.user_address;
  const testnet = false; // or true, depending on your environment
  const vaultAddress = null;

  const sdk = new Hyperliquid({
    privateKey,
    testnet,
    walletAddress,
    vaultAddress,
  });

  await sdk.connect();

  const tokenToRegister: RegisterToken = {
    token: {
      name: "tBTC",
      szDecimals: 13,
      weiDecimals: 18,

    },
    maxGas: 1000000000000,
    fullName: "HyperLiquid tBTC v2",
  };

  try {
    const result = await sdk.exchange.registerToken(tokenToRegister);

    console.log('Token registration result:', result);
  } catch (error) {
    console.error('Error registering token:', error);
  }
}
