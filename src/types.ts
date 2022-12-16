import { FPUser } from "./FPUser";

interface IValue {
  count: number;
  value: boolean | string | number | object;
  index: number | null;
  version: number | null;
}

interface ICounter {
  [key: string]: IValue[];
}

interface IAccess {
  startTime: number;
  endTime: number;
  counters: ICounter;
}

export interface IParams {
  access: IAccess;
}

export interface FPDetail {
  /**
   * The value corresponding to the rule in the UI platform.
   */
  value: boolean | string | number | object;

  /**
   * The sequence number of the rule in the UI configuration that hit the rule.
   */
  ruleIndex: number | null;

  /**
   * The sequence number of the variation in the UI platform.
   */
  variationIndex: number | null;

  /**
   * The version of the toggle.
   */
  version: number | null;

  /**
   * Why return this value, like disabled, default, not exist and so on.
   */
  reason: string;
}

export interface FPConfig {
  /**
   * The unified URL to connect FeatureProbe Server.
   */
  remoteUrl?: string;

  /**
   * The specific URL to get toggles, once set, remoteUrl will be ignored.
   */
  togglesUrl?: string;

  /**
   * The specific URL to post events, once set, remoteUrl will be ignored.
   */
  eventsUrl?: string;

  /**
   * The Client SDK Key is used to authentification.
   */
  clientSdkKey: string;

  /**
   * The User with attributes like name, age is used when toggle evaluation.
   */
  user: FPUser;

  /**
   * Milliseconds for SDK to check for update.
   */
  refreshInterval?: number;

  /**
   * Milliseconds for SDK to initialize, SDK will emit an `error` event when milliseconds reach.
   */
  timeoutInterval?: number
}

export interface FPStorageProvider {
  /**
   * Save data to storage.
   * 
   *  @param key
   *   The key of the storage item.
   * 
   *  @param data
   *   The data of the storage item.
   */

  setItem: (key: string, data: any) => Promise<void>;

  /**
   * Get data from storage.
   * 
   *  @param key
   *   The key of the storage item.
   */
  getItem: (key: string) => Promise<any>;
}

export interface IHttpRequest {
  get: (
    url: string, 
    headers: Record<string, string>, 
    data: Record<string, string>,
    successCb: (json: any) => void, 
    errorCb: (e: string) => void
  ) => void
  post: (
    url: string, 
    headers: Record<string, string>, 
    data: string, 
    successCb: () => void, 
    errorCb: (e: string) => void
  ) => void
}

export interface IPlatForm {
  localStorage: FPStorageProvider;
  UA: string;
  httpRequest: IHttpRequest;
}

export interface IOption {
  platform: IPlatForm
}
