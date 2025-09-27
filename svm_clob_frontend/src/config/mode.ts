import { CONFIG } from './config';

export const isMockMode = (): boolean => CONFIG.USE_MOCK_API === true;
