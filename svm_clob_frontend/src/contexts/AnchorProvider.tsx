import React, { createContext, useContext, useMemo } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { AnchorProvider, Program, setProvider, Idl } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import toast from 'react-hot-toast';
import { CONFIG } from '../config/config';
import { SvmClobIDL } from '../types/svm_clob';
import SvmClobIDLJson from '../idl/svm_clob.json';

interface AnchorContextType {
  provider: AnchorProvider | null;
  program: Program<SvmClobIDL> | null;
  programId: PublicKey;
}

const AnchorContext = createContext<AnchorContextType>({
  provider: null,
  program: null,
  programId: new PublicKey('7YtJ5eYw1am3m73Yw2sh1QPWek3Ux17Ju1tp263h7YJB'),
});

export const useAnchorProvider = () => {
  const context = useContext(AnchorContext);
  if (!context) {
    throw new Error('useAnchorProvider must be used within AnchorProviderWrapper');
  }
  return context;
};

interface AnchorProviderWrapperProps {
  children: React.ReactNode;
}

export const AnchorProviderWrapper: React.FC<AnchorProviderWrapperProps> = ({ children }) => {
  const { connection } = useConnection();
  const wallet = useWallet();

  const programId = useMemo(() => {
    return new PublicKey('7YtJ5eYw1am3m73Yw2sh1QPWek3Ux17Ju1tp263h7YJB');
  }, []);

  const provider = useMemo(() => {
    if (CONFIG.USE_MOCK_API) {
      return null;
    }

    if (!wallet.publicKey) return null;

    try {
      const anchorProvider = new AnchorProvider(
        connection,
        wallet as any,
        {
          commitment: 'confirmed',
          preflightCommitment: 'confirmed',
        }
      );
      setProvider(anchorProvider);
      return anchorProvider;
    } catch (error) {
      console.error('Failed to create Anchor provider:', error);
      toast.error('Failed to initialize Anchor provider');
      return null;
    }
  }, [connection, wallet]);

  const program = useMemo(() => {
    if (!provider || CONFIG.USE_MOCK_API) return null;

    try {
      return new Program<SvmClobIDL>(SvmClobIDLJson as unknown as SvmClobIDL, provider);
    } catch (error) {
      console.error('Failed to create program instance:', error);
      toast.error('Failed to initialize program');
      return null;
    }
  }, [provider]);

  const value = useMemo(() => ({
    provider,
    program,
    programId,
  }), [provider, program, programId]);

  return (
    <AnchorContext.Provider value={value}>
      {children}
    </AnchorContext.Provider>
  );
};
