import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorError } from "@coral-xyz/anchor";
import * as spl from "@solana/spl-token";
import * as web3 from '@solana/web3.js';
import { SolanaTbtcAnchor } from "../target/types/solana_tbtc_anchor";
import { expect } from 'chai';

async function setup(
  program: Program<SolanaTbtcAnchor>,
  tbtc,
  creator
) {
  const [tbtcMintPDA, _] = getTokenPDA(program, tbtc);
  
  await program.methods
    .initialize()
    .accounts({
      tbtcMint: tbtcMintPDA,
      tbtc: tbtc.publicKey,
      creator: creator.publicKey
    })
    .signers([tbtc])
    .rpc();
}

async function checkState(
  program: Program<SolanaTbtcAnchor>,
  tbtc,
  expectedCreator,
  expectedMinters,
  expectedGuardians,
  expectedTokens
) {
  let tbtcState = await program.account.tbtc.fetch(tbtc.publicKey);

  expect(tbtcState.creator).to.eql(expectedCreator.publicKey);
  expect(tbtcState.minters).to.equal(expectedMinters);
  expect(tbtcState.guardians).to.equal(expectedGuardians);

  let tbtcMint = tbtcState.tokenMint;

  let mintState = await spl.getMint(program.provider.connection, tbtcMint);

  expect(mintState.supply == expectedTokens).to.be.true;
}

async function checkPaused(
  program: Program<SolanaTbtcAnchor>,
  tbtc,
  paused: boolean
) {
  let tbtcState = await program.account.tbtc.fetch(tbtc.publicKey);
  expect(tbtcState.paused).to.equal(paused);
}

function getTokenPDA(
  program: Program<SolanaTbtcAnchor>,
  tbtc,
): [anchor.web3.PublicKey, number] {
  return web3.PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode('tbtc-mint'),
      tbtc.publicKey.toBuffer(),
    ],
    program.programId
  );
}

function getMinterPDA(
  program: Program<SolanaTbtcAnchor>,
  tbtc,
  minter
): [anchor.web3.PublicKey, number] {
  return web3.PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode('minter-info'),
      tbtc.publicKey.toBuffer(),
      minter.publicKey.toBuffer(),
    ],
    program.programId
  );
}

async function addMinter(
  program: Program<SolanaTbtcAnchor>,
  tbtc,
  creator,
  minter,
  payer
): Promise<anchor.web3.PublicKey> {
  const [minterInfoPDA, _] = getMinterPDA(program, tbtc, minter);
  await program.methods
    .addMinter()
    .accounts({
      tbtc: tbtc.publicKey,
      creator: creator.publicKey,
      minter: minter.publicKey,
      payer: payer.publicKey,
      minterInfo: minterInfoPDA,
    })
    .signers([minter])
    .rpc();
  return minterInfoPDA;
}

async function checkMinter(
  program: Program<SolanaTbtcAnchor>,
  tbtc,
  minter
) {
  const [minterInfoPDA, bump] = getMinterPDA(program, tbtc, minter);
  let minterInfo = await program.account.minterInfo.fetch(minterInfoPDA);

  expect(minterInfo.minter).to.eql(minter.publicKey);
  expect(minterInfo.bump).to.equal(bump);
}

async function removeMinter(
  program: Program<SolanaTbtcAnchor>,
  tbtc,
  creator,
  minter,
  minterInfo
) {
  await program.methods
    .removeMinter(minter.publicKey)
    .accounts({
      tbtc: tbtc.publicKey,
      creator: creator.publicKey,
      minterInfo: minterInfo,
    })
    .signers([])
    .rpc();
}

function getGuardianPDA(
  program: Program<SolanaTbtcAnchor>,
  tbtc,
  guardian
): [anchor.web3.PublicKey, number] {
  return web3.PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode('guardian-info'),
      tbtc.publicKey.toBuffer(),
      guardian.publicKey.toBuffer(),
    ],
    program.programId
  );
}

async function addGuardian(
  program: Program<SolanaTbtcAnchor>,
  tbtc,
  creator,
  guardian,
  payer
): Promise<anchor.web3.PublicKey> {
  const [guardianInfoPDA, _] = getGuardianPDA(program, tbtc, guardian);
  await program.methods
    .addGuardian()
    .accounts({
      tbtc: tbtc.publicKey,
      creator: creator.publicKey,
      guardian: guardian.publicKey,
      payer: payer.publicKey,
      guardianInfo: guardianInfoPDA,
    })
    .signers([guardian])
    .rpc();
  return guardianInfoPDA;
}

async function checkGuardian(
  program: Program<SolanaTbtcAnchor>,
  tbtc,
  guardian
) {
  const [guardianInfoPDA, bump] = getGuardianPDA(program, tbtc, guardian);
  let guardianInfo = await program.account.guardianInfo.fetch(guardianInfoPDA);

  expect(guardianInfo.guardian).to.eql(guardian.publicKey);
  expect(guardianInfo.bump).to.equal(bump);
}

