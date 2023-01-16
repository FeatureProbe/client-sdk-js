import { FPUser } from './FPUser';
import { FeatureProbe } from './FeatureProbe';
import { FPConfig, FPStorageProvider, IOption, FPDetail, IHttpRequest } from './types';
import { setPlatform } from './platform';

/**
 * Initialize SDK with platform
 * 
 *  @param options
 *   The platform object
 */
function initializePlatform(options: IOption): void {
  if (options.platform) {
    setPlatform(options.platform);
  }
}

export { FPUser, FeatureProbe, FPDetail, FPConfig, FPStorageProvider, IHttpRequest, initializePlatform };
