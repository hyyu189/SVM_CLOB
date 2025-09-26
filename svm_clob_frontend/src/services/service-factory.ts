
import { CONFIG } from '../config/config';
import { getResilientApiService, ResilientApiService } from './resilient-api-service';
import { getMockApiService, MockApiService } from './mock-api-service';

export type AppApiService = ResilientApiService | MockApiService;

let serviceInstance: AppApiService | null = null;

export const getAppApiService = (): AppApiService => {
  if (!serviceInstance) {
    if (CONFIG.USE_MOCK_API) {
      console.log('Using Mock API Service for development/testing');
      serviceInstance = getMockApiService();
    } else {
      console.log('Using Resilient API Service with real backend integration');
      serviceInstance = getResilientApiService();
    }
  }
  return serviceInstance;
};

// Export the class types if needed elsewhere
export { ResilientApiService, MockApiService };
