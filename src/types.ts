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

export interface FPToggleDetail {
  /**
   * Return value of a toggle for the current user.
   */
  value: boolean | string | number | object;

  /**
   * The index of the matching rule.
   */
  ruleIndex: number | null;

  /**
   * The index of the matching variation.
   */
  variationIndex: number | null;

  /**
   * The version of the toggle.
   */
  version: number | null;

  /**
   * The failed reason.
   */
  reason: string;
}

export interface FPOptions {
  /**
   * The unified URL to get toggles and post events.
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
   * The SDK check for updated in millisecond.
   */
  refreshInterval?: number;

  /**
   * Timeout for SDK initialization, SDK will emit an `error` event when timeout is reaching.
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