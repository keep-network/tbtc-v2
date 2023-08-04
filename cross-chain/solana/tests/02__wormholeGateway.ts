import { redeemOnSolana, tryNativeToHexString } from "@certusone/wormhole-sdk";
import { MockEthereumTokenBridge } from "@certusone/wormhole-sdk/lib/cjs/mock";
import * as tokenBridge from "@certusone/wormhole-sdk/lib/cjs/solana/tokenBridge";
import * as coreBridge from "@certusone/wormhole-sdk/lib/cjs/solana/wormhole";
import * as anchor from "@coral-xyz/anchor";
import { AnchorError, Program } from "@coral-xyz/anchor";
import {
  getAccount,
  getAssociatedTokenAddressSync,
  getMint,
} from "@solana/spl-token";
import { expect } from "chai";
import { WormholeGateway } from "../target/types/wormhole_gateway";
import {
  ETHEREUM_TBTC_ADDRESS,
  ETHEREUM_TOKEN_BRIDGE_ADDRESS,
  GUARDIAN_SET_INDEX,
  CORE_BRIDGE_PROGRAM_ID,
  TOKEN_BRIDGE_PROGRAM_ID,
  TBTC_PROGRAM_ID,
  WORMHOLE_GATEWAY_PROGRAM_ID,
  WRAPPED_TBTC_MINT,
  expectIxFail,
  expectIxSuccess,
  generatePayer,
  getOrCreateAta,
  mockSignAndPostVaa,
  preloadWrappedTbtc,
  ethereumGatewaySendTbtc,
  transferLamports,
  getTokenBridgeSequence,
} from "./helpers";
import * as tbtc from "./helpers/tbtc";
import * as wormholeGateway from "./helpers/wormholeGateway";
import { PublicKey } from "@solana/web3.js";

async function setup(
  program: Program<WormholeGateway>,
  authority,
  mintingLimit: bigint
) {
  const custodian = wormholeGateway.getCustodianPDA();
  const tbtcMint = tbtc.getMintPDA();
  const gatewayWrappedTbtcToken = wormholeGateway.getWrappedTbtcTokenPDA();
  const tokenBridgeSender = wormholeGateway.getTokenBridgeSenderPDA();

  await program.methods
    .initialize(new anchor.BN(mintingLimit.toString()))
    .accounts({
      authority: authority.publicKey,
      custodian,
      tbtcMint,
      wrappedTbtcMint: WRAPPED_TBTC_MINT,
      wrappedTbtcToken: gatewayWrappedTbtcToken,
      tokenBridgeSender,
    })
    .rpc();
}

describe("wormhole-gateway", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  // Initialize anchor program.
  const program = anchor.workspace.WormholeGateway as Program<WormholeGateway>;
  const connection = program.provider.connection;

  const custodian = wormholeGateway.getCustodianPDA();
  const tbtcMint = tbtc.getMintPDA();
  const tbtcConfig = tbtc.getConfigPDA();
  const gatewayWrappedTbtcToken = wormholeGateway.getWrappedTbtcTokenPDA();
  const tokenBridgeSender = wormholeGateway.getTokenBridgeSenderPDA();
  const tokenBridgeRedeemer = wormholeGateway.getTokenBridgeRedeemerPDA();

  const authority = (
    (program.provider as anchor.AnchorProvider).wallet as anchor.Wallet
  ).payer;
  const newAuthority = anchor.web3.Keypair.generate();
  const minterKeys = anchor.web3.Keypair.generate();
  const minter2Keys = anchor.web3.Keypair.generate();
  const impostorKeys = anchor.web3.Keypair.generate();
  const guardianKeys = anchor.web3.Keypair.generate();
  const guardian2Keys = anchor.web3.Keypair.generate();

  const recipientKeys = anchor.web3.Keypair.generate();

  const commonTokenOwner = anchor.web3.Keypair.generate();

  // Mock foreign emitter.
  const ethereumTokenBridge = new MockEthereumTokenBridge(
    ETHEREUM_TOKEN_BRIDGE_ADDRESS
  );

  describe("setup", () => {
      it("initialize", async () => {
      // Max amount of TBTC that can be minted.
      const mintingLimit = BigInt(10000);

      // Initialize the program.
      await setup(program, authority, mintingLimit);
      await wormholeGateway.checkState(authority.publicKey, mintingLimit);
      await tbtc.checkConfig({
        authority: authority.publicKey,
        numMinters: 0,
        numGuardians: 0,
        supply: BigInt(2000),
        paused: false,
        pendingAuthority: null,
      });

      // Also set up common token account.
      await transferLamports(authority, commonTokenOwner.publicKey, 100000000000);
      await getOrCreateAta(
        authority,
        tbtc.getMintPDA(),
        commonTokenOwner.publicKey
      );

      // Give the impostor some lamports.
      await transferLamports(authority, impostorKeys.publicKey, 100000000000);
    });
  }); 

  describe("minting limit", () => { 
    it("update minting limit", async () => {
      // Update minting limit as authority.
      const newLimit = BigInt(20000);
      const ix = await wormholeGateway.updateMintingLimitIx(
        {
          authority: authority.publicKey,
        },
        newLimit
      );
      await expectIxSuccess([ix], [authority]);
      await wormholeGateway.checkState(authority.publicKey, newLimit); 
    });

    it("cannot update minting limit (not authority)", async () => {
      // Only the authority can update the minting limit.
      const newLimit = BigInt(69000);
      const failingIx = await wormholeGateway.updateMintingLimitIx(
        {
          authority: impostorKeys.publicKey,
        },
        newLimit
      );
      await expectIxFail([failingIx], [impostorKeys], "IsNotAuthority");
    });
  });

  describe("gateway address", () => {
    const chain = 2;

    it("gateway does not exist", async () => {
      // demonstrate gateway address does not exist
      const gatewayInfo = await connection.getAccountInfo(
        wormholeGateway.getGatewayInfoPDA(chain)
      );
      expect(gatewayInfo).is.null;
    });

    it("set initial gateway address", async () => {
       // Make new gateway.
      const firstAddress = Array.from(Buffer.alloc(32, "deadbeef", "hex"));
      const firstIx = await wormholeGateway.updateGatewayAddress(
        {
          authority: authority.publicKey,
        },
        { chain, address: firstAddress }
      );
      await expectIxSuccess([firstIx], [authority]);
      await wormholeGateway.checkGateway(chain, firstAddress);
    });

    it("update gateway address", async () => {
      // Update gateway.
      const goodAddress = Array.from(ethereumTokenBridge.address);
      const secondIx = await wormholeGateway.updateGatewayAddress(
        {
          authority: authority.publicKey,
        },
        { chain, address: goodAddress }
      );
      await expectIxSuccess([secondIx], [authority]);
      await wormholeGateway.checkGateway(chain, goodAddress);
    });
  }); 

  describe("other", () => {
    it("deposit wrapped tokens", async () => {
      // Set up new wallet
      const payer = await generatePayer(authority);

      // Check wrapped tBTC mint.
      const recipientWrappedToken = await preloadWrappedTbtc(
        payer,
        ethereumTokenBridge,
        BigInt("100000000000"),
        payer.publicKey
      );

      const recipientToken = await getOrCreateAta(
        payer,
        tbtcMint,
        payer.publicKey
      );

      const depositAmount = BigInt(500);

      // Attempt to deposit before the custodian is a minter.
      const ix = await wormholeGateway.depositWormholeTbtcIx(
        {
          recipientWrappedToken,
          recipientToken,
          recipient: payer.publicKey,
        },
        depositAmount
      );
      await expectIxFail([ix], [payer], "AccountNotInitialized");

      // Add custodian as minter.
      const addMinterIx = await tbtc.addMinterIx({
        authority: authority.publicKey,
        minter: custodian,
      });
      await expectIxSuccess([addMinterIx], [authority]);
      await tbtc.checkConfig({
        authority: authority.publicKey,
        numMinters: 1,
        numGuardians: 0,
        supply: BigInt(2000),
        paused: false,
        pendingAuthority: null,
      });

      // Check token account balances before deposit.
      const [wrappedBefore, tbtcBefore, gatewayBefore] = await Promise.all([
        getAccount(connection, recipientWrappedToken),
        getAccount(connection, recipientToken),
        getAccount(connection, gatewayWrappedTbtcToken),
      ]);

      await expectIxSuccess([ix], [payer]);
      await tbtc.checkConfig({
        authority: authority.publicKey,
        numMinters: 1,
        numGuardians: 0,
        supply: BigInt(2500),
        paused: false,
        pendingAuthority: null,
      });

      const [wrappedAfter, tbtcAfter, gatewayAfter] = await Promise.all([
        getAccount(connection, recipientWrappedToken),
        getAccount(connection, recipientToken),
        getAccount(connection, gatewayWrappedTbtcToken),
      ]);

      // Check balance change.
      expect(wrappedAfter.amount).to.equal(wrappedBefore.amount - depositAmount);
      expect(tbtcAfter.amount).to.equal(tbtcBefore.amount + depositAmount);
      expect(gatewayAfter.amount).to.equal(gatewayBefore.amount + depositAmount);

      // Cannot deposit past minting limit.
      const failingIx = await wormholeGateway.depositWormholeTbtcIx(
        {
          recipientWrappedToken,
          recipientToken,
          recipient: payer.publicKey,
        },
        BigInt(50000)
      );
      await expectIxFail([failingIx], [payer], "MintingLimitExceeded");

      // Will succeed if minting limit is increased.
      const newLimit = BigInt(70000);
      const updateLimitIx = await wormholeGateway.updateMintingLimitIx(
        {
          authority: authority.publicKey,
        },
        newLimit
      );
      await expectIxSuccess([updateLimitIx], [authority]);
      await wormholeGateway.checkState(authority.publicKey, newLimit);
      await expectIxSuccess([failingIx], [payer]);
    }); 

    it("receive tbtc", async () => {
      // Set up new wallet
      const payer = await generatePayer(authority);

      // Use common token account.
      const recipient = commonTokenOwner.publicKey;
      const recipientToken = getAssociatedTokenAddressSync(
        tbtc.getMintPDA(),
        recipient
      );

      // Get foreign gateway.
      const fromGateway = await wormholeGateway
        .getGatewayInfo(2)
        .then((info) => info.address);

      const sentAmount = BigInt(5000);
      const signedVaa = await ethereumGatewaySendTbtc(
        payer,
        ethereumTokenBridge,
        sentAmount,
        fromGateway,
        WORMHOLE_GATEWAY_PROGRAM_ID,
        recipient
      );

      const [tbtcBefore, gatewayBefore] = await Promise.all([
        getAccount(connection, recipientToken),
        getAccount(connection, gatewayWrappedTbtcToken),
      ]);

      const ix = await wormholeGateway.receiveTbtcIx(
        {
          payer: payer.publicKey,
          recipientToken,
          recipient,
        },
        signedVaa
      );
      await expectIxSuccess([ix], [payer]);

      const [tbtcAfter, gatewayAfter] = await Promise.all([
        getAccount(connection, recipientToken),
        getAccount(connection, gatewayWrappedTbtcToken),
      ]);

      // Check balance change.
      expect(tbtcAfter.amount).to.equal(tbtcBefore.amount + sentAmount);
      expect(gatewayAfter.amount).to.equal(gatewayBefore.amount + sentAmount);

      // Cannot receive tbtc again.
      await expectIxFail([ix], [payer], "TransferAlreadyRedeemed");
    });

    it("receive wrapped tbtc (ata doesn't exist)", async () => {
      // Set up new wallet
      const payer = await generatePayer(authority);

      // Use common token account.
      const recipient = commonTokenOwner.publicKey;
      const recipientToken = getAssociatedTokenAddressSync(
        tbtc.getMintPDA(),
        recipient
      );
      const recipientWrappedToken = getAssociatedTokenAddressSync(
        WRAPPED_TBTC_MINT,
        recipient
      );

      // Verify that the wrapped token account doesn't exist yet.
      try {
        await getAccount(connection, recipientWrappedToken);
      } catch (e: any) {
        expect(e.toString()).to.equal("TokenAccountNotFoundError");
      }

      // Get foreign gateway.
      const fromGateway = await wormholeGateway
        .getGatewayInfo(2)
        .then((info) => info.address);

      // Create transfer VAA.
      const sentAmount = BigInt(5000);
      const signedVaa = await ethereumGatewaySendTbtc(
        payer,
        ethereumTokenBridge,
        sentAmount,
        fromGateway,
        WORMHOLE_GATEWAY_PROGRAM_ID,
        recipient
      );

      // Set the mint limit to a value smaller than sentAmount.
      const newLimit = sentAmount - BigInt(69);
      const updateLimitIx = await wormholeGateway.updateMintingLimitIx(
        {
          authority: authority.publicKey,
        },
        newLimit
      );
      await expectIxSuccess([updateLimitIx], [authority]);
      await wormholeGateway.checkState(authority.publicKey, newLimit);

      // Balance check before receiving wrapped tbtc. We can't
      // check the balance of the recipient's wrapped tbtc yet,
      // since the contract will create the ATA.
      const [tbtcBefore, gatewayBefore] = await Promise.all([
        getAccount(connection, recipientToken),
        getAccount(connection, gatewayWrappedTbtcToken),
      ]);

      const ix = await wormholeGateway.receiveTbtcIx(
        {
          payer: payer.publicKey,
          recipientToken,
          recipient,
        },
        signedVaa
      );
      await expectIxSuccess([ix], [payer]);

      // Check token accounts after receiving wrapped tbtc. We should
      // be able to fetch the recipient's wrapped tbtc now.
      const [tbtcAfter, wrappedTbtcAfter, gatewayAfter] = await Promise.all([
        getAccount(connection, recipientToken),
        getAccount(connection, recipientWrappedToken),
        getAccount(connection, gatewayWrappedTbtcToken),
      ]);

      // Check balance change.
      expect(tbtcAfter.amount).to.equal(tbtcBefore.amount);
      expect(gatewayAfter.amount).to.equal(gatewayBefore.amount);
      expect(wrappedTbtcAfter.amount).to.equal(sentAmount);
    });

    it("receive wrapped tbtc (ata exists)", async () => {
      // Set up new wallet
      const payer = await generatePayer(authority);

      // Use common token account.
      const recipient = commonTokenOwner.publicKey;
      const recipientToken = getAssociatedTokenAddressSync(
        tbtc.getMintPDA(),
        recipient
      );
      const recipientWrappedToken = await getOrCreateAta(
        payer,
        WRAPPED_TBTC_MINT,
        recipient
      );

      // Get foreign gateway.
      const fromGateway = await wormholeGateway
        .getGatewayInfo(2)
        .then((info) => info.address);

      // Create transfer VAA.
      const sentAmount = BigInt(5000);
      const signedVaa = await ethereumGatewaySendTbtc(
        payer,
        ethereumTokenBridge,
        sentAmount,
        fromGateway,
        WORMHOLE_GATEWAY_PROGRAM_ID,
        recipient
      );

      // Set the mint limit to a value smaller than sentAmount.
      const newLimit = sentAmount - BigInt(69);
      const updateLimitIx = await wormholeGateway.updateMintingLimitIx(
        {
          authority: authority.publicKey,
        },
        newLimit
      );
      await expectIxSuccess([updateLimitIx], [authority]);
      await wormholeGateway.checkState(authority.publicKey, newLimit);

      // Balance check before receiving wrapped tbtc. If this
      // line successfully executes, then the recipient's
      // wrapped tbtc account already exists.
      const [tbtcBefore, wrappedTbtcBefore, gatewayBefore] = await Promise.all([
        getAccount(connection, recipientToken),
        getAccount(connection, recipientWrappedToken),
        getAccount(connection, gatewayWrappedTbtcToken),
      ]);

      const ix = await wormholeGateway.receiveTbtcIx(
        {
          payer: payer.publicKey,
          recipientToken,
          recipient,
        },
        signedVaa
      );
      await expectIxSuccess([ix], [payer]);

      // Check token accounts after receiving wrapped tbtc.
      const [tbtcAfter, wrappedTbtcAfter, gatewayAfter] = await Promise.all([
        getAccount(connection, recipientToken),
        getAccount(connection, recipientWrappedToken),
        getAccount(connection, gatewayWrappedTbtcToken),
      ]);

      // Check balance change.
      expect(tbtcAfter.amount).to.equal(tbtcBefore.amount);
      expect(gatewayAfter.amount).to.equal(gatewayBefore.amount);
      expect(wrappedTbtcAfter.amount).to.equal(
        wrappedTbtcBefore.amount + sentAmount
      );
    });

    it("cannot receive non-tbtc transfers", async () => {
      // Set up new wallet
      const payer = await generatePayer(authority);

      // Use common token account.
      const recipient = commonTokenOwner.publicKey;
      const recipientToken = getAssociatedTokenAddressSync(
        tbtc.getMintPDA(),
        recipient
      );

      // Get foreign gateway.
      const fromGateway = await wormholeGateway
        .getGatewayInfo(2)
        .then((info) => info.address);

      const sentAmount = BigInt(5000);
      const signedVaa = await ethereumGatewaySendTbtc(
        payer,
        ethereumTokenBridge,
        sentAmount,
        fromGateway,
        WORMHOLE_GATEWAY_PROGRAM_ID,
        recipient,
        "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH address
        69 // hehe
      );

      const failingIx = await wormholeGateway.receiveTbtcIx(
        {
          payer: payer.publicKey,
          recipientToken,
          recipient,
        },
        signedVaa
      );
      await expectIxFail([failingIx], [payer], "InvalidEthereumTbtc");
    });

    it("cannot receive zero-amount tbtc transfers", async () => {
      // Set up new wallet
      const payer = await generatePayer(authority);

      // Use common token account.
      const recipient = commonTokenOwner.publicKey;
      const recipientToken = getAssociatedTokenAddressSync(
        tbtc.getMintPDA(),
        recipient
      );

      // Get foreign gateway.
      const fromGateway = await wormholeGateway
        .getGatewayInfo(2)
        .then((info) => info.address);

      const sentAmount = BigInt(0);
      const signedVaa = await ethereumGatewaySendTbtc(
        payer,
        ethereumTokenBridge,
        sentAmount,
        fromGateway,
        WORMHOLE_GATEWAY_PROGRAM_ID,
        recipient
      );

      const failingIx = await wormholeGateway.receiveTbtcIx(
        {
          payer: payer.publicKey,
          recipientToken,
          recipient,
        },
        signedVaa
      );
      await expectIxFail([failingIx], [payer], "NoTbtcTransferred");
    });

    it("cannot receive tbtc transfer with zero address as recipient", async () => {
      // Set up new wallet
      const payer = await generatePayer(authority);

      // Use common token account. Set the recipient to the zero address.
      const recipient = PublicKey.default;
      const defaultTokenAccount = await getOrCreateAta(
        payer,
        tbtc.getMintPDA(),
        recipient
      );

      // Get foreign gateway.
      const fromGateway = await wormholeGateway
        .getGatewayInfo(2)
        .then((info) => info.address);

      const sentAmount = BigInt(100);
      const signedVaa = await ethereumGatewaySendTbtc(
        payer,
        ethereumTokenBridge,
        sentAmount,
        fromGateway,
        WORMHOLE_GATEWAY_PROGRAM_ID,
        recipient
      );

      const failingIx = await wormholeGateway.receiveTbtcIx(
        {
          payer: payer.publicKey,
          recipientToken: defaultTokenAccount,
          recipient,
        },
        signedVaa
      );
      await expectIxFail([failingIx], [payer], "RecipientZeroAddress");
    });

    it("send tbtc to gateway", async () => {
      // Use common token account.
      const sender = commonTokenOwner.publicKey;
      const senderToken = getAssociatedTokenAddressSync(
        tbtc.getMintPDA(),
        sender
      );

      // Check token accounts.
      const [senderTbtcBefore, gatewayBefore] = await Promise.all([
        getAccount(connection, senderToken),
        getAccount(connection, gatewayWrappedTbtcToken),
      ]);

      // Get destination gateway.
      const recipientChain = 2;
      const recipient = Array.from(Buffer.alloc(32, "deadbeef", "hex"));
      const nonce = 420;

      // This should work.
      const sendAmount = BigInt(2000);
      const ix = await wormholeGateway.sendTbtcGatewayIx(
        {
          senderToken,
          sender,
        },
        {
          amount: new anchor.BN(sendAmount.toString()),
          recipientChain,
          recipient,
          nonce,
        }
      );
      await expectIxSuccess([ix], [commonTokenOwner]);

      // Check token accounts after sending tbtc.
      const [senderTbtcAfter, gatewayAfter] = await Promise.all([
        getAccount(connection, senderToken),
        getAccount(connection, gatewayWrappedTbtcToken),
      ]);

      // Check balance change.
      expect(senderTbtcAfter.amount).to.equal(
        senderTbtcBefore.amount - sendAmount
      );
      expect(gatewayAfter.amount).to.equal(gatewayBefore.amount - sendAmount);
    });

    it("cannot send tbtc to gateway (insufficient wrapped balance)", async () => {
      // Use common token account.
      const sender = commonTokenOwner.publicKey;
      const senderToken = getAssociatedTokenAddressSync(
        tbtc.getMintPDA(),
        sender
      );

      // Get destination gateway.
      const recipientChain = 2;
      const recipient = Array.from(Buffer.alloc(32, "deadbeef", "hex"));
      const nonce = 420;

      // Check token accounts.
      const gatewayWrappedBalance = await getAccount(
        connection,
        gatewayWrappedTbtcToken
      );

      // Try an amount that won't work.
      const sendAmount = gatewayWrappedBalance.amount + BigInt(69);
      const ix = await wormholeGateway.sendTbtcGatewayIx(
        {
          senderToken,
          sender,
        },
        {
          amount: new anchor.BN(sendAmount.toString()),
          recipientChain,
          recipient,
          nonce,
        }
      );
      await expectIxFail([ix], [commonTokenOwner], "NotEnoughWrappedTbtc");
    });

    it("cannot send tbtc to gateway (zero amount)", async () => {
      // Use common token account.
      const sender = commonTokenOwner.publicKey;
      const senderToken = getAssociatedTokenAddressSync(
        tbtc.getMintPDA(),
        sender
      );

      // Get destination gateway.
      const recipientChain = 2;
      const recipient = Array.from(Buffer.alloc(32, "deadbeef", "hex"));
      const nonce = 420;

      // Try an amount that won't work.
      const sendAmount = BigInt(0);
      const ix = await wormholeGateway.sendTbtcGatewayIx(
        {
          senderToken,
          sender,
        },
        {
          amount: new anchor.BN(sendAmount.toString()),
          recipientChain,
          recipient,
          nonce,
        }
      );
      await expectIxFail([ix], [commonTokenOwner], "ZeroAmount");
    });

    it("cannot send tbtc to gateway (recipient is zero address)", async () => {
      // Use common token account.
      const sender = commonTokenOwner.publicKey;
      const senderToken = getAssociatedTokenAddressSync(
        tbtc.getMintPDA(),
        sender
      );

      // Get destination gateway.
      const recipientChain = 2;
      const recipient = Array.from(Buffer.alloc(32)); // empty buffer
      const nonce = 420;

      const sendAmount = BigInt(69);
      const ix = await wormholeGateway.sendTbtcGatewayIx(
        {
          senderToken,
          sender,
        },
        {
          amount: new anchor.BN(sendAmount.toString()),
          recipientChain,
          recipient,
          nonce,
        }
      );
      await expectIxFail([ix], [commonTokenOwner], "ZeroRecipient");
    });

    it("cannot send tbtc to gateway (invalid target gateway)", async () => {
      // Use common token account.
      const sender = commonTokenOwner.publicKey;
      const senderToken = getAssociatedTokenAddressSync(
        tbtc.getMintPDA(),
        sender
      );

      // Get destination gateway.
      const recipientChain = 69; // bad gateway
      const recipient = Array.from(Buffer.alloc(32)); // empty buffer
      const nonce = 420;

      const sendAmount = BigInt(69);
      const ix = await wormholeGateway.sendTbtcGatewayIx(
        {
          senderToken,
          sender,
        },
        {
          amount: new anchor.BN(sendAmount.toString()),
          recipientChain,
          recipient,
          nonce,
        }
      );
      await expectIxFail([ix], [commonTokenOwner], "AccountNotInitialized");
    });

    it("send wrapped tbtc", async () => {
      // Use common token account.
      const sender = commonTokenOwner.publicKey;
      const senderToken = getAssociatedTokenAddressSync(
        tbtc.getMintPDA(),
        sender
      );

      // Check token accounts.
      const [senderTbtcBefore, gatewayBefore] = await Promise.all([
        getAccount(connection, senderToken),
        getAccount(connection, gatewayWrappedTbtcToken),
      ]);

      // Get destination gateway.
      const recipientChain = 69;
      const recipient = Array.from(Buffer.alloc(32, "deadbeef", "hex"));
      const nonce = 420;

      // This should work.
      const sendAmount = BigInt(2000);
      const ix = await wormholeGateway.sendTbtcWrappedIx(
        {
          senderToken,
          sender,
        },
        {
          amount: new anchor.BN(sendAmount.toString()),
          recipientChain,
          recipient,
          arbiterFee: new anchor.BN(0),
          nonce,
        }
      );
      await expectIxSuccess([ix], [commonTokenOwner]);

      // Check token accounts after sending tbtc.
      const [senderTbtcAfter, gatewayAfter] = await Promise.all([
        getAccount(connection, senderToken),
        getAccount(connection, gatewayWrappedTbtcToken),
      ]);

      // Check balance change.
      expect(senderTbtcAfter.amount).to.equal(
        senderTbtcBefore.amount - sendAmount
      );
      expect(gatewayAfter.amount).to.equal(gatewayBefore.amount - sendAmount);
    });

    it("cannot send wrapped tbtc (insufficient wrapped balance)", async () => {
      // Use common token account.
      const sender = commonTokenOwner.publicKey;
      const senderToken = getAssociatedTokenAddressSync(
        tbtc.getMintPDA(),
        sender
      );

      // Get destination gateway.
      const recipientChain = 2;
      const recipient = Array.from(Buffer.alloc(32, "deadbeef", "hex"));
      const nonce = 420;

      // Check token accounts.
      const gatewayWrappedBalance = await getAccount(
        connection,
        gatewayWrappedTbtcToken
      );

      // Try an amount that won't work.
      const sendAmount = gatewayWrappedBalance.amount + BigInt(69);
      const ix = await wormholeGateway.sendTbtcWrappedIx(
        {
          senderToken,
          sender,
        },
        {
          amount: new anchor.BN(sendAmount.toString()),
          recipientChain,
          recipient,
          arbiterFee: new anchor.BN(0),
          nonce,
        }
      );
      await expectIxFail([ix], [commonTokenOwner], "NotEnoughWrappedTbtc");
    });

    it("cannot send wrapped tbtc(zero amount)", async () => {
      // Use common token account.
      const sender = commonTokenOwner.publicKey;
      const senderToken = getAssociatedTokenAddressSync(
        tbtc.getMintPDA(),
        sender
      );

      // Get destination gateway.
      const recipientChain = 2;
      const recipient = Array.from(Buffer.alloc(32, "deadbeef", "hex"));
      const nonce = 420;

      // Try an amount that won't work.
      const sendAmount = BigInt(0);
      const ix = await wormholeGateway.sendTbtcWrappedIx(
        {
          senderToken,
          sender,
        },
        {
          amount: new anchor.BN(sendAmount.toString()),
          recipientChain,
          recipient,
          arbiterFee: new anchor.BN(0),
          nonce,
        }
      );
      await expectIxFail([ix], [commonTokenOwner], "ZeroAmount");
    });

    it("cannot send wrapped tbtc (recipient is zero address)", async () => {
      // Use common token account.
      const sender = commonTokenOwner.publicKey;
      const senderToken = getAssociatedTokenAddressSync(
        tbtc.getMintPDA(),
        sender
      );

      // Get destination gateway.
      const recipientChain = 2;
      const recipient = Array.from(Buffer.alloc(32)); // empty buffer
      const nonce = 420;

      const sendAmount = BigInt(69);
      const ix = await wormholeGateway.sendTbtcWrappedIx(
        {
          senderToken,
          sender,
        },
        {
          amount: new anchor.BN(sendAmount.toString()),
          recipientChain,
          recipient,
          arbiterFee: new anchor.BN(0),
          nonce,
        }
      );
      await expectIxFail([ix], [commonTokenOwner], "ZeroRecipient");
    });
  });
});
