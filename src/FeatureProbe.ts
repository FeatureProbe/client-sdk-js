import { TinyEmitter } from "tiny-emitter";
import { Base64 } from "js-base64";
import { FPUser } from "./FPUser";
import { FPDetail, FPStorageProvider, FPConfig, IReturnValue } from "./types";
import { getPlatform } from "./platform";
import { EventRecorder } from "./EventRecorder";
import reportEvents from "./autoReportEvents";
import flushEventBeforPageUnload from "./flushEvents";

const KEY = "repository";

export const EVENTS = {
  READY: "ready",
  ERROR: "error",
  UPDATE: "update",
  CACHE_READY: "cache_ready",
  FETCH_TOGGLE_ERROR: "fetch_toggle_error",
  FETCH_EVENT_ERROR: "fetch_event_error",
};

const STATUS = {
  START: "start",
  PENDING: "pending",
  READY: "ready",
  ERROR: "error",
};

const REFRESH_INTERVAL = 1000;
const TIMEOUT_INTERVAL = 10000;

/**
 * You can obtainan a client of FeatureProbe, 
 * which provides access to all of the SDK's functionality.
 */
class FeatureProbe extends TinyEmitter {
  private _togglesUrl: string;
  private _eventsUrl: string;
  private _getEventsUrl: string;
  private _realtimeUrl: string;
  private _realtimePath: string;
  private _refreshInterval: number;
  private _clientSdkKey: string;
  private _user: FPUser;
  private _toggles: { [key: string]: FPDetail } | undefined;
  private _timer?: NodeJS.Timer;
  private _timeoutTimer?: NodeJS.Timer;
  private _readyPromise: null | Promise<void>;
  private _status: string;
  private _timeoutInterval: number;
  private _storage: FPStorageProvider;
  private _eventRecorder: EventRecorder;

  constructor({
    remoteUrl,
    togglesUrl,
    eventsUrl,
    realtimeUrl,
    realtimePath,
    clientSdkKey,
    user,
    refreshInterval = REFRESH_INTERVAL,
    timeoutInterval = TIMEOUT_INTERVAL,
    enableAutoReporting = true,
  }: FPConfig) {
    super();
    if (!clientSdkKey) {
      throw new Error("clientSdkKey is required");
    }
    if (refreshInterval <= 0) {
      throw new Error("refreshInterval is invalid");
    }
    if (timeoutInterval <= 0) {
      throw new Error("timeoutInterval is invalid");
    }
    if (!remoteUrl && !togglesUrl && !eventsUrl) {
      throw new Error("remoteUrl is required");
    }
    if (!remoteUrl && !togglesUrl) {
      throw new Error("remoteUrl or togglesUrl is required");
    }
    if (!remoteUrl && !eventsUrl) {
      throw new Error("remoteUrl or eventsUrl is required");
    }

    this._toggles = undefined;
    this._togglesUrl = togglesUrl ?? remoteUrl + "/api/client-sdk/toggles";
    this._eventsUrl = eventsUrl ?? remoteUrl + "/api/events";
    this._getEventsUrl = eventsUrl ?? remoteUrl + "/api/client-sdk/events";
    this._realtimeUrl = realtimeUrl ?? remoteUrl + "/realtime";
    this._realtimePath = realtimePath ?? "/server/realtime";
    this._user = user;
    this._clientSdkKey = clientSdkKey;
    this._refreshInterval = refreshInterval;
    this._timeoutInterval = timeoutInterval;
    this._status = STATUS.START;
    this._storage = getPlatform().localStorage;
    this._readyPromise = null;
    this._eventRecorder = new EventRecorder(this._clientSdkKey, this._eventsUrl, this._refreshInterval);

    if (enableAutoReporting && window && document) {
      reportEvents(this);
    }

    if (window && document) {
      flushEventBeforPageUnload(this._eventRecorder);
    }
  }

  get clientSdkKey(): string {
    return this._clientSdkKey;
  }

  get user(): FPUser {
    return this._user;
  }

  get eventsUrl(): string {
    return this._getEventsUrl;
  }

  get eventRecorder(): EventRecorder {
    return this._eventRecorder;
  }

  public static newForTest(toggles: { [key: string]: boolean }): FeatureProbe {
    const fp = new FeatureProbe({
      remoteUrl: "http://127.0.0.1:4000",
      clientSdkKey: "_",
      user: new FPUser(),
      timeoutInterval: 1000,
    });
    const _toggles: { [key: string]: FPDetail } = {};
    for (const key in toggles) {
      const value = toggles[key];
      _toggles[key] = {
        value: value,
        ruleIndex: null,
        variationIndex: null,
        version: 0,
        reason: "",
      };
    }
    fp._toggles = _toggles;
    fp.successInitialized();
    return fp;
  }

  /**
   * Start the FeatureProbe client.
   */
  public async start(): Promise<void> {
    this.connectSocket();

    if (this._status !== STATUS.START) {
      return;
    }

    this._status = STATUS.PENDING;

    this._timeoutTimer = setTimeout(() => {
      if (this._status === STATUS.PENDING) {
        this.errorInitialized();
      }
    }, this._timeoutInterval);

    try {
      // Emit `cache_ready` event if toggles exist in localStorage
      const toggles = await this._storage.getItem(KEY);
      if (toggles) {
        this._toggles = JSON.parse(toggles);
        this.emit(EVENTS.CACHE_READY);
      }

      await this.fetchToggles();
    } finally {
      this._timer = setInterval(() => this.fetchToggles(), this._refreshInterval);
    }
  }

  /**
   * Stop the FeatureProbe client, once the client has been stopped, 
   * SDK will no longer listen for toggle changes or send metrics to Server.
   */
  public stop(): void {
    clearInterval(this._timer);
    clearTimeout(this._timeoutTimer);
    this._timeoutTimer = undefined;
    this._timer = undefined;
  }

  /**
   * Returns a Promise which tracks the client's ready state.
   *
   * The Promise will be resolved if the client successfully get toggles from the server
   * or ejected if client error get toggles from the server until `timeoutInterval` countdown reaches.
   */
  public waitUntilReady(): Promise<void> {
    if (this._readyPromise) {
      return this._readyPromise;
    }

    if (this._status === STATUS.READY) {
      return Promise.resolve();
    }

    if (this._status === STATUS.ERROR) {
      return Promise.reject();
    }

    this._readyPromise = new Promise((resolve, reject) => {
      const onReadyCallback = () => {
        this.off(EVENTS.READY, onReadyCallback);
        resolve();
      };

      const onErrorCallback = () => {
        this.off(EVENTS.ERROR, onErrorCallback);
        reject();
      };

      this.on(EVENTS.READY, onReadyCallback);
      this.on(EVENTS.ERROR, onErrorCallback);
    });

    return this._readyPromise;
  }

  /**
   * Determines the return `boolean` value of a toggle for the current user.
   *
   *
   * @param key
   *   The unique key of the toggle.
   * @param defaultValue
   *   The default value of the toggle, to be used if the value is not available from FeatureProbe.
   */
  public boolValue(key: string, defaultValue: boolean): boolean {
    return this.toggleValue(key, defaultValue, "boolean") as boolean;
  }

  /**
   * Determines the return `number` value of a toggle for the current user.
   *
   *
   * @param key
   *   The unique key of the toggle.
   * @param defaultValue
   *   The default value of the toggle, to be used if the value is not available from FeatureProbe.
   */
  public numberValue(key: string, defaultValue: number): number {
    return this.toggleValue(key, defaultValue, "number") as number;
  }

  /**
   * Determines the return `string` value of a toggle for the current user.
   *
   *
   * @param key
   *   The unique key of the toggle.
   * @param defaultValue
   *   The default value of the toggle, to be used if the value is not available from FeatureProbe.
   */
  public stringValue(key: string, defaultValue: string): string {
    return this.toggleValue(key, defaultValue, "string") as string;
  }

  /**
   * Determines the return `json` value of a toggle for the current user.
   *
   *
   * @param key
   *   The unique key of the toggle.
   * @param defaultValue
   *   The default value of the toggle, to be used if the value is not available from FeatureProbe.
   */
  public jsonValue(key: string, defaultValue: Record<string, unknown>): Record<string, unknown> {
    return this.toggleValue(key, defaultValue, "object") as Record<string, unknown>;
  }

