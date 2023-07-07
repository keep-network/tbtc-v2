import {
  getOrCreateAssociatedTokenAccount,
  createMint,
  Account,
} from "@solana/spl-token"
import { Keypair, PublicKey, Connection } from "@solana/web3.js"
import { Program, Provider, BN } from "@project-serum/anchor"
import expect from "expect"
import { loadContract, loadKey } from "./setup"

describe("SolanaTBTC token", function () {
  this.timeout(500000)

  let program: Program
  let storage: Keypair
  let payer: Keypair
  let thirdParty: Keypair
  let provider: Provider
  let authority: Keypair
  let guardianAuthority: Keypair
  let connection: Connection

  before(async () => {
    payer = loadKey("payer.key") // SolanaTBTC authority (deployer)
    thirdParty = loadKey("thirdParty.key") // third party account
    authority = Keypair.generate() // mint authority
    guardianAuthority = Keypair.generate() // guardians can freeze minting
    ;({ provider, storage, program } = await loadContract("SolanaTBTC", [
      payer.publicKey,
    ]))

    connection = provider.connection
  })

  describe("adding and removing minters", () => {
    it("should check for empty minters array", async () => {
      const minters = await program.methods
        .getMinters()
        .accounts({ dataAccount: storage.publicKey })
        .view()

      expect(minters.length).toEqual(0)
    })

    it("should add a minter", async () => {
      await program.methods
        .addMinter(authority.publicKey)
        .accounts({ dataAccount: storage.publicKey })
        .remainingAccounts([
          { pubkey: payer.publicKey, isSigner: true, isWritable: true },
        ])
        .signers([payer])
        .rpc()

      const minters = await program.methods
        .getMinters()
        .accounts({ dataAccount: storage.publicKey })
        .view()

      expect(minters.length).toEqual(1)
      expect(minters[0]).toEqual(authority.publicKey)
    })

    it("should remove a minter", async () => {
      await program.methods
        .removeMinter(authority.publicKey)
        .accounts({ dataAccount: storage.publicKey })
        .remainingAccounts([
          { pubkey: payer.publicKey, isSigner: true, isWritable: true },
        ])
        .signers([payer])
        .rpc()

      const minters = await program.methods
        .getMinters()
        .accounts({ dataAccount: storage.publicKey })
        .view()

      expect(minters.length).toEqual(0)
    })
  })

  describe("when a caller has no `mint setting` authority", () => {
    it("should revert", async () => {
      const mint = await createMint(
        connection,
        payer,
        authority.publicKey, // mint authority
        guardianAuthority.publicKey, // freeze authority
        18 // 18 decimals like TBTC on Ethereum
      )

      // third party is not the owner (authority)
      try {
        await program.methods
          .setMint(mint)
          .accounts({ dataAccount: storage.publicKey })
          .remainingAccounts([
            { pubkey: thirdParty.publicKey, isSigner: true, isWritable: true },
          ])
          .signers([thirdParty])
          .rpc()
      } catch (e: any) {
        expect(e.logs).toContain("Program log: Not signed by authority")
      }
    })
  })

  describe("when a caller has no 'adding a minter' authority", () => {
    it("should revert", async () => {
      // third party has no authority
      try {
        await program.methods
          .addMinter(authority.publicKey)
          .accounts({ dataAccount: storage.publicKey })
          .remainingAccounts([
            { pubkey: thirdParty.publicKey, isSigner: true, isWritable: true },
          ])
          .signers([thirdParty])
          .rpc()
      } catch (e: any) {
        expect(e.logs).toContain("Program log: Not signed by authority")
      }
    })
  })

  describe("when a caller is not a minter", () => {
    it("should revert", async () => {
      const mint = await createMint(
        connection,
        payer,
        authority.publicKey, // mint authority
        guardianAuthority.publicKey, // freeze authority
        18 // 18 decimals like TBTC on Ethereum
      )

      const tokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        mint,
        payer.publicKey
      )

      await program.methods
        .addMinter(payer.publicKey)
        .accounts({ dataAccount: storage.publicKey })
        .remainingAccounts([
          { pubkey: payer.publicKey, isSigner: true, isWritable: true },
        ])
        .signers([payer])
        .rpc()

      try {
        await program.methods
          .mintTo(tokenAccount.address, thirdParty.publicKey, new BN(100000))
          .accounts({ dataAccount: storage.publicKey })
          .remainingAccounts([
            { pubkey: mint, isSigner: false, isWritable: true },
            { pubkey: tokenAccount.address, isSigner: false, isWritable: true },
            { pubkey: thirdParty.publicKey, isSigner: true, isWritable: true },
          ])
          .signers([thirdParty])
          .rpc()
      } catch (e: any) {
        expect(e.logs).toContain("Program log: Not a minter")
      }
    })
  })

  describe("when callers have authority", () => {
    let mint: PublicKey
    let tokenAccount: Account
    let otherTokenAccount: Account
    let balance: BN
    let totalSupply: BN

    it("should create a mint account and a token account with 0 balance", async () => {
      mint = await createMint(
        connection,
        payer,
        authority.publicKey, // mint authority
        guardianAuthority.publicKey, // aka freeze authority
        18 // 18 decimals like TBTC on Ethereum
      )

      // payer is the owner (authority)
      await program.methods
        .setMint(mint)
        .accounts({ dataAccount: storage.publicKey })
        .remainingAccounts([
          { pubkey: payer.publicKey, isSigner: true, isWritable: true },
        ])
        .signers([payer])
        .rpc()

      totalSupply = await program.methods
        .totalSupply()
        .accounts({ dataAccount: storage.publicKey })
        .remainingAccounts([
          { pubkey: mint, isSigner: false, isWritable: false },
        ])
        .view()

      expect(totalSupply.toNumber()).toBe(0)

      tokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        mint,
        payer.publicKey
      )

      balance = await program.methods
        .getBalance(tokenAccount.address)
        .accounts({ dataAccount: storage.publicKey })
        .remainingAccounts([
          { pubkey: tokenAccount.address, isSigner: false, isWritable: false },
        ])
        .view()

      expect(balance.toNumber()).toBe(0)
    })

    it("should mint tokens", async () => {
      await program.methods
        .addMinter(authority.publicKey)
        .accounts({ dataAccount: storage.publicKey })
        .remainingAccounts([
          { pubkey: payer.publicKey, isSigner: true, isWritable: true },
        ])
        .signers([payer])
        .rpc()

      await program.methods
        .mintTo(tokenAccount.address, authority.publicKey, new BN(100000))
        .accounts({ dataAccount: storage.publicKey })
        .remainingAccounts([
          { pubkey: mint, isSigner: false, isWritable: true },
          { pubkey: tokenAccount.address, isSigner: false, isWritable: true },
          { pubkey: authority.publicKey, isSigner: true, isWritable: true },
        ])
        .signers([authority])
        .rpc()

      // check the balances
      totalSupply = await program.methods
        .totalSupply()
        .accounts({ dataAccount: storage.publicKey })
        .remainingAccounts([
          { pubkey: mint, isSigner: false, isWritable: false },
        ])
        .view()

      expect(totalSupply.toNumber()).toBe(100000)
      balance = await program.methods
        .getBalance(tokenAccount.address)
        .accounts({ dataAccount: storage.publicKey })
        .remainingAccounts([
          { pubkey: tokenAccount.address, isSigner: false, isWritable: false },
        ])
        .view()

      expect(balance.toNumber()).toBe(100000)
    })

    it("should transfer tokens", async () => {
      otherTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        mint,
        thirdParty.publicKey
      )

      await program.methods
        .transfer(
          tokenAccount.address,
          otherTokenAccount.address,
          payer.publicKey,
          new BN(70000)
        )
        .accounts({ dataAccount: storage.publicKey })
        .remainingAccounts([
          {
            pubkey: otherTokenAccount.address,
            isSigner: false,
            isWritable: true,
          },
          { pubkey: tokenAccount.address, isSigner: false, isWritable: true },
          { pubkey: payer.publicKey, isSigner: true, isWritable: true },
        ])
        .signers([payer])
        .rpc()

      totalSupply = await program.methods
        .totalSupply()
        .accounts({ dataAccount: storage.publicKey })
        .remainingAccounts([
          { pubkey: mint, isSigner: false, isWritable: false },
        ])
        .view()

      expect(totalSupply.toNumber()).toBe(100000)
      balance = await program.methods
        .getBalance(tokenAccount.address)
        .accounts({ dataAccount: storage.publicKey })
        .remainingAccounts([
          { pubkey: tokenAccount.address, isSigner: false, isWritable: false },
        ])
        .view()

      expect(balance.toNumber()).toBe(30000)

      balance = await program.methods
        .getBalance(otherTokenAccount.address)
        .accounts({ dataAccount: storage.publicKey })
        .remainingAccounts([
          {
            pubkey: otherTokenAccount.address,
            isSigner: false,
            isWritable: false,
          },
        ])
        .view()

      expect(balance.toNumber()).toBe(70000)
    })

    it("should burn tokens", async () => {
      await program.methods
        .burn(otherTokenAccount.address, thirdParty.publicKey, new BN(20000))
        .accounts({ dataAccount: storage.publicKey })
        .remainingAccounts([
          {
            pubkey: otherTokenAccount.address,
            isSigner: false,
            isWritable: true,
          },
          { pubkey: mint, isSigner: false, isWritable: true },
          { pubkey: thirdParty.publicKey, isSigner: true, isWritable: true },
        ])
        .signers([thirdParty])
        .rpc()

      totalSupply = await program.methods
        .totalSupply()
        .accounts({ dataAccount: storage.publicKey })
        .remainingAccounts([
          { pubkey: mint, isSigner: false, isWritable: false },
        ])
        .view()

      expect(totalSupply.toNumber()).toBe(80000)
      balance = await program.methods
        .getBalance(tokenAccount.address)
        .accounts({ dataAccount: storage.publicKey })
        .remainingAccounts([
          { pubkey: tokenAccount.address, isSigner: false, isWritable: false },
        ])
        .view()

      expect(balance.toNumber()).toBe(30000)

      balance = await program.methods
        .getBalance(otherTokenAccount.address)
        .accounts({ dataAccount: storage.publicKey })
        .remainingAccounts([
          {
            pubkey: otherTokenAccount.address,
            isSigner: false,
            isWritable: false,
          },
        ])
        .view()

      expect(balance.toNumber()).toBe(50000)
    })
  })
})
