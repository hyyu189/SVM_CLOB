const anchor = require("@coral-xyz/anchor");
const spl = require("@solana/spl-token");
const { assert } = require("chai");

describe("svm_clob", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SvmClob;

  let authority;
  let taker;
  let maker;

  let baseMint;
  let quoteMint;

  let takerBaseTokenAccount;
  let takerQuoteTokenAccount;
  let makerBaseTokenAccount;
  let makerQuoteTokenAccount;

  let orderbookPda;
  let takerAccountPda;
  let makerAccountPda;
  let clobBaseVault;
  let clobQuoteVault;

  const BASE_DEPOSIT = new anchor.BN(50);
  const QUOTE_DEPOSIT = new anchor.BN(100);
  const TRADE_QUANTITY = new anchor.BN(10);
  const TRADE_PRICE = new anchor.BN(4);

  async function airdrop(publicKey) {
    const signature = await provider.connection.requestAirdrop(
      publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    const latestBlockhash = await provider.connection.getLatestBlockhash();
    await provider.connection.confirmTransaction({
      signature,
      ...latestBlockhash,
    });
  }

  before(async () => {
    authority = anchor.web3.Keypair.generate();
    taker = anchor.web3.Keypair.generate();
    maker = anchor.web3.Keypair.generate();

    await Promise.all([
      airdrop(authority.publicKey),
      airdrop(taker.publicKey),
      airdrop(maker.publicKey),
    ]);

    baseMint = await spl.createMint(
      provider.connection,
      authority,
      authority.publicKey,
      null,
      0
    );
    quoteMint = await spl.createMint(
      provider.connection,
      authority,
      authority.publicKey,
      null,
      0
    );

    makerBaseTokenAccount = await spl.createAccount(
      provider.connection,
      maker,
      baseMint,
      maker.publicKey
    );
    makerQuoteTokenAccount = await spl.createAccount(
      provider.connection,
      maker,
      quoteMint,
      maker.publicKey
    );
    takerBaseTokenAccount = await spl.createAccount(
      provider.connection,
      taker,
      baseMint,
      taker.publicKey
    );
    takerQuoteTokenAccount = await spl.createAccount(
      provider.connection,
      taker,
      quoteMint,
      taker.publicKey
    );

    await spl.mintTo(
      provider.connection,
      authority,
      baseMint,
      makerBaseTokenAccount,
      authority,
      100n
    );
    await spl.mintTo(
      provider.connection,
      authority,
      quoteMint,
      takerQuoteTokenAccount,
      authority,
      200n
    );

    [orderbookPda] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("orderbook"), baseMint.toBuffer(), quoteMint.toBuffer()],
      program.programId
    );

    [takerAccountPda] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("user_account"), taker.publicKey.toBuffer()],
      program.programId
    );

    [makerAccountPda] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("user_account"), maker.publicKey.toBuffer()],
      program.programId
    );

    [clobBaseVault] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("clob_vault"), baseMint.toBuffer()],
      program.programId
    );

    [clobQuoteVault] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("clob_vault"), quoteMint.toBuffer()],
      program.programId
    );
  });

  it("initializes orderbook and user accounts", async () => {
    const tickSize = new anchor.BN(1);
    const minOrderSize = new anchor.BN(1);

    await program.methods
      .initializeOrderbook(
        baseMint,
        quoteMint,
        tickSize,
        minOrderSize,
        authority.publicKey
      )
      .accounts({
        orderbook: orderbookPda,
        authority: authority.publicKey,
        baseMint,
        quoteMint,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    await program.methods
      .initializeUserAccount()
      .accounts({
        userAccount: takerAccountPda,
        user: taker.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([taker])
      .rpc();

    await program.methods
      .initializeUserAccount()
      .accounts({
        userAccount: makerAccountPda,
        user: maker.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([maker])
      .rpc();

    const orderbook = await program.account.orderBook.fetch(orderbookPda);
    assert.ok(orderbook.authority.equals(authority.publicKey));
    assert.ok(orderbook.baseMint.equals(baseMint));
    assert.ok(orderbook.quoteMint.equals(quoteMint));

    const takerAccount = await program.account.userAccount.fetch(
      takerAccountPda
    );
    const makerAccount = await program.account.userAccount.fetch(
      makerAccountPda
    );

    assert.ok(takerAccount.owner.equals(taker.publicKey));
    assert.ok(makerAccount.owner.equals(maker.publicKey));
  });

  it("deposits base and quote assets", async () => {
    await program.methods
      .deposit(BASE_DEPOSIT)
      .accounts({
        orderbook: orderbookPda,
        userAccount: makerAccountPda,
        userTokenAccount: makerBaseTokenAccount,
        tokenMint: baseMint,
        clobTokenVault: clobBaseVault,
        user: maker.publicKey,
        tokenProgram: spl.TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([maker])
      .rpc();

    await program.methods
      .deposit(QUOTE_DEPOSIT)
      .accounts({
        orderbook: orderbookPda,
        userAccount: takerAccountPda,
        userTokenAccount: takerQuoteTokenAccount,
        tokenMint: quoteMint,
        clobTokenVault: clobQuoteVault,
        user: taker.publicKey,
        tokenProgram: spl.TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([taker])
      .rpc();

    const makerAccount = await program.account.userAccount.fetch(
      makerAccountPda
    );
    const takerAccount = await program.account.userAccount.fetch(
      takerAccountPda
    );

    assert.equal(makerAccount.baseTokenBalance.toNumber(), BASE_DEPOSIT.toNumber());
    assert.equal(takerAccount.quoteTokenBalance.toNumber(), QUOTE_DEPOSIT.toNumber());

    const baseVaultBalance = await provider.connection.getTokenAccountBalance(
      clobBaseVault
    );
    const quoteVaultBalance = await provider.connection.getTokenAccountBalance(
      clobQuoteVault
    );

    assert.equal(Number(baseVaultBalance.value.amount), BASE_DEPOSIT.toNumber());
    assert.equal(Number(quoteVaultBalance.value.amount), QUOTE_DEPOSIT.toNumber());
  });

  it("rejects deposits with unsupported mints", async () => {
    const invalidMint = await spl.createMint(
      provider.connection,
      authority,
      authority.publicKey,
      null,
      0
    );
    const invalidTokenAccount = await spl.createAccount(
      provider.connection,
      maker,
      invalidMint,
      maker.publicKey
    );
    await spl.mintTo(
      provider.connection,
      authority,
      invalidMint,
      invalidTokenAccount,
      authority,
      10n
    );

    const [invalidVault] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("clob_vault"), invalidMint.toBuffer()],
      program.programId
    );

    try {
      await program.methods
        .deposit(new anchor.BN(5))
        .accounts({
          orderbook: orderbookPda,
          userAccount: makerAccountPda,
          userTokenAccount: invalidTokenAccount,
          tokenMint: invalidMint,
          clobTokenVault: invalidVault,
          user: maker.publicKey,
          tokenProgram: spl.TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([maker])
        .rpc();
      assert.fail("deposit should have failed for unsupported mint");
    } catch (err) {
      const errorCode = err.error?.errorCode?.code;
      assert.equal(errorCode, "InvalidMint");
    }
  });

  it("executes trade and updates balances", async () => {
    const trade = {
      takerOrderId: new anchor.BN(1),
      makerOrderId: new anchor.BN(2),
      taker: taker.publicKey,
      maker: maker.publicKey,
      price: TRADE_PRICE,
      quantity: TRADE_QUANTITY,
      takerSide: { bid: {} },
      timestamp: new anchor.BN(Math.floor(Date.now() / 1000)),
    };

    await program.methods
      .executeTrade(trade)
      .accounts({
        orderbook: orderbookPda,
        takerUserAccount: takerAccountPda,
        makerUserAccount: makerAccountPda,
        authority: authority.publicKey,
      })
      .signers([authority])
      .rpc();

    const takerAccount = await program.account.userAccount.fetch(
      takerAccountPda
    );
    const makerAccount = await program.account.userAccount.fetch(
      makerAccountPda
    );
    const orderbook = await program.account.orderBook.fetch(orderbookPda);

    const expectedQuoteSpent = TRADE_PRICE.mul(TRADE_QUANTITY);

    assert.equal(orderbook.totalVolume.toNumber(), TRADE_QUANTITY.toNumber());
    assert.equal(takerAccount.baseTokenBalance.toNumber(), TRADE_QUANTITY.toNumber());
    assert.equal(
      takerAccount.quoteTokenBalance.toNumber(),
      QUOTE_DEPOSIT.sub(expectedQuoteSpent).toNumber()
    );
    assert.equal(
      makerAccount.baseTokenBalance.toNumber(),
      BASE_DEPOSIT.sub(TRADE_QUANTITY).toNumber()
    );
    assert.equal(
      makerAccount.quoteTokenBalance.toNumber(),
      expectedQuoteSpent.toNumber()
    );
    assert.equal(
      takerAccount.totalVolumeTraded.toNumber(),
      TRADE_QUANTITY.toNumber()
    );
    assert.equal(
      makerAccount.totalVolumeTraded.toNumber(),
      TRADE_QUANTITY.toNumber()
    );
  });

  it("withdraws settled balances", async () => {
    const quoteFilled = TRADE_PRICE.mul(TRADE_QUANTITY);

    await program.methods
      .withdraw(TRADE_QUANTITY)
      .accounts({
        orderbook: orderbookPda,
        userAccount: takerAccountPda,
        userTokenAccount: takerBaseTokenAccount,
        tokenMint: baseMint,
        clobTokenVault: clobBaseVault,
        user: taker.publicKey,
        tokenProgram: spl.TOKEN_PROGRAM_ID,
      })
      .signers([taker])
      .rpc();

    await program.methods
      .withdraw(quoteFilled)
      .accounts({
        orderbook: orderbookPda,
        userAccount: makerAccountPda,
        userTokenAccount: makerQuoteTokenAccount,
        tokenMint: quoteMint,
        clobTokenVault: clobQuoteVault,
        user: maker.publicKey,
        tokenProgram: spl.TOKEN_PROGRAM_ID,
      })
      .signers([maker])
      .rpc();

    const takerAccount = await program.account.userAccount.fetch(
      takerAccountPda
    );
    const makerAccount = await program.account.userAccount.fetch(
      makerAccountPda
    );

    assert.equal(takerAccount.baseTokenBalance.toNumber(), 0);
    assert.equal(makerAccount.quoteTokenBalance.toNumber(), 0);

    const baseVaultBalance = await provider.connection.getTokenAccountBalance(
      clobBaseVault
    );
    const quoteVaultBalance = await provider.connection.getTokenAccountBalance(
      clobQuoteVault
    );

    assert.equal(
      Number(baseVaultBalance.value.amount),
      BASE_DEPOSIT.sub(TRADE_QUANTITY).toNumber()
    );
    assert.equal(
      Number(quoteVaultBalance.value.amount),
      QUOTE_DEPOSIT.sub(quoteFilled).toNumber()
    );
  });
});
