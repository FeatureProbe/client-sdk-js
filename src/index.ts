import { FPUser } from './FPUser';
import { FeatureProbe, FPDetail } from './FeatureProbe';
import { FPConfig, FPStorageProvider, IPlatForm, IOption } from './types';
import Platform from './platform';

let platform: IPlatForm = Platform;

/**
 * Initialize SDK with platform
 * 
 *  @param options
 *   The platform object
 */
function initializePlatform(options: IOption) {
  if (options.platform) {
    platform = options.platform;
  }
}

export { FPUser, FeatureProbe, FPDetail, FPConfig, FPStorageProvider, initializePlatform, platform };
