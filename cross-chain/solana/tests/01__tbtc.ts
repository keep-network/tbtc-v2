import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorError } from "@coral-xyz/anchor";
import * as spl from "@solana/spl-token";
import * as web3 from '@solana/web3.js';
import { Tbtc } from "../target/types/tbtc";
import { expect } from 'chai';
import { ASSOCIATED_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/utils/token";
import { transferLamports } from "./helpers/utils";
import { maybeAuthorityAnd, getConfigPDA, getTokenPDA, getMinterPDA, getGuardianPDA, getMintersPDA, getGuardiansPDA, checkState, addMinter } from "./helpers/tbtcHelpers";

async function setup(
  program: Program<Tbtc>,
  authority
) {
  const [config,] = getConfigPDA(program);
  const [guardians,] = getGuardiansPDA(program);
  const [minters,] = getMintersPDA(program);
  const [tbtcMintPDA, _] = getTokenPDA(program);

  await program.methods
    .initialize()
    .accounts({
      mint: tbtcMintPDA,
      config,
      guardians,
      minters,
      authority: authority.publicKey
    })
    .rpc();
}

async function changeAuthority(
  program: Program<Tbtc>,
  authority,
  newAuthority,
) {
  const [config,] = getConfigPDA(program);
  await program.methods
    .changeAuthority()
    .accounts({
      config,
      authority: authority.publicKey,
      newAuthority: newAuthority.publicKey,
    })
    .signers(maybeAuthorityAnd(authority, []))
    .rpc();
}

async function takeAuthority(
  program: Program<Tbtc>,
  newAuthority,
) {
  const [config,] = getConfigPDA(program);
  await program.methods
    .takeAuthority()
    .accounts({
      config,
      pendingAuthority: newAuthority.publicKey,
    })
    .signers(maybeAuthorityAnd(newAuthority, []))
    .rpc();
}

async function cancelAuthorityChange(
  program: Program<Tbtc>,
  authority,
) {
  const [config,] = getConfigPDA(program);
  await program.methods
    .cancelAuthorityChange()
    .accounts({
      config,
      authority: authority.publicKey,
    })
    .signers(maybeAuthorityAnd(authority, []))
    .rpc();
}

async function checkPendingAuthority(
  program: Program<Tbtc>,
  pendingAuthority,
) {
  const [config,] = getConfigPDA(program);
  let configState = await program.account.config.fetch(config);
  expect(configState.pendingAuthority).to.eql(pendingAuthority.publicKey);
}

async function checkNoPendingAuthority(
  program: Program<Tbtc>,
) {
  const [config,] = getConfigPDA(program);
  let configState = await program.account.config.fetch(config);
  expect(configState.pendingAuthority).to.equal(null);
}

async function checkPaused(
  program: Program<Tbtc>,
  paused: boolean
) {
  const [config,] = getConfigPDA(program);
  let configState = await program.account.config.fetch(config);
  expect(configState.paused).to.equal(paused);
}

async function checkMinter(
  program: Program<Tbtc>,
  minter
) {
  const [minterInfoPDA, bump] = getMinterPDA(program, minter.publicKey);
  let minterInfo = await program.account.minterInfo.fetch(minterInfoPDA);

  expect(minterInfo.minter).to.eql(minter.publicKey);
  expect(minterInfo.bump).to.equal(bump);
}

async function removeMinter(
  program: Program<Tbtc>,
  authority,
  minter,
  minterInfo
) {
  const [config,] = getConfigPDA(program);
  const [minters,] = getMintersPDA(program);
  await program.methods
    .removeMinter()
    .accounts({
      config,
      authority: authority.publicKey,
      minters,
      minterInfo: minterInfo,
      minter: minter.publicKey
    })
    .signers(maybeAuthorityAnd(authority, []))
    .rpc();
}

async function addGuardian(
  program: Program<Tbtc>,
  authority,
  guardian,
  payer
): Promise<anchor.web3.PublicKey> {
  const [config,] = getConfigPDA(program);
  const [guardians,] = getGuardiansPDA(program);
  const [guardianInfoPDA, _] = getGuardianPDA(program, guardian);
  await program.methods
    .addGuardian()
    .accounts({
      config,
      authority: authority.publicKey,
      guardians,
      guardianInfo: guardianInfoPDA,
      guardian: guardian.publicKey,
    })
    .signers(maybeAuthorityAnd(authority, []))
    .rpc();
  return guardianInfoPDA;
}

async function checkGuardian(
  program: Program<Tbtc>,
  guardian
) {
  const [guardianInfoPDA, bump] = getGuardianPDA(program, guardian);
  let guardianInfo = await program.account.guardianInfo.fetch(guardianInfoPDA);

  expect(guardianInfo.guardian).to.eql(guardian.publicKey);
  expect(guardianInfo.bump).to.equal(bump);
}

async function removeGuardian(
  program: Program<Tbtc>,
  authority,
  guardian,
  guardianInfo
) {
  const [config,] = getConfigPDA(program);
  const [guardians,] = getGuardiansPDA(program);
  await program.methods
    .removeGuardian()
    .accounts({
      config,
      authority: authority.publicKey,
      guardians,
      guardianInfo: guardianInfo,
      guardian: guardian.publicKey
    })
    .signers(maybeAuthorityAnd(authority, []))
    .rpc();
}

async function pause(
  program: Program<Tbtc>,
  guardian
) {
  const [config,] = getConfigPDA(program);
  const [guardianInfoPDA, _] = getGuardianPDA(program, guardian);
  await program.methods
    .pause()
    .accounts({
      config,
      guardianInfo: guardianInfoPDA,
      guardian: guardian.publicKey
    })
    .signers([guardian])
    .rpc();
}

async function unpause(
  program: Program<Tbtc>,
  authority
) {
  const [config,] = getConfigPDA(program);
  await program.methods
    .unpause()
    .accounts({
      config,
      authority: authority.publicKey
    })
    .signers(maybeAuthorityAnd(authority, []))
    .rpc();
}

async function mint(
  program: Program<Tbtc>,
  minter,
  minterInfoPDA,
  recipient,
  amount,
  payer,
) {
  const connection = program.provider.connection;

  const [config,] = getConfigPDA(program);
  const [tbtcMintPDA, _] = getTokenPDA(program);
  const recipientToken = spl.getAssociatedTokenAddressSync(tbtcMintPDA, recipient.publicKey);

  const tokenData = await spl.getAccount(connection, recipientToken).catch((err) => {
    if (err instanceof spl.TokenAccountNotFoundError) {
      return null;
    } else {
      throw err;
    };
  });

  if (tokenData === null) {
    const tx = await web3.sendAndConfirmTransaction(
      connection,
      new web3.Transaction().add(
        spl.createAssociatedTokenAccountIdempotentInstruction(
          payer.publicKey,
          recipientToken,
          recipient.publicKey,
          tbtcMintPDA,
        )
      ),
      [payer.payer]
    );
  }


  await program.methods
    .mint(new anchor.BN(amount))
    .accounts({
      mint: tbtcMintPDA,
      config,
      minterInfo: minterInfoPDA,
      minter: minter.publicKey,
      recipientToken,
    })
    .signers(maybeAuthorityAnd(payer, [minter]))
    .rpc();
}

describe("tbtc", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Tbtc as Program<Tbtc>;

  const authority = (program.provider as anchor.AnchorProvider).wallet as anchor.Wallet;
  const newAuthority = anchor.web3.Keypair.generate();
  const minterKeys = anchor.web3.Keypair.generate();
  const minter2Keys = anchor.web3.Keypair.generate();
  const impostorKeys = anchor.web3.Keypair.generate();
  const guardianKeys = anchor.web3.Keypair.generate();
  const guardian2Keys = anchor.web3.Keypair.generate();

  const recipientKeys = anchor.web3.Keypair.generate();

  it('setup', async () => {
    await setup(program, authority);
    await checkState(program, authority, 0, 0, 0);
  });

  it('change authority', async () => {
    await checkState(program, authority, 0, 0, 0);
    await checkNoPendingAuthority(program);
    try {
      await cancelAuthorityChange(program, authority);
      chai.assert(false, "should've failed but didn't");
    } catch (_err) {
      expect(_err).to.be.instanceOf(AnchorError);
      const err: AnchorError = _err;
      expect(err.error.errorCode.code).to.equal('NoPendingAuthorityChange');
      expect(err.program.equals(program.programId)).is.true;
    }
    try {
      await takeAuthority(program, newAuthority);
      chai.assert(false, "should've failed but didn't");
    } catch (_err) {
      expect(_err).to.be.instanceOf(AnchorError);
      const err: AnchorError = _err;
      expect(err.error.errorCode.code).to.equal('NoPendingAuthorityChange');
      expect(err.program.equals(program.programId)).is.true;
    }

    await changeAuthority(program, authority, newAuthority);
    await checkPendingAuthority(program, newAuthority);
    await takeAuthority(program, newAuthority);
    await checkNoPendingAuthority(program);
    await checkState(program, newAuthority, 0, 0, 0);
    await changeAuthority(program, newAuthority, authority.payer);
    try {
      await takeAuthority(program, impostorKeys);
      chai.assert(false, "should've failed but didn't");
    } catch (_err) {
      expect(_err).to.be.instanceOf(AnchorError);
      const err: AnchorError = _err;
      expect(err.error.errorCode.code).to.equal('IsNotPendingAuthority');
      expect(err.program.equals(program.programId)).is.true;
    }
    try {
      await takeAuthority(program, newAuthority);
      chai.assert(false, "should've failed but didn't");
    } catch (_err) {
      expect(_err).to.be.instanceOf(AnchorError);
      const err: AnchorError = _err;
      expect(err.error.errorCode.code).to.equal('IsNotPendingAuthority');
      expect(err.program.equals(program.programId)).is.true;
    }
    try {
      await cancelAuthorityChange(program, authority);
      chai.assert(false, "should've failed but didn't");
    } catch (_err) {
      expect(_err).to.be.instanceOf(AnchorError);
      const err: AnchorError = _err;
      expect(err.error.errorCode.code).to.equal('IsNotAuthority');
      expect(err.program.equals(program.programId)).is.true;
    }
    await takeAuthority(program, authority);

    await checkState(program, authority, 0, 0, 0);
  })

  it('add minter', async () => {
    await checkState(program, authority, 0, 0, 0);
    await addMinter(program, authority, minterKeys.publicKey);
    await checkMinter(program, minterKeys);
    await checkState(program, authority, 1, 0, 0);

    // Transfer lamports to imposter.
    await transferLamports(program.provider.connection, authority.payer, impostorKeys.publicKey, 1000000000);
    // await web3.sendAndConfirmTransaction(
    //   program.provider.connection,
    //   new web3.Transaction().add(
    //     web3.SystemProgram.transfer({
    //       fromPubkey: authority.publicKey,
    //       toPubkey: impostorKeys.publicKey,
    //       lamports: 1000000000,
    //     })
    //   ),
    //   [authority.payer]
    // );

    try {
      await addMinter(program, impostorKeys, minter2Keys.publicKey);
      chai.assert(false, "should've failed but didn't");
    } catch (_err) {
      expect(_err).to.be.instanceOf(AnchorError);
      const err: AnchorError = _err;
      expect(err.error.errorCode.code).to.equal('IsNotAuthority');
      expect(err.program.equals(program.programId)).is.true;
    }
  });

  it('mint', async () => {
    await checkState(program, authority, 1, 0, 0);
    const [minterInfoPDA, _] = getMinterPDA(program, minterKeys.publicKey);
    await checkMinter(program, minterKeys);

    // await setupMint(program, authority, recipientKeys);
    await mint(program, minterKeys, minterInfoPDA, recipientKeys, 1000, authority);

    await checkState(program, authority, 1, 0, 1000);

    // // Burn for next test.
    // const ix = spl.createBurnCheckedInstruction(
    //   account, // PublicKey of Owner's Associated Token Account
    //   new PublicKey(MINT_ADDRESS), // Public Key of the Token Mint Address
    //   WALLET.publicKey, // Public Key of Owner's Wallet
    //   BURN_QUANTITY * (10**MINT_DECIMALS), // Number of tokens to burn
    //   MINT_DECIMALS // Number of Decimals of the Token Mint
    // )

  });

  it('won\'t mint', async () => {
    await checkState(program, authority, 1, 0, 1000);
    const [minterInfoPDA, _] = getMinterPDA(program, minterKeys.publicKey);
    await checkMinter(program, minterKeys);

    // await setupMint(program, authority, recipientKeys);

    try {
      await mint(program, impostorKeys, minterInfoPDA, recipientKeys, 1000, authority);
      chai.assert(false, "should've failed but didn't");
    } catch (_err) {
      expect(_err).to.be.instanceOf(AnchorError);
      const err: AnchorError = _err;
      expect(err.error.errorCode.code).to.equal('ConstraintSeeds');
      expect(err.program.equals(program.programId)).is.true;
    }
  });

  it('use two minters', async () => {
    await checkState(program, authority, 1, 0, 1000);
    const [minterInfoPDA, _] = getMinterPDA(program, minterKeys.publicKey);
    await checkMinter(program, minterKeys);
    const minter2InfoPDA = await addMinter(program, authority, minter2Keys.publicKey);
    await checkMinter(program, minter2Keys);
    await checkState(program, authority, 2, 0, 1000);
    // await setupMint(program, authority, recipientKeys);

    // cannot mint with wrong keys
    try {
      await mint(program, minter2Keys, minterInfoPDA, recipientKeys, 1000, authority);
      chai.assert(false, "should've failed but didn't");
    } catch (_err) {
      expect(_err).to.be.instanceOf(AnchorError);
      const err: AnchorError = _err;
      expect(err.error.errorCode.code).to.equal('ConstraintSeeds');
      expect(err.program.equals(program.programId)).is.true;
    }

    // cannot remove minter with wrong keys
    try {
      await removeMinter(program, authority, minter2Keys, minterInfoPDA);
      chai.assert(false, "should've failed but didn't");
    } catch (_err) {
      expect(_err).to.be.instanceOf(AnchorError);
      const err: AnchorError = _err;
      expect(err.error.errorCode.code).to.equal('ConstraintSeeds');
      expect(err.program.equals(program.programId)).is.true;
    }

    await mint(program, minterKeys, minterInfoPDA, recipientKeys, 500, authority);
    await checkState(program, authority, 2, 0, 1500);
  });

  it('remove minter', async () => {
    await checkState(program, authority, 2, 0, 1500);
    const [minter2InfoPDA, _] = getMinterPDA(program, minter2Keys.publicKey);
    await checkMinter(program, minter2Keys);
    await removeMinter(program, authority, minter2Keys, minter2InfoPDA);
    await checkState(program, authority, 1, 0, 1500);
  });

  it('won\'t remove minter', async () => {
    await checkState(program, authority, 1, 0, 1500);
    const [minterInfoPDA, _] = getMinterPDA(program, minterKeys.publicKey);
    await checkMinter(program, minterKeys);

    try {
      await removeMinter(program, impostorKeys, minterKeys, minterInfoPDA);
      chai.assert(false, "should've failed but didn't");
    } catch (_err) {
      expect(_err).to.be.instanceOf(AnchorError);
      const err: AnchorError = _err;
      expect(err.error.errorCode.code).to.equal('IsNotAuthority');
      expect(err.program.equals(program.programId)).is.true;
    }

    await removeMinter(program, authority, minterKeys, minterInfoPDA);
    await checkState(program, authority, 0, 0, 1500);

    try {
      await removeMinter(program, authority, minterKeys, minterInfoPDA);
      chai.assert(false, "should've failed but didn't");
    } catch (_err) {
      expect(_err).to.be.instanceOf(AnchorError);
      const err: AnchorError = _err;
      expect(err.error.errorCode.code).to.equal('AccountNotInitialized');
      expect(err.program.equals(program.programId)).is.true;
    }
  });

  it('add guardian', async () => {
    await checkState(program, authority, 0, 0, 1500);
    await addGuardian(program, authority, guardianKeys, authority);
    await checkGuardian(program, guardianKeys);
    await checkState(program, authority, 0, 1, 1500);

    try {
      await addGuardian(program, impostorKeys, guardian2Keys, authority);
      chai.assert(false, "should've failed but didn't");
    } catch (_err) {
      expect(_err).to.be.instanceOf(AnchorError);
      const err: AnchorError = _err;
      expect(err.error.errorCode.code).to.equal('IsNotAuthority');
      expect(err.program.equals(program.programId)).is.true;
    }
  });

  it('remove guardian', async () => {
    await checkState(program, authority, 0, 1, 1500);
    const [guardianInfoPDA, _] = getGuardianPDA(program, guardianKeys);
    await checkGuardian(program, guardianKeys);

    try {
      await removeGuardian(program, impostorKeys, guardianKeys, guardianInfoPDA);
      chai.assert(false, "should've failed but didn't");
    } catch (_err) {
      expect(_err).to.be.instanceOf(AnchorError);
      const err: AnchorError = _err;
      expect(err.error.errorCode.code).to.equal('IsNotAuthority');
      expect(err.program.equals(program.programId)).is.true;
    }

    await removeGuardian(program, authority, guardianKeys, guardianInfoPDA);
    await checkState(program, authority, 0, 0, 1500);

    try {
      await removeGuardian(program, authority, guardianKeys, guardianInfoPDA);
      chai.assert(false, "should've failed but didn't");
    } catch (_err) {
      expect(_err).to.be.instanceOf(AnchorError);
      const err: AnchorError = _err;
      expect(err.error.errorCode.code).to.equal('AccountNotInitialized');
      expect(err.program.equals(program.programId)).is.true;
    }
  });

  it('pause', async () => {
    await checkState(program, authority, 0, 0, 1500);
    await addGuardian(program, authority, guardianKeys, authority);
    await checkPaused(program, false);
    await pause(program, guardianKeys);
    await checkPaused(program, true);
  });

  it('unpause', async () => {
    await checkState(program, authority, 0, 1, 1500);
    await checkPaused(program, true);
    await unpause(program, authority);
    await checkPaused(program, false);

    try {
      await unpause(program, authority);

      chai.assert(false, "should've failed but didn't");
    } catch (_err) {
      expect(_err).to.be.instanceOf(AnchorError);
      const err: AnchorError = _err;
      expect(err.error.errorCode.code).to.equal('IsNotPaused');
      expect(err.program.equals(program.programId)).is.true;
    }
  });

  it('won\'t mint when paused', async () => {
    await checkState(program, authority, 0, 1, 1500);
    const minterInfoPDA = await addMinter(program, authority, minterKeys.publicKey);
    await pause(program, guardianKeys);
    // await setupMint(program, authority, recipientKeys);

    try {
      await mint(program, minterKeys, minterInfoPDA, recipientKeys, 1000, authority);
      chai.assert(false, "should've failed but didn't");
    } catch (_err) {
      expect(_err).to.be.instanceOf(AnchorError);
      const err: AnchorError = _err;
      expect(err.error.errorCode.code).to.equal('IsPaused');
      expect(err.program.equals(program.programId)).is.true;
    }

    await unpause(program, authority);
    await checkPaused(program, false);
  })

  it('use two guardians', async () => {
    await checkState(program, authority, 1, 1, 1500);
    const [guardianInfoPDA, _] = getGuardianPDA(program, guardianKeys);
    await checkGuardian(program, guardianKeys);
    await addGuardian(program, authority, guardian2Keys, authority);
    await checkGuardian(program, guardian2Keys);

    await pause(program, guardianKeys);

    try {
      await pause(program, guardian2Keys);
      chai.assert(false, "should've failed but didn't");
    } catch (_err) {
      expect(_err).to.be.instanceOf(AnchorError);
      const err: AnchorError = _err;
      expect(err.error.errorCode.code).to.equal('IsPaused');
      expect(err.program.equals(program.programId)).is.true;
    }

    await unpause(program, authority);
    await pause(program, guardian2Keys);
    await checkPaused(program, true);
    await unpause(program, authority);

    // cannot remove guardian with wrong keys
    try {
      await removeGuardian(program, authority, guardian2Keys, guardianInfoPDA);
      chai.assert(false, "should've failed but didn't");
    } catch (_err) {
      expect(_err).to.be.instanceOf(AnchorError);
      const err: AnchorError = _err;
      expect(err.error.errorCode.code).to.equal('ConstraintSeeds');
      expect(err.program.equals(program.programId)).is.true;
    }
  });
});