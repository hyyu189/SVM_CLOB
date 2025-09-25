import { useMemo } from 'react';
import { useAnchorProvider } from '../contexts/AnchorProvider';
import { SvmClobClient } from '../lib/svm_clob_client';

export const useSvmClobClient = () => {
  const { program, programId } = useAnchorProvider();

  const client = useMemo(() => {
    if (!program || !programId) return null;
    return new SvmClobClient(program, programId);
  }, [program, programId]);

  return client;
};