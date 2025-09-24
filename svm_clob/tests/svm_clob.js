const anchor = require("@coral-xyz/anchor");
const spl = require("@solana/spl-token");
const { assert } = require("chai");

describe("svm_clob", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SvmClob;

  let authority, user;
  let baseMint, quoteMint;
  let userBaseTokenAccount, userQuoteTokenAccount;
  let clobBaseVault, clobQuoteVault;
  let orderbookPda, userAccountPda;

  before(async () => {
    authority = anchor.web3.Keypair.generate();
    user = anchor.web3.Keypair.generate();

    // Airdrop SOL to authority and user
    const authorityAirdropSig = await provider.connection.requestAirdrop(authority.publicKey, 100 * anchor.web3.LAMPORTS_PER_SOL);
    let latestBlockhash = await provider.connection.getLatestBlockhash();
    await provider.connection.confirmTransaction({
      signature: authorityAirdropSig,
      ...latestBlockhash,
    });

    const userAirdropSig = await provider.connection.requestAirdrop(user.publicKey, 100 * anchor.web3.LAMPORTS_PER_SOL);
    latestBlockhash = await provider.connection.getLatestBlockhash();
    await provider.connection.confirmTransaction({
      signature: userAirdropSig,
      ...latestBlockhash,
    });

    // Create mints
    baseMint = await spl.createMint(provider.connection, authority, authority.publicKey, null, 6);
    quoteMint = await spl.createMint(provider.connection, authority, authority.publicKey, null, 6);

    // Create token accounts
    userBaseTokenAccount = await spl.createAccount(provider.connection, user, baseMint, user.publicKey);
    userQuoteTokenAccount = await spl.createAccount(provider.connection, user, quoteMint, user.publicKey);

    // Mint tokens to user
    await spl.mintTo(provider.connection, authority, baseMint, userBaseTokenAccount, authority, 1000e6);
    await spl.mintTo(provider.connection, authority, quoteMint, userQuoteTokenAccount, authority, 1000e6);
  });

  it("Initializes the orderbook", async () => {
    const tick_size = new anchor.BN(100); // e.g., 0.0001
    const min_order_size = new anchor.BN(10000); // e.g., 0.1

    [orderbookPda] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("orderbook"), baseMint.toBuffer(), quoteMint.toBuffer()],
      program.programId
    );

    await program.methods
      .initializeOrderbook(baseMint, quoteMint, tick_size, min_order_size, authority.publicKey)
      .accounts({
        orderbook: orderbookPda,
        authority: authority.publicKey,
        baseMint: baseMint,
        quoteMint: quoteMint,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    const orderbookState = await program.account.orderBook.fetch(orderbookPda);
    assert.ok(orderbookState.authority.equals(authority.publicKey));
    assert.ok(orderbookState.baseMint.equals(baseMint));
    assert.ok(orderbookState.quoteMint.equals(quoteMint));
  });

  it("Initializes a user account", async () => {
    [userAccountPda] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("user_account"), user.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .initializeUserAccount()
      .accounts({
        userAccount: userAccountPda,
        user: user.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([user])
      .rpc();

    const userAccountState = await program.account.userAccount.fetch(userAccountPda);
    assert.ok(userAccountState.owner.equals(user.publicKey));
    assert.equal(userAccountState.openOrdersCount.toNumber(), 0);
  });

  it("Deposits funds into the CLOB", async () => {
    const depositAmount = new anchor.BN(100e6); // 100 base tokens
    const quoteDepositAmount = new anchor.BN(10000 * 1e6); // 10000 quote tokens

    // Find vault PDAs
    [clobBaseVault] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("clob_vault"), baseMint.toBuffer()],
      program.programId
    );
    [clobQuoteVault] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("clob_vault"), quoteMint.toBuffer()],
      program.programId
    );

    // Deposit base tokens
    await program.methods
      .deposit(depositAmount)
      .accounts({
        orderbook: orderbookPda,
        userAccount: userAccountPda,
        userTokenAccount: userBaseTokenAccount,
        clobTokenVault: clobBaseVault,
        user: user.publicKey,
        tokenProgram: spl.TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([user])
      .rpc();

    let userAccountState = await program.account.userAccount.fetch(userAccountPda);
    assert.equal(userAccountState.baseTokenBalance.toNumber(), depositAmount.toNumber());

    let vaultBalance = await provider.connection.getTokenAccountBalance(clobBaseVault);
    assert.equal(vaultBalance.value.uiAmount, 100);

    // Deposit quote tokens
    await program.methods
      .deposit(quoteDepositAmount)
      .accounts({
        orderbook: orderbookPda,
        userAccount: userAccountPda,
        userTokenAccount: userQuoteTokenAccount,
        clobTokenVault: clobQuoteVault,
        user: user.publicKey,
        tokenProgram: spl.TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([user])
      .rpc();

    userAccountState = await program.account.userAccount.fetch(userAccountPda);
    assert.equal(userAccountState.quoteTokenBalance.toNumber(), quoteDepositAmount.toNumber());
    
    const quoteVaultBalance = await provider.connection.getTokenAccountBalance(clobQuoteVault);
    assert.equal(quoteVaultBalance.value.uiAmount, 10000);
  });

  it("Places a limit order", async () => {
    const clientOrderId = new anchor.BN(1);
    const price = new anchor.BN(100 * 1e6); // Price: 100
    const quantity = new anchor.BN(10 * 1e6); // Quantity: 10

    const [orderPda] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("order"), user.publicKey.toBuffer(), clientOrderId.toBuffer("le", 8)],
      program.programId
    );

    await program.methods
      .placeOrder(
        clientOrderId,
        0, // Side: Bid
        0, // Order Type: Limit
        price,
        quantity,
        0, // Time in Force: GTC
        new anchor.BN(0), // Expiry timestamp
        0 // Self-trade behavior
      )
      .accounts({
        order: orderPda,
        orderbook: orderbookPda,
        userAccount: userAccountPda,
        user: user.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([user])
      .rpc();

    const orderState = await program.account.order.fetch(orderPda);
    assert.ok(orderState.owner.equals(user.publicKey));
    assert.equal(orderState.price.toNumber(), price.toNumber());
    assert.equal(orderState.quantity.toNumber(), quantity.toNumber());

    const userAccountState = await program.account.userAccount.fetch(userAccountPda);
    assert.equal(userAccountState.openOrdersCount.toNumber(), 1);
  });

  it("Cancels an order", async () => {
    const clientOrderId = new anchor.BN(1);

    const [orderPda] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("order"), user.publicKey.toBuffer(), clientOrderId.toBuffer("le", 8)],
      program.programId
    );

    await program.methods
      .cancelOrder()
      .accounts({
        order: orderPda,
        orderbook: orderbookPda,
        userAccount: userAccountPda,
        user: user.publicKey,
      })
      .signers([user])
      .rpc();

    const orderState = await program.account.order.fetch(orderPda);
    assert.equal(orderState.status, 3); // Status: Cancelled

    const userAccountState = await program.account.userAccount.fetch(userAccountPda);
    assert.equal(userAccountState.openOrdersCount.toNumber(), 0);
  });

  it("Withdraws funds from the CLOB", async () => {
    const withdrawAmount = new anchor.BN(50e6); // 50 tokens

    await program.methods
      .withdraw(withdrawAmount)
      .accounts({
        orderbook: orderbookPda,
        userAccount: userAccountPda,
        userTokenAccount: userBaseTokenAccount,
        clobTokenVault: clobBaseVault,
        user: user.publicKey,
        tokenProgram: spl.TOKEN_PROGRAM_ID,
      })
      .signers([user])
      .rpc();

    const userAccountState = await program.account.userAccount.fetch(userAccountPda);
    assert.equal(userAccountState.baseTokenBalance.toNumber(), 50e6);

    const vaultBalance = await provider.connection.getTokenAccountBalance(clobBaseVault);
    assert.equal(vaultBalance.value.uiAmount, 50);
  });
});
