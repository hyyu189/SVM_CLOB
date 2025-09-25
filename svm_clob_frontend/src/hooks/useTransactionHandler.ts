import { useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { 
  Transaction, 
  PublicKey, 
  TransactionInstruction,
  sendAndConfirmTransaction 
} from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { useSvmClobClient } from './useSvmClobClient';
import { useAnchorProvider } from '../contexts/AnchorProvider';
import toast from 'react-hot-toast';

export interface TransactionState {
  loading: boolean;
  error: string | null;
  signature: string | null;
}

export interface DepositParams {
  tokenMint: PublicKey;
  baseMint: PublicKey;
  quoteMint: PublicKey;
  amount: BN;
}

export interface WithdrawParams {
  tokenMint: PublicKey;
  baseMint: PublicKey;
  quoteMint: PublicKey;
  amount: BN;
}

export interface TradeParams {
  baseMint: PublicKey;
  quoteMint: PublicKey;
  trade: {
    takerOrderId: BN;
    makerOrderId: BN;
    taker: PublicKey;
    maker: PublicKey;
    price: BN;
    quantity: BN;
    takerSide: any;
    timestamp: BN;
  };
}

export const useTransactionHandler = () => {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const { provider } = useAnchorProvider();
  const client = useSvmClobClient();
  
  const [transactionState, setTransactionState] = useState<TransactionState>({
    loading: false,
    error: null,
    signature: null,
  });

  const resetState = () => {
    setTransactionState({
      loading: false,
      error: null,
      signature: null,
    });
  };

  const executeTransaction = async (
    instructions: TransactionInstruction[],
    description: string
  ): Promise<string | null> => {
    if (!publicKey || !provider) {
      throw new Error('Wallet not connected');
    }

    try {
      setTransactionState({ loading: true, error: null, signature: null });
      
      const transaction = new Transaction();
      instructions.forEach(ix => transaction.add(ix));
      
      // Get recent blockhash
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      toast.loading(`${description}...`);

      // Send transaction
      const signature = await sendTransaction(transaction, connection, {
        preflightCommitment: 'confirmed',
      });

      // Wait for confirmation
      const confirmation = await connection.confirmTransaction(signature, 'confirmed');
      
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${confirmation.value.err}`);
      }

      toast.dismiss();
      toast.success(`${description} successful!`);
      
      setTransactionState({ 
        loading: false, 
        error: null, 
        signature 
      });

      return signature;

    } catch (error: any) {
      console.error(`${description} error:`, error);
      const errorMessage = error.message || `${description} failed`;
      
      toast.dismiss();
      toast.error(errorMessage);
      
      setTransactionState({ 
        loading: false, 
        error: errorMessage, 
        signature: null 
      });

      return null;
    }
  };

  const initializeUserAccount = async (): Promise<string | null> => {
    if (!client || !publicKey) {
      throw new Error('Client not available or wallet not connected');
    }

    try {
      const instruction = await client.initializeUserAccount(publicKey);
      return await executeTransaction([instruction], 'Initializing user account');
    } catch (error: any) {
      console.error('Initialize user account error:', error);
      toast.error(error.message || 'Failed to initialize user account');
      return null;
    }
  };

  const deposit = async (params: DepositParams): Promise<string | null> => {
    if (!client || !publicKey) {
      throw new Error('Client not available or wallet not connected');
    }

    try {
      // Check if user account exists
      const userAccountExists = await client.userAccountExists(publicKey);
      
      if (!userAccountExists) {
        toast.error('User account not initialized. Please initialize your account first.');
        return null;
      }

      const instructions = await client.deposit(
        publicKey,
        params.tokenMint,
        params.baseMint,
        params.quoteMint,
        params.amount
      );

      const tokenSymbol = params.tokenMint.equals(params.baseMint) ? 'SOL' : 'USDC';
      const amount = params.amount.toNumber() / Math.pow(10, 6);
      
      return await executeTransaction(
        instructions, 
        `Depositing ${amount} ${tokenSymbol}`
      );
    } catch (error: any) {
      console.error('Deposit error:', error);
      toast.error(error.message || 'Failed to deposit tokens');
      return null;
    }
  };

  const withdraw = async (params: WithdrawParams): Promise<string | null> => {
    if (!client || !publicKey) {
      throw new Error('Client not available or wallet not connected');
    }

    try {
      // Check if user account exists
      const userAccountExists = await client.userAccountExists(publicKey);
      
      if (!userAccountExists) {
        toast.error('User account not found');
        return null;
      }

      // Check user balance
      const userAccount = await client.getUserAccount(publicKey);
      if (!userAccount) {
        toast.error('Failed to fetch user account');
        return null;
      }

      const isBaseToken = params.tokenMint.equals(params.baseMint);
      const userBalance = isBaseToken 
        ? userAccount.baseTokenBalance 
        : userAccount.quoteTokenBalance;

      if (userBalance.lt(params.amount)) {
        toast.error('Insufficient balance');
        return null;
      }

      const instruction = await client.withdraw(
        publicKey,
        params.tokenMint,
        params.baseMint,
        params.quoteMint,
        params.amount
      );

      const tokenSymbol = isBaseToken ? 'SOL' : 'USDC';
      const amount = params.amount.toNumber() / Math.pow(10, 6);
      
      return await executeTransaction(
        [instruction], 
        `Withdrawing ${amount} ${tokenSymbol}`
      );
    } catch (error: any) {
      console.error('Withdraw error:', error);
      toast.error(error.message || 'Failed to withdraw tokens');
      return null;
    }
  };

  const executeTrade = async (params: TradeParams): Promise<string | null> => {
    if (!client || !publicKey) {
      throw new Error('Client not available or wallet not connected');
    }

    try {
      // Note: This would typically be called by an authority/admin
      // In a real implementation, trades would be matched off-chain
      // and then settled on-chain by the matching engine
      
      const instruction = await client.executeTrade(
        publicKey, // This should be the authority address
        params.baseMint,
        params.quoteMint,
        params.trade
      );

      return await executeTransaction(
        [instruction], 
        'Executing trade'
      );
    } catch (error: any) {
      console.error('Execute trade error:', error);
      toast.error(error.message || 'Failed to execute trade');
      return null;
    }
  };

  const initializeOrderbook = async (
    baseMint: PublicKey,
    quoteMint: PublicKey,
    tickSize: BN,
    minOrderSize: BN
  ): Promise<string | null> => {
    if (!client || !publicKey) {
      throw new Error('Client not available or wallet not connected');
    }

    try {
      const instruction = await client.initializeOrderbook(
        publicKey,
        baseMint,
        quoteMint,
        tickSize,
        minOrderSize
      );

      return await executeTransaction(
        [instruction], 
        'Initializing orderbook'
      );
    } catch (error: any) {
      console.error('Initialize orderbook error:', error);
      toast.error(error.message || 'Failed to initialize orderbook');
      return null;
    }
  };

  // Utility function to estimate transaction fees
  const estimateTransactionFee = async (
    instructions: TransactionInstruction[]
  ): Promise<number> => {
    try {
      if (!publicKey) return 0;

      const transaction = new Transaction();
      instructions.forEach(ix => transaction.add(ix));
      
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      const fee = await transaction.getEstimatedFee(connection);
      return fee || 5000; // Default fee if estimation fails
    } catch (error) {
      console.error('Fee estimation error:', error);
      return 5000; // Default fee
    }
  };

  return {
    transactionState,
    resetState,
    initializeUserAccount,
    deposit,
    withdraw,
    executeTrade,
    initializeOrderbook,
    estimateTransactionFee,
  };
};