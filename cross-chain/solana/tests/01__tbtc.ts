import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorError } from "@coral-xyz/anchor";
import * as spl from "@solana/spl-token";
import * as web3 from '@solana/web3.js';
import { Tbtc } from "../target/types/tbtc";
import { expect } from 'chai';

function maybeAuthorityAnd(
  signer,
  signers
) {
  return signers.concat(signer instanceof (anchor.Wallet as any) ? [] : [signer]);
}

async function setup(
  program: Program<Tbtc>,
  tbtc,
  authority
) {
  const [tbtcMintPDA, _] = getTokenPDA(program, tbtc);
  
  await program.methods
    .initialize()
    .accounts({
      tbtcMint: tbtcMintPDA,
      tbtc: tbtc.publicKey,
      authority: authority.publicKey
    })
    .signers([tbtc])
    .rpc();
}

async function checkState(
  program: Program<Tbtc>,
  tbtc,
  expectedAuthority,
  expectedMinters,
  expectedGuardians,
  expectedTokensSupply
) {
  let tbtcState = await program.account.tbtc.fetch(tbtc.publicKey);

  expect(tbtcState.authority).to.eql(expectedAuthority.publicKey);
  expect(tbtcState.minters).to.equal(expectedMinters);
  expect(tbtcState.guardians).to.equal(expectedGuardians);

  let tbtcMint = tbtcState.tokenMint;

  let mintState = await spl.getMint(program.provider.connection, tbtcMint);

  expect(mintState.supply == expectedTokensSupply).to.be.true;
}

async function changeAuthority(
  program: Program<Tbtc>,
  tbtc,
  authority,
  newAuthority,
) {
  await program.methods
    .changeAuthority()
    .accounts({
      tbtc: tbtc.publicKey,
      authority: authority.publicKey,
      newAuthority: newAuthority.publicKey,
    })
    .signers(maybeAuthorityAnd(authority, [newAuthority]))
    .rpc();
}

async function checkPaused(
  program: Program<Tbtc>,
  tbtc,
  paused: boolean
) {
  let tbtcState = await program.account.tbtc.fetch(tbtc.publicKey);
  expect(tbtcState.paused).to.equal(paused);
}

function getTokenPDA(
  program: Program<Tbtc>,
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
  program: Program<Tbtc>,
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
  program: Program<Tbtc>,
  tbtc,
  authority,
  minter,
  payer
): Promise<anchor.web3.PublicKey> {
  const [minterInfoPDA, _] = getMinterPDA(program, tbtc, minter);
  await program.methods
    .addMinter()
    .accounts({
      tbtc: tbtc.publicKey,
      authority: authority.publicKey,
      minter: minter.publicKey,
      payer: payer.publicKey,
      minterInfo: minterInfoPDA,
    })
    .signers(maybeAuthorityAnd(authority, []))
    .rpc();
  return minterInfoPDA;
}

async function checkMinter(
  program: Program<Tbtc>,
  tbtc,
  minter
) {
  const [minterInfoPDA, bump] = getMinterPDA(program, tbtc, minter);
  let minterInfo = await program.account.minterInfo.fetch(minterInfoPDA);

  expect(minterInfo.minter).to.eql(minter.publicKey);
  expect(minterInfo.bump).to.equal(bump);
}

async function removeMinter(
  program: Program<Tbtc>,
  tbtc,
  authority,
  minter,
  minterInfo
) {
  await program.methods
    .removeMinter(minter.publicKey)
    .accounts({
      tbtc: tbtc.publicKey,
      authority: authority.publicKey,
      minterInfo: minterInfo,
    })
    .signers(maybeAuthorityAnd(authority, []))
    .rpc();
}

