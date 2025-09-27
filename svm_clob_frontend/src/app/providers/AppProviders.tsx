import { ReactNode, useMemo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { WalletContextProvider } from '../../contexts/WalletContext';
import { AnchorProviderWrapper } from '../../contexts/AnchorProvider';
import { AppServicesProvider } from './ServiceProvider';
import { CONFIG } from '../../config/config';

interface AppProvidersProps {
  children: ReactNode;
}

const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

export const AppProviders = ({ children }: AppProvidersProps) => {
  const queryClient = useMemo(createQueryClient, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AppServicesProvider>
        <WalletContextProvider>
          <AnchorProviderWrapper>
            {children}
          </AnchorProviderWrapper>
        </WalletContextProvider>
      </AppServicesProvider>
      {CONFIG.ENABLE_DEVTOOLS ? <ReactQueryDevtools position="bottom-right" /> : null}
    </QueryClientProvider>
  );
};

export default AppProviders;