async function removeGuardian(
  program: Program<SolanaTbtcAnchor>,
  tbtc,
  creator,
  guardian,
  guardianInfo
) {
  await program.methods
    .removeGuardian(guardian.publicKey)
    .accounts({
      tbtc: tbtc.publicKey,
      creator: creator.publicKey,
      guardianInfo: guardianInfo,
    })
    .signers([])
    .rpc();
}

async function pause(
  program: Program<SolanaTbtcAnchor>,
  tbtc,
  guardian
) {
  const [guardianInfoPDA, _] = getGuardianPDA(program, tbtc, guardian);
  await program.methods
    .pause()
    .accounts({
      tbtc: tbtc.publicKey,
      guardianInfo: guardianInfoPDA,
      guardian: guardian.publicKey
    })
    .signers([guardian])
    .rpc();
}

async function unpause(
  program: Program<SolanaTbtcAnchor>,
  tbtc,
  creator
) {
  await program.methods
    .unpause()
    .accounts({
      tbtc: tbtc.publicKey,
      creator: creator.publicKey
    })
    .signers([])
    .rpc();
}

async function setupMint(
  program: Program<SolanaTbtcAnchor>,
  tbtc,
  creator,
  recipient,
) {
  const [tbtcMintPDA, _] = getTokenPDA(program, tbtc);
  const associatedTokenAccount = spl.getAssociatedTokenAddressSync(
    tbtcMintPDA,
    recipient.publicKey,
  );

  await program.methods
    .setupMint()
    .accounts({
      tbtcMint: tbtcMintPDA,
      tbtc: tbtc.publicKey,
      payer: creator.publicKey,
      recipientAccount: associatedTokenAccount,
      recipient: recipient.publicKey,
    })
    .signers([])
    .rpc()
}

async function mint(
  program: Program<SolanaTbtcAnchor>,
  tbtc,
  minter,
  minterInfoPDA,
  recipient,
  amount,
) {
  const [tbtcMintPDA, _] = getTokenPDA(program, tbtc);
  const associatedTokenAccount = spl.getAssociatedTokenAddressSync(
    tbtcMintPDA,
    recipient.publicKey,
  );

  await program.methods
    .mint(new anchor.BN(amount))
    .accounts({
      tbtcMint: tbtcMintPDA,
      tbtc: tbtc.publicKey,
      minterInfo: minterInfoPDA,
      minter: minter.publicKey,
      recipientAccount: associatedTokenAccount,
      recipient: recipient.publicKey,
    })
    .signers([minter])
    .rpc();
}

describe("solana-tbtc-anchor", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.SolanaTbtcAnchor as Program<SolanaTbtcAnchor>;

  
  const creator = (program.provider as anchor.AnchorProvider).wallet;
  const minterKeys = anchor.web3.Keypair.generate();
  const minter2Keys = anchor.web3.Keypair.generate();
  const impostorKeys = anchor.web3.Keypair.generate();
  const guardianKeys = anchor.web3.Keypair.generate();
  const guardian2Keys = anchor.web3.Keypair.generate();

  const recipientKeys = anchor.web3.Keypair.generate();

  it('setup', async () => {
    const tbtcKeys = anchor.web3.Keypair.generate();
    await setup(program, tbtcKeys, creator);
    await checkState(program, tbtcKeys, creator, 0, 0, 0);
  });

  it('add minter', async () => {
    const tbtcKeys = anchor.web3.Keypair.generate();
    await setup(program, tbtcKeys, creator);
    await checkState(program, tbtcKeys, creator, 0, 0, 0);
    await addMinter(program, tbtcKeys, creator, minterKeys, creator);
    await checkMinter(program, tbtcKeys, minterKeys);
    await checkState(program, tbtcKeys, creator, 1, 0, 0);
  });

  it('mint', async () => {
    const tbtcKeys = anchor.web3.Keypair.generate();
    await setup(program, tbtcKeys, creator);
    await checkState(program, tbtcKeys, creator, 0, 0, 0);
    const minterInfoPDA = await addMinter(program, tbtcKeys, creator, minterKeys, creator);
    await checkMinter(program, tbtcKeys, minterKeys);
    await checkState(program, tbtcKeys, creator, 1, 0, 0);

    await setupMint(program, tbtcKeys, creator, recipientKeys);
    await mint(program, tbtcKeys, minterKeys, minterInfoPDA, recipientKeys, 1000);

    await checkState(program, tbtcKeys, creator, 1, 0, 1000);
  });

  it('won\'t mint', async () => {
    const tbtcKeys = anchor.web3.Keypair.generate();
    await setup(program, tbtcKeys, creator);
    await checkState(program, tbtcKeys, creator, 0, 0, 0);
    const minterInfoPDA = await addMinter(program, tbtcKeys, creator, minterKeys, creator);
    await checkMinter(program, tbtcKeys, minterKeys);
    await checkState(program, tbtcKeys, creator, 1, 0, 0);

    await setupMint(program, tbtcKeys, creator, recipientKeys);

    try {
      await mint(program, tbtcKeys, impostorKeys, minterInfoPDA, recipientKeys, 1000);
      chai.assert(false, "should've failed but didn't");
    } catch (_err) {
      expect(_err).to.be.instanceOf(AnchorError);
      const err: AnchorError = _err;
      expect(err.error.errorCode.code).to.equal('ConstraintSeeds');
      expect(err.program.equals(program.programId)).is.true;
    }
  });

  it('remove minter', async () => {
    const tbtcKeys = anchor.web3.Keypair.generate();
    await setup(program, tbtcKeys, creator);
    await checkState(program, tbtcKeys, creator, 0, 0, 0);
    const minterInfoPDA = await addMinter(program, tbtcKeys, creator, minterKeys, creator);
    await checkMinter(program, tbtcKeys, minterKeys);
    await checkState(program, tbtcKeys, creator, 1, 0, 0);
    await removeMinter(program, tbtcKeys, creator, minterKeys, minterInfoPDA);
    await checkState(program, tbtcKeys, creator, 0, 0, 0);
  });

  it('won\'t remove minter', async () => {
    const tbtcKeys = anchor.web3.Keypair.generate();
    await setup(program, tbtcKeys, creator);
    await checkState(program, tbtcKeys, creator, 0, 0, 0);
    const minterInfoPDA = await addMinter(program, tbtcKeys, creator, minterKeys, creator);
    await checkMinter(program, tbtcKeys, minterKeys);
    await checkState(program, tbtcKeys, creator, 1, 0, 0);
    await removeMinter(program, tbtcKeys, creator, minterKeys, minterInfoPDA);
    await checkState(program, tbtcKeys, creator, 0, 0, 0);

    try {
      await removeMinter(program, tbtcKeys, creator, minterKeys, minterInfoPDA);
    } catch (_err) {
      expect(_err).to.be.instanceOf(AnchorError);
      const err: AnchorError = _err;
      expect(err.error.errorCode.code).to.equal('AccountNotInitialized');
      expect(err.program.equals(program.programId)).is.true;
    }
  });

  it('add guardian', async () => {
    const tbtcKeys = anchor.web3.Keypair.generate();
    await setup(program, tbtcKeys, creator);
    await checkState(program, tbtcKeys, creator, 0, 0, 0);
    await addGuardian(program, tbtcKeys, creator, guardianKeys, creator);
    await checkGuardian(program, tbtcKeys, guardianKeys);
    await checkState(program, tbtcKeys, creator, 0, 1, 0);
  });

  it('remove guardian', async () => {
    const tbtcKeys = anchor.web3.Keypair.generate();
    await setup(program, tbtcKeys, creator);
    await checkState(program, tbtcKeys, creator, 0, 0, 0);
    const guardianInfoPDA = await addGuardian(program, tbtcKeys, creator, guardianKeys, creator);
    await checkGuardian(program, tbtcKeys, guardianKeys);
    await checkState(program, tbtcKeys, creator, 0, 1, 0);
    await removeGuardian(program, tbtcKeys, creator, guardianKeys, guardianInfoPDA);
    await checkState(program, tbtcKeys, creator, 0, 0, 0);
  });

  it('pause', async () => {
    const tbtcKeys = anchor.web3.Keypair.generate();
    await setup(program, tbtcKeys, creator);
    await addGuardian(program, tbtcKeys, creator, guardianKeys, creator);
    await checkPaused(program, tbtcKeys, false);
    await pause(program, tbtcKeys, guardianKeys);
    await checkPaused(program, tbtcKeys, true);
  });

  it('unpause', async () => {
    const tbtcKeys = anchor.web3.Keypair.generate();
    await setup(program, tbtcKeys, creator);
    await addGuardian(program, tbtcKeys, creator, guardianKeys, creator);
    await checkPaused(program, tbtcKeys, false);
    await pause(program, tbtcKeys, guardianKeys);
    await checkPaused(program, tbtcKeys, true);
    await unpause(program, tbtcKeys, creator);
    await checkPaused(program, tbtcKeys, false);
  });

  it('won\'t mint when paused', async () => {
    const tbtcKeys = anchor.web3.Keypair.generate();
    await setup(program, tbtcKeys, creator);
    const minterInfoPDA = await addMinter(program, tbtcKeys, creator, minterKeys, creator);
    await addGuardian(program, tbtcKeys, creator, guardianKeys, creator);
    await pause(program, tbtcKeys, guardianKeys);
    await setupMint(program, tbtcKeys, creator, recipientKeys);

    try {
      await mint(program, tbtcKeys, minterKeys, minterInfoPDA, recipientKeys, 1000);

      chai.assert(false, "should've failed but didn't");
    } catch (_err) {
      expect(_err).to.be.instanceOf(AnchorError);
      const err: AnchorError = _err;
      expect(err.error.errorCode.code).to.equal('IsPaused');
      expect(err.program.equals(program.programId)).is.true;
    }
  })
});
