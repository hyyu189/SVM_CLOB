import { useMemo } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { useAnchorProvider } from '../contexts/AnchorProvider';
import { SvmClobClient } from '../lib/svm_clob_client';

export const useSvmClobClient = () => {
  const { program, programId } = useAnchorProvider();
  const { connection } = useConnection();

  const client = useMemo(() => {
    if (!program || !programId || !connection) return null;
    
    // Configuration for API endpoints
    const apiConfig = {
      apiUrl: process.env.REACT_APP_API_URL || 'http://localhost:8080',
      wsUrl: process.env.REACT_APP_WS_URL || 'ws://localhost:8081/ws',
      authToken: process.env.REACT_APP_AUTH_TOKEN // Optional JWT token
    };

    return new SvmClobClient(program, programId, connection, apiConfig);
  }, [program, programId, connection]);

  return client;
};