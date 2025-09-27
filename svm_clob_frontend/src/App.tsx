import { Toaster } from 'react-hot-toast';
import { AppProviders } from './app/providers/AppProviders';
import { AppRouter } from './app/routes/AppRouter';

const App = () => {
  return (
    <AppProviders>
      <AppRouter />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#161822',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#f8fafc',
          },
        }}
      />
    </AppProviders>
  );
};

export default App;
