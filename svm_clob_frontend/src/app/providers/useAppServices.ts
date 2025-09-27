import { useContext } from 'react';
import { AppServicesContext, AppServicesContextValue } from './AppServicesContext';

export const useAppServices = (): AppServicesContextValue => {
  const ctx = useContext(AppServicesContext);
  if (!ctx) {
    throw new Error('useAppServices must be used within AppServicesProvider');
  }
  return ctx;
};
