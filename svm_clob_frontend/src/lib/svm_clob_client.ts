import { 
  PublicKey, 
  SystemProgram, 
  SYSVAR_RENT_PUBKEY,
  Transaction,
  TransactionInstruction 
} from '@solana/web3.js';
import { Program, BN, web3 } from '@coral-xyz/anchor';
import { 
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction 
} from '@solana/spl-token';
import { 
  SvmClob, 
  OrderBook, 
  UserAccount, 
  Trade, 
  Order, 
  OrderSide, 
  OrderType 
} from '../types/svm_clob';

export class SvmClobClient {
  constructor(
    private program: Program<SvmClob>,
    private programId: PublicKey
  ) {}

  // Generate PDA addresses
  async getOrderbookAddress(
    baseMint: PublicKey, 
    quoteMint: PublicKey
  ): Promise<[PublicKey, number]> {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from('orderbook'),
        baseMint.toBuffer(),
        quoteMint.toBuffer()
      ],
      this.programId
    );
  }

  async getUserAccountAddress(user: PublicKey): Promise<[PublicKey, number]> {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from('user_account'),
        user.toBuffer()
      ],
      this.programId
    );
  }

  async getClobTokenVaultAddress(tokenMint: PublicKey): Promise<[PublicKey, number]> {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from('clob_vault'),
        tokenMint.toBuffer()
      ],
      this.programId
    );
  }

  // Initialize orderbook
  async initializeOrderbook(
    authority: PublicKey,
    baseMint: PublicKey,
    quoteMint: PublicKey,
    tickSize: BN,
    minOrderSize: BN
  ): Promise<TransactionInstruction> {
    const [orderbookPda] = await this.getOrderbookAddress(baseMint, quoteMint);

    return this.program.methods
      .initializeOrderbook(baseMint, quoteMint, tickSize, minOrderSize, authority)
      .accounts({
        orderbook: orderbookPda,
        authority,
        baseMint,
        quoteMint,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
  }

  // Initialize user account
  async initializeUserAccount(user: PublicKey): Promise<TransactionInstruction> {
    const [userAccountPda] = await this.getUserAccountAddress(user);

    return this.program.methods
      .initializeUserAccount()
      .accounts({
        userAccount: userAccountPda,
        user,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
  }

  // Deposit tokens
  async deposit(
    user: PublicKey,
    tokenMint: PublicKey,
    baseMint: PublicKey,
    quoteMint: PublicKey,
    amount: BN
  ): Promise<TransactionInstruction[]> {
    const [orderbookPda] = await this.getOrderbookAddress(baseMint, quoteMint);
    const [userAccountPda] = await this.getUserAccountAddress(user);
    const [clobTokenVaultPda] = await this.getClobTokenVaultAddress(tokenMint);
    
    const userTokenAccount = await getAssociatedTokenAddress(tokenMint, user);

    const instructions: TransactionInstruction[] = [];

    // Create CLOB token vault if needed (handled by init_if_needed in Anchor)
    const depositInstruction = await this.program.methods
      .deposit(amount)
      .accounts({
        orderbook: orderbookPda,
        userAccount: userAccountPda,
        userTokenAccount,
        tokenMint,
        clobTokenVault: clobTokenVaultPda,
        user,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .instruction();

    instructions.push(depositInstruction);
    return instructions;
  }

  // Withdraw tokens
  async withdraw(
    user: PublicKey,
    tokenMint: PublicKey,
    baseMint: PublicKey,
    quoteMint: PublicKey,
    amount: BN
  ): Promise<TransactionInstruction> {
    const [orderbookPda] = await this.getOrderbookAddress(baseMint, quoteMint);
    const [userAccountPda] = await this.getUserAccountAddress(user);
    const [clobTokenVaultPda] = await this.getClobTokenVaultAddress(tokenMint);
    
    const userTokenAccount = await getAssociatedTokenAddress(tokenMint, user);

    return this.program.methods
      .withdraw(amount)
      .accounts({
        orderbook: orderbookPda,
        userAccount: userAccountPda,
        userTokenAccount,
        tokenMint,
        clobTokenVault: clobTokenVaultPda,
        user,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
  }

  // Execute trade (admin only)
  async executeTrade(
    authority: PublicKey,
    baseMint: PublicKey,
    quoteMint: PublicKey,
    trade: Trade
  ): Promise<TransactionInstruction> {
    const [orderbookPda] = await this.getOrderbookAddress(baseMint, quoteMint);
    const [takerUserAccountPda] = await this.getUserAccountAddress(trade.taker);
    const [makerUserAccountPda] = await this.getUserAccountAddress(trade.maker);

    return this.program.methods
      .executeTrade(trade)
      .accounts({
        orderbook: orderbookPda,
        takerUserAccount: takerUserAccountPda,
        makerUserAccount: makerUserAccountPda,
        authority,
      })
      .instruction();
  }

  // Fetch orderbook data
  async getOrderbook(
    baseMint: PublicKey,
    quoteMint: PublicKey
  ): Promise<OrderBook | null> {
    try {
      const [orderbookPda] = await this.getOrderbookAddress(baseMint, quoteMint);
      return await this.program.account.orderBook.fetch(orderbookPda);
    } catch (error) {
      console.error('Error fetching orderbook:', error);
      return null;
    }
  }

  // Fetch user account data
  async getUserAccount(user: PublicKey): Promise<UserAccount | null> {
    try {
      const [userAccountPda] = await this.getUserAccountAddress(user);
      return await this.program.account.userAccount.fetch(userAccountPda);
    } catch (error) {
      console.error('Error fetching user account:', error);
      return null;
    }
  }

  // Check if user account exists
  async userAccountExists(user: PublicKey): Promise<boolean> {
    const userAccount = await this.getUserAccount(user);
    return userAccount !== null && userAccount.isInitialized === 1;
  }

  // Check if orderbook exists
  async orderbookExists(
    baseMint: PublicKey,
    quoteMint: PublicKey
  ): Promise<boolean> {
    const orderbook = await this.getOrderbook(baseMint, quoteMint);
    return orderbook !== null && orderbook.isInitialized === 1;
  }

  // Listen to trade events
  addEventListener(
    eventName: 'TradeSettled',
    callback: (event: any, slot: number, signature: string) => void
  ) {
    return this.program.addEventListener(eventName, callback);
  }

  removeEventListener(listenerId: number) {
    return this.program.removeEventListener(listenerId);
  }

  // Utility functions
  formatPrice(price: BN, decimals = 6): number {
    return price.toNumber() / Math.pow(10, decimals);
  }

  formatQuantity(quantity: BN, decimals = 6): number {
    return quantity.toNumber() / Math.pow(10, decimals);
  }

  parsePrice(price: number, decimals = 6): BN {
    return new BN(price * Math.pow(10, decimals));
  }

  parseQuantity(quantity: number, decimals = 6): BN {
    return new BN(quantity * Math.pow(10, decimals));
  }
}