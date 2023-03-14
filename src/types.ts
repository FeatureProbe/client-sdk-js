import { FPUser } from "./FPUser";
import { Socket, ManagerOptions, SocketOptions } from "socket.io-client";

export interface IAccessEvent {
  time: number;
  key: string;
  value: boolean | string | number | Record<string, unknown>;
  index: number;
  version: number;
  reason: string | null;
}

export interface IToggleCounter {
  value: boolean | string | number | Record<string, unknown>;
  version: number;
  index: number;
  count: number;
}

export interface IAccess {
  startTime: number;
  endTime: number;
  counters: { [key: string]: IToggleCounter[] };
}

export type IReturnValue = string | number | boolean | Record<string, unknown>;

export interface FPDetail {
  /**
   * The value corresponding to the rule in the UI platform.
   */
  value: boolean | string | number | Record<string, unknown>;

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

  /**
   * Whether to report access events.
   */
  trackAccessEvents?: boolean;

  /**
   * Toggle last modified timestamp
   */
  lastModified?: number;
}

export interface FPConfig {
  /**
   * The unified URL to connect FeatureProbe Server.
   */
  remoteUrl?: string;

  /**
   * The specific URL to get toggles, if not set, will generate from remoteUrl.
   */
  togglesUrl?: string;

  /**
   * The specific URL to post events, if not set, will generate from remoteUrl.
   */
  eventsUrl?: string;

  /**
   * The specific URL to receive realtime events, if not set, will generate from remoteUrl.
   */
  realtimeUrl?: string;

  /**
   * The specific path to receive realtime events, if not set, default value will be used.
   */
   realtimePath?: string;

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
  timeoutInterval?: number;

  /**
   * Whether SDK should report pageview and click event automatically. Default value is true.
   */
  enableAutoReporting?: boolean;
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
  setItem: (key: string, data: string) => Promise<void>;

  /**
   * Get data from storage.
   * 
   *  @param key
   *   The key of the storage item.
   */
  getItem: (key: string) => Promise<string>;
}

export interface IHttpRequest {
  get: (
    url: string, 
    headers: Record<string, string>, 
    data: Record<string, string>,
    successCb: (json: unknown) => void, 
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
  socket(uri: string, opts?: Partial<ManagerOptions & SocketOptions>): Socket;
}

export interface IOption {
  platform: IPlatForm
}

export interface AccessEvent {
  kind: string;
  time: number;
  user: string;
  key: string;
  value: boolean | string | number | Record<string, unknown>;
  variationIndex: number;
  ruleIndex: number | null;
  version: number;
}

export interface CustomEvent {
  kind: string;
  name: string;
  time: number;
  user: string;
  value: unknown;
}

export interface ClickEvent {
  kind: string;
  name: string;
  time: number;
  user: string;
  url: string;
  selector: string;
}

export interface PageViewEvent {
  kind: string;
  name: string;
  time: number;
  user: string;
  url: string;
}

export interface IEventValue {
  matcher: string;
  name: string;
  type: string;
  url: string;
  selector?: string;
}

export interface IEvent {
  [key: string]: IEventValue
}
