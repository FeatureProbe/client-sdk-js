import { FPUser } from './FPUser';
import { FeatureProbe } from './FeatureProbe';
import { FPConfig, FPStorageProvider, IOption, FPDetail, IHttpRequest, IReturnValue, IPlatForm } from './types';
import { setPlatform, getPlatform } from './platform';

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

export { 
  FPUser,
  FeatureProbe,
  FPDetail,
  FPConfig,
  FPStorageProvider,
  IHttpRequest,
  IReturnValue,
  IOption,
  IPlatForm,
  initializePlatform,
  getPlatform,
  setPlatform,
};
