import { useMemo } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { useAnchorProvider } from '../contexts/AnchorProvider';
import { SvmClobClient } from '../lib/svm_clob_client';
import { isMockMode } from '../config/mode';

export const useSvmClobClient = () => {
  const { program, programId } = useAnchorProvider();
  const { connection } = useConnection();

  const client = useMemo(() => {
    if (isMockMode() || !program || !programId || !connection) return null;

    const env = import.meta.env;
    const apiBase = (env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:8080/api/v1';
    const normalizedApiBase = apiBase.replace(/\/?api\/(v1)\/?$/i, '');

    const apiConfig = {
      apiUrl: normalizedApiBase,
      wsUrl: (env.VITE_WS_BASE_URL as string | undefined) || 'ws://localhost:8081/ws',
      authToken: env.VITE_AUTH_TOKEN as string | undefined,
    };

    return new SvmClobClient(program, programId, connection, apiConfig);
  }, [program, programId, connection]);

  return client;
};
