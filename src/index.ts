import { FPUser } from './FPUser';
import { FeatureProbe } from './FeatureProbe';
import { FPConfig, FPStorageProvider, IOption, FPDetail } from './types';
import { setPlatform } from './platform';

/**
 * Initialize SDK with platform
 * 
 *  @param options
 *   The platform object
 */
function initializePlatform(options: IOption) {
  if (options.platform) {
    setPlatform(options.platform);
  }
}

export { FPUser, FeatureProbe, FPDetail, FPConfig, FPStorageProvider, initializePlatform };