function getGuardianPDA(
  program: Program<Tbtc>,
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
  program: Program<Tbtc>,
  tbtc,
  authority,
  guardian,
  payer
): Promise<anchor.web3.PublicKey> {
  const [guardianInfoPDA, _] = getGuardianPDA(program, tbtc, guardian);
  await program.methods
    .addGuardian()
    .accounts({
      tbtc: tbtc.publicKey,
      authority: authority.publicKey,
      guardian: guardian.publicKey,
      payer: payer.publicKey,
      guardianInfo: guardianInfoPDA,
    })
    .signers(maybeAuthorityAnd(authority, []))
    .rpc();
  return guardianInfoPDA;
}

async function checkGuardian(
  program: Program<Tbtc>,
  tbtc,
  guardian
) {
  const [guardianInfoPDA, bump] = getGuardianPDA(program, tbtc, guardian);
  let guardianInfo = await program.account.guardianInfo.fetch(guardianInfoPDA);

  expect(guardianInfo.guardian).to.eql(guardian.publicKey);
  expect(guardianInfo.bump).to.equal(bump);
}

async function removeGuardian(
  program: Program<Tbtc>,
  tbtc,
  authority,
  guardian,
  guardianInfo
) {
  await program.methods
    .removeGuardian(guardian.publicKey)
    .accounts({
      tbtc: tbtc.publicKey,
      authority: authority.publicKey,
      guardianInfo: guardianInfo,
    })
    .signers(maybeAuthorityAnd(authority, []))
    .rpc();
}

async function pause(
  program: Program<Tbtc>,
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
  program: Program<Tbtc>,
  tbtc,
  authority
) {
  await program.methods
    .unpause()
    .accounts({
      tbtc: tbtc.publicKey,
      authority: authority.publicKey
    })
    .signers(maybeAuthorityAnd(authority, []))
    .rpc();
}

async function mint(
  program: Program<Tbtc>,
  tbtc,
  minter,
  minterInfoPDA,
  recipient,
  amount,
  payer,
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
      payer: payer.publicKey,
    })
    .signers(maybeAuthorityAnd(payer, [minter]))
    .rpc();
}

describe("tbtc", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Tbtc as Program<Tbtc>;

  
  const authority = (program.provider as anchor.AnchorProvider).wallet;
  const newAuthority = anchor.web3.Keypair.generate();
  const minterKeys = anchor.web3.Keypair.generate();
  const minter2Keys = anchor.web3.Keypair.generate();
  const impostorKeys = anchor.web3.Keypair.generate();
  const guardianKeys = anchor.web3.Keypair.generate();
  const guardian2Keys = anchor.web3.Keypair.generate();

  const recipientKeys = anchor.web3.Keypair.generate();

  it('setup', async () => {
    const tbtcKeys = anchor.web3.Keypair.generate();
    await setup(program, tbtcKeys, authority);
    await checkState(program, tbtcKeys, authority, 0, 0, 0);
  });

  it('change authority', async () => {
    const tbtcKeys = anchor.web3.Keypair.generate();
    await setup(program, tbtcKeys, authority);
    await checkState(program, tbtcKeys, authority, 0, 0, 0);
    await changeAuthority(program, tbtcKeys, authority, newAuthority);
    await checkState(program, tbtcKeys, newAuthority, 0, 0, 0);
  })

  it('add minter', async () => {
    const tbtcKeys = anchor.web3.Keypair.generate();
    await setup(program, tbtcKeys, authority);
    await checkState(program, tbtcKeys, authority, 0, 0, 0);
    await addMinter(program, tbtcKeys, authority, minterKeys, authority);
    await checkMinter(program, tbtcKeys, minterKeys);
    await checkState(program, tbtcKeys, authority, 1, 0, 0);

    try {
      await addMinter(program, tbtcKeys, impostorKeys, minter2Keys, authority);
      chai.assert(false, "should've failed but didn't");
    } catch (_err) {
      expect(_err).to.be.instanceOf(AnchorError);
      const err: AnchorError = _err;
      expect(err.error.errorCode.code).to.equal('IsNotAuthority');
      expect(err.program.equals(program.programId)).is.true;
    }
  });

  it('mint', async () => {
    const tbtcKeys = anchor.web3.Keypair.generate();
    await setup(program, tbtcKeys, authority);
    await checkState(program, tbtcKeys, authority, 0, 0, 0);
    const minterInfoPDA = await addMinter(program, tbtcKeys, authority, minterKeys, authority);
    await checkMinter(program, tbtcKeys, minterKeys);
    await checkState(program, tbtcKeys, authority, 1, 0, 0);

    // await setupMint(program, tbtcKeys, authority, recipientKeys);
    await mint(program, tbtcKeys, minterKeys, minterInfoPDA, recipientKeys, 1000, authority);

    await checkState(program, tbtcKeys, authority, 1, 0, 1000);
  });

  it('won\'t mint', async () => {
    const tbtcKeys = anchor.web3.Keypair.generate();
    await setup(program, tbtcKeys, authority);
    await checkState(program, tbtcKeys, authority, 0, 0, 0);
    const minterInfoPDA = await addMinter(program, tbtcKeys, authority, minterKeys, authority);
    await checkMinter(program, tbtcKeys, minterKeys);
    await checkState(program, tbtcKeys, authority, 1, 0, 0);

    // await setupMint(program, tbtcKeys, authority, recipientKeys);

    try {
      await mint(program, tbtcKeys, impostorKeys, minterInfoPDA, recipientKeys, 1000, authority);
      chai.assert(false, "should've failed but didn't");
    } catch (_err) {
      expect(_err).to.be.instanceOf(AnchorError);
      const err: AnchorError = _err;
      expect(err.error.errorCode.code).to.equal('ConstraintSeeds');
      expect(err.program.equals(program.programId)).is.true;
    }
  });

  it('use two minters', async () => {
    const tbtcKeys = anchor.web3.Keypair.generate();
    await setup(program, tbtcKeys, authority);
    await checkState(program, tbtcKeys, authority, 0, 0, 0);
    const minterInfoPDA = await addMinter(program, tbtcKeys, authority, minterKeys, authority);
    const minter2InfoPDA = await addMinter(program, tbtcKeys, authority, minter2Keys, authority);
    await checkMinter(program, tbtcKeys, minterKeys);
    await checkMinter(program, tbtcKeys, minter2Keys);
    await checkState(program, tbtcKeys, authority, 2, 0, 0);
    // await setupMint(program, tbtcKeys, authority, recipientKeys);

    // cannot mint with wrong keys
    try {
      await mint(program, tbtcKeys, minter2Keys, minterInfoPDA, recipientKeys, 1000, authority);
      chai.assert(false, "should've failed but didn't");
    } catch (_err) {
      expect(_err).to.be.instanceOf(AnchorError);
      const err: AnchorError = _err;
      expect(err.error.errorCode.code).to.equal('ConstraintSeeds');
      expect(err.program.equals(program.programId)).is.true;
    }

    // cannot remove minter with wrong keys
    try {
      await removeMinter(program, tbtcKeys, authority, minter2Keys, minterInfoPDA);
      chai.assert(false, "should've failed but didn't");
    } catch (_err) {
      expect(_err).to.be.instanceOf(AnchorError);
      const err: AnchorError = _err;
      expect(err.error.errorCode.code).to.equal('ConstraintSeeds');
      expect(err.program.equals(program.programId)).is.true;
    }

    await mint(program, tbtcKeys, minterKeys, minterInfoPDA, recipientKeys, 500, authority);
    await checkState(program, tbtcKeys, authority, 2, 0, 500);
  });

  it('remove minter', async () => {
    const tbtcKeys = anchor.web3.Keypair.generate();
    await setup(program, tbtcKeys, authority);
    await checkState(program, tbtcKeys, authority, 0, 0, 0);
    const minterInfoPDA = await addMinter(program, tbtcKeys, authority, minterKeys, authority);
    await checkMinter(program, tbtcKeys, minterKeys);
    await checkState(program, tbtcKeys, authority, 1, 0, 0);
    await removeMinter(program, tbtcKeys, authority, minterKeys, minterInfoPDA);
    await checkState(program, tbtcKeys, authority, 0, 0, 0);
  });

  it('won\'t remove minter', async () => {
    const tbtcKeys = anchor.web3.Keypair.generate();
    await setup(program, tbtcKeys, authority);
    await checkState(program, tbtcKeys, authority, 0, 0, 0);
    const minterInfoPDA = await addMinter(program, tbtcKeys, authority, minterKeys, authority);
    await checkMinter(program, tbtcKeys, minterKeys);
    await checkState(program, tbtcKeys, authority, 1, 0, 0);

    try {
      await removeMinter(program, tbtcKeys, impostorKeys, minterKeys, minterInfoPDA);
    } catch (_err) {
      expect(_err).to.be.instanceOf(AnchorError);
      const err: AnchorError = _err;
      expect(err.error.errorCode.code).to.equal('IsNotAuthority');
      expect(err.program.equals(program.programId)).is.true;
    }

    await removeMinter(program, tbtcKeys, authority, minterKeys, minterInfoPDA);
    await checkState(program, tbtcKeys, authority, 0, 0, 0);

    try {
      await removeMinter(program, tbtcKeys, authority, minterKeys, minterInfoPDA);
    } catch (_err) {
      expect(_err).to.be.instanceOf(AnchorError);
      const err: AnchorError = _err;
      expect(err.error.errorCode.code).to.equal('AccountNotInitialized');
      expect(err.program.equals(program.programId)).is.true;
    }
  });

  it('add guardian', async () => {
    const tbtcKeys = anchor.web3.Keypair.generate();
    await setup(program, tbtcKeys, authority);
    await checkState(program, tbtcKeys, authority, 0, 0, 0);
    await addGuardian(program, tbtcKeys, authority, guardianKeys, authority);
    await checkGuardian(program, tbtcKeys, guardianKeys);
    await checkState(program, tbtcKeys, authority, 0, 1, 0);

    try {
      await addGuardian(program, tbtcKeys, impostorKeys, guardian2Keys, authority);
      chai.assert(false, "should've failed but didn't");
    } catch (_err) {
      expect(_err).to.be.instanceOf(AnchorError);
      const err: AnchorError = _err;
      expect(err.error.errorCode.code).to.equal('IsNotAuthority');
      expect(err.program.equals(program.programId)).is.true;
    }
  });

  it('remove guardian', async () => {
    const tbtcKeys = anchor.web3.Keypair.generate();
    await setup(program, tbtcKeys, authority);
    await checkState(program, tbtcKeys, authority, 0, 0, 0);
    const guardianInfoPDA = await addGuardian(program, tbtcKeys, authority, guardianKeys, authority);
    await checkGuardian(program, tbtcKeys, guardianKeys);
    await checkState(program, tbtcKeys, authority, 0, 1, 0);

    try {
      await removeGuardian(program, tbtcKeys, impostorKeys, guardianKeys, guardianInfoPDA);
      chai.assert(false, "should've failed but didn't");
    } catch (_err) {
      expect(_err).to.be.instanceOf(AnchorError);
      const err: AnchorError = _err;
      expect(err.error.errorCode.code).to.equal('IsNotAuthority');
      expect(err.program.equals(program.programId)).is.true;
    }

    await removeGuardian(program, tbtcKeys, authority, guardianKeys, guardianInfoPDA);
    await checkState(program, tbtcKeys, authority, 0, 0, 0);

    try {
      await removeGuardian(program, tbtcKeys, authority, guardianKeys, guardianInfoPDA);
      chai.assert(false, "should've failed but didn't");
    } catch (_err) {
      expect(_err).to.be.instanceOf(AnchorError);
      const err: AnchorError = _err;
      expect(err.error.errorCode.code).to.equal('AccountNotInitialized');
      expect(err.program.equals(program.programId)).is.true;
    }
  });

  it('pause', async () => {
    const tbtcKeys = anchor.web3.Keypair.generate();
    await setup(program, tbtcKeys, authority);
    await addGuardian(program, tbtcKeys, authority, guardianKeys, authority);
    await checkPaused(program, tbtcKeys, false);
    await pause(program, tbtcKeys, guardianKeys);
    await checkPaused(program, tbtcKeys, true);
  });

  it('unpause', async () => {
    const tbtcKeys = anchor.web3.Keypair.generate();
    await setup(program, tbtcKeys, authority);
    await addGuardian(program, tbtcKeys, authority, guardianKeys, authority);
    await checkPaused(program, tbtcKeys, false);
    await pause(program, tbtcKeys, guardianKeys);
    await checkPaused(program, tbtcKeys, true);
    await unpause(program, tbtcKeys, authority);
    await checkPaused(program, tbtcKeys, false);

    try {
      await unpause(program, tbtcKeys, authority);

      chai.assert(false, "should've failed but didn't");
    } catch (_err) {
      expect(_err).to.be.instanceOf(AnchorError);
      const err: AnchorError = _err;
      expect(err.error.errorCode.code).to.equal('IsNotPaused');
      expect(err.program.equals(program.programId)).is.true;
    }
  });

  it('won\'t mint when paused', async () => {
    const tbtcKeys = anchor.web3.Keypair.generate();
    await setup(program, tbtcKeys, authority);
    const minterInfoPDA = await addMinter(program, tbtcKeys, authority, minterKeys, authority);
    await addGuardian(program, tbtcKeys, authority, guardianKeys, authority);
    await pause(program, tbtcKeys, guardianKeys);
    // await setupMint(program, tbtcKeys, authority, recipientKeys);

    try {
      await mint(program, tbtcKeys, minterKeys, minterInfoPDA, recipientKeys, 1000, authority);

      chai.assert(false, "should've failed but didn't");
    } catch (_err) {
      expect(_err).to.be.instanceOf(AnchorError);
      const err: AnchorError = _err;
      expect(err.error.errorCode.code).to.equal('IsPaused');
      expect(err.program.equals(program.programId)).is.true;
    }
  })

  it('use two guardians', async () => {
    const tbtcKeys = anchor.web3.Keypair.generate();
    await setup(program, tbtcKeys, authority);
    await checkState(program, tbtcKeys, authority, 0, 0, 0);
    const guardianInfoPDA = await addGuardian(program, tbtcKeys, authority, guardianKeys, authority);
    await addGuardian(program, tbtcKeys, authority, guardian2Keys, authority);
    await checkGuardian(program, tbtcKeys, guardianKeys);
    await checkGuardian(program, tbtcKeys, guardian2Keys);
    await checkState(program, tbtcKeys, authority, 0, 2, 0);

    await pause(program, tbtcKeys, guardianKeys);

    try {
      await pause(program, tbtcKeys, guardian2Keys);
      chai.assert(false, "should've failed but didn't");
    } catch (_err) {
      expect(_err).to.be.instanceOf(AnchorError);
      const err: AnchorError = _err;
      expect(err.error.errorCode.code).to.equal('IsPaused');
      expect(err.program.equals(program.programId)).is.true;
    }

    await unpause(program, tbtcKeys, authority);
    await pause(program, tbtcKeys, guardian2Keys);
    await checkPaused(program, tbtcKeys, true);
    await unpause(program, tbtcKeys, authority);

    // cannot remove guardian with wrong keys
    try {
      await removeGuardian(program, tbtcKeys, authority, guardian2Keys, guardianInfoPDA);
      chai.assert(false, "should've failed but didn't");
    } catch (_err) {
      expect(_err).to.be.instanceOf(AnchorError);
      const err: AnchorError = _err;
      expect(err.error.errorCode.code).to.equal('ConstraintSeeds');
      expect(err.program.equals(program.programId)).is.true;
    }
  });
});