  /**
   * Determines the return `boolean` value of a toggle for the current user, along with information about how it was calculated.
   *
   *
   * @param key
   *   The unique key of the toggle.
   * @param defaultValue
   *   The default value of the toggle, to be used if the value is not available from FeatureProbe.
   */
  public boolDetail(key: string, defaultValue: boolean): FPDetail {
    return this.toggleDetail(key, defaultValue, "boolean");
  }

  /**
   * Determines the return `number` value of a toggle for the current user, along with information about how it was calculated.
   *
   *
   * @param key
   *   The unique key of the toggle.
   * @param defaultValue
   *   The default value of the toggle, to be used if the value is not available from FeatureProbe.
   */
  public numberDetail(key: string, defaultValue: number): FPDetail {
    return this.toggleDetail(key, defaultValue, "number");
  }

  /**
   * Determines the return `string` value of a toggle for the current user, along with information about how it was calculated.
   *
   *
   * @param key
   *   The unique key of the toggle.
   * @param defaultValue
   *   The default value of the toggle, to be used if the value is not available from FeatureProbe.
   */
  public stringDetail(key: string, defaultValue: string): FPDetail {
    return this.toggleDetail(key, defaultValue, "string");
  }

  /**
   * Determines the return `json` value of a toggle for the current user, along with information about how it was calculated.
   *
   *
   * @param key
   *   The unique key of the toggle.
   * @param defaultValue
   *   The default value of the toggle, to be used if the value is not available from FeatureProbe.
   */
  public jsonDetail(key: string, defaultValue: Record<string, unknown>): FPDetail {
    return this.toggleDetail(key, defaultValue, "object");
  }

  /**
   * Returns an object of all available toggles' details to the current user.
   */
  public allToggles(): { [key: string]: FPDetail } | undefined {
    return Object.assign({}, this._toggles);
  }

  /**
   * Returns the current user.
   *
   * This is the user that was most recently passed to [[identifyUser]], or, if [[identifyUser]] has never
   * been called, the initial user specified when the client was created.
   */
  public getUser(): FPUser {
    return this._user;
  }

  /**
   * Changing the current user to FeatureProbe.
   *
   * @param user
   *   A new FPUser instance.
   */
  public identifyUser(user: FPUser): void {
    this._user = user;
    this._toggles = undefined;
    this.fetchToggles();
  }

  /**
   * Logout the current user, change the current user to an anonymous user.
   */
  public logout(): void {
    const user = new FPUser();
    this.identifyUser(user);
  }

  /**
   * Manually push events.
   */
  public flush(): void {
    this._eventRecorder?.flush();
  }

  /**
   * Record custom events, value is optional.
   */
  public track(name: string, value?: unknown): void {
    this._eventRecorder?.recordTrackEvent({
      kind: "custom",
      name,
      time: Date.now(),
      user: this.getUser().getKey(),
      userDetail: this.getUser(),
      value,
    });
  }

  private connectSocket() {
    const socket = getPlatform().socket(this._realtimeUrl, {
      path: this._realtimePath,
      transports: ["websocket"],
    });

    socket.on("connect", () => {
      socket.emit("register", { sdk_key: this._clientSdkKey });
    });

    socket.on("update", () => {
      (async () => {
        await this.fetchToggles();
      })();
    });
  }

  private toggleValue(key: string, defaultValue: IReturnValue, valueType: string): IReturnValue {
    if (this._toggles == undefined) {
      return defaultValue;
    }

    const detail = this._toggles[key];
    if (detail === undefined) {
      return defaultValue;
    }

    const v = detail.value;
    if (typeof v == valueType) {
      const timestamp = Date.now();

      const DEFAULT_VARIATION_INDEX = -1;
      const DEFAULT_VERSION = 0;

      this._eventRecorder?.recordAccessEvent({
        time: timestamp,
        key: key,
        value: detail.value,
        index: detail.variationIndex ?? DEFAULT_VARIATION_INDEX,
        version: detail.version ?? DEFAULT_VERSION,
        reason: detail.reason,
      });

      if (detail.trackAccessEvents) {
        this._eventRecorder?.recordTrackEvent({
          kind: "access",
          time: timestamp,
          user: this.getUser().getKey(),
          userDetail: this.getUser(),
          key: key,
          value: detail.value,
          variationIndex: detail.variationIndex ?? DEFAULT_VARIATION_INDEX,
          ruleIndex: detail.ruleIndex ?? null,
          version: detail.version ?? DEFAULT_VERSION,
        });
      }

      if (detail?.trackDebugUntilDate && (Date.now() <= detail?.trackDebugUntilDate)) {
        this._eventRecorder?.recordTrackEvent({
          kind: "debug",
          time: timestamp,
          user: this.getUser().getKey(),
          userDetail: this.getUser(),
          key: key,
          value: detail.value,
          variationIndex: detail.variationIndex ?? DEFAULT_VARIATION_INDEX,
          ruleIndex: detail.ruleIndex ?? null,
          version: detail.version ?? DEFAULT_VERSION,
        });
      }

      return v;
    } else {
      return defaultValue;
    }
  }

  private toggleDetail(
    key: string,
    defaultValue: IReturnValue,
    valueType: string
  ): FPDetail {
    if (this._toggles == undefined) {
      return {
        value: defaultValue,
        ruleIndex: null,
        variationIndex: null,
        version: 0,
        reason: "Not ready",
      };
    }

    const detail = this._toggles[key];
    if (detail === undefined) {
      return {
        value: defaultValue,
        ruleIndex: null,
        variationIndex: null,
        version: null,
        reason: "Toggle: [" + key + "] not found",
      };
    } else if (typeof detail.value === valueType) {
      const timestamp = Date.now();

      this._eventRecorder?.recordAccessEvent({
        time: timestamp,
        key: key,
        value: detail.value,
        index: detail.variationIndex ?? -1,
        version: detail.version ?? 0,
        reason: detail.reason
      });

      if (detail.trackAccessEvents) {
        this._eventRecorder?.recordTrackEvent({
          kind: "access",
          time: timestamp,
          user: this.getUser().getKey(),
          userDetail: this.getUser(),
          key: key,
          value: detail.value,
          variationIndex: detail.variationIndex ?? -1,
          ruleIndex: detail.ruleIndex ?? null,
          version: detail.version ?? 0,
        });
      }

      if (detail?.trackDebugUntilDate && (Date.now() <= detail?.trackDebugUntilDate)) {
        this._eventRecorder?.recordTrackEvent({
          kind: "debug",
          time: timestamp,
          user: this.getUser().getKey(),
          userDetail: this.getUser(),
          key: key,
          value: detail.value,
          variationIndex: detail.variationIndex ?? -1,
          ruleIndex: detail.ruleIndex ?? null,
          version: detail.version ?? 0,
        });
      }
      
      return detail;
    } else {
      return {
        value: defaultValue,
        ruleIndex: null,
        variationIndex: null,
        version: null,
        reason: "Value type mismatch.",
      };
    }
  }

  private async fetchToggles() {
    const userStr = JSON.stringify(this._user);
    const userParam = Base64.encode(userStr);
    const url = this._togglesUrl;

    getPlatform().httpRequest.get(url, {
      Authorization: this._clientSdkKey,
      "Content-Type": "application/json",
      UA: getPlatform()?.UA,
    }, {
      user: userParam,
    }, (json: unknown) => {
      if (this._status !== STATUS.ERROR) {
        this._toggles = json as { [key: string]: FPDetail; } | undefined;

        if (this._status === STATUS.PENDING) {
          this.successInitialized();
        } else if (this._status === STATUS.READY) {
          this.emit(EVENTS.UPDATE);
        }

        this._storage.setItem(KEY, JSON.stringify(json));
      }
    }, (error: string) => {
      // Emit `fetch_toggle_error` event if toggles are successfully returned from server
      this.emit(EVENTS.FETCH_TOGGLE_ERROR);
      console.error(`FeatureProbe ${getPlatform()?.UA} SDK: Error getting toggles: `, error);
    })
  }

  // Emit `ready` event if toggles are successfully returned from server in time
  private successInitialized() {
    this._status = STATUS.READY;
    setTimeout(() => {
      this.emit(EVENTS.READY);
    });

    if (this._timeoutTimer) {
      clearTimeout(this._timeoutTimer);
      this._timeoutTimer = undefined;
    }
  }

  // Emit `error` event if toggles are not available and timeout has been reached
  private errorInitialized() {
    this._status = STATUS.ERROR;
    setTimeout(() => {
      this.emit(EVENTS.ERROR);
    });

    if (this._timer) {
      clearInterval(this._timer);
      this._timer = undefined;
    }
  }
}

export { FeatureProbe, FPDetail };
