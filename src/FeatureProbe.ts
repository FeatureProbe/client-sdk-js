import { TinyEmitter } from "tiny-emitter";
import { Base64 } from "js-base64";
import { FPUser } from "./FPUser";
import { FPDetail, FPStorageProvider, FPConfig, IReturnValue } from "./types";
import { io, Socket } from "socket.io-client";
import { DefaultEventsMap } from "@socket.io/component-emitter";
import { getPlatform } from "./platform";
import { EventRecorder } from "./EventRecorder";
import reportEvents from "./autoReportEvents";
import flushEventBeforPageUnload from "./flushEvents";

const KEY = "repository";

const EVENTS = {
  READY: "ready",
  ERROR: "error",
  UPDATE: "update",
  CACHE_READY: "cache_ready",
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
  private togglesUrl: string;
  private eventsUrl: string;
  private getEventsUrl: string;
  private realtimeUrl: string;
  private realtimePath: string;
  private refreshInterval: number;
  private clientSdkKey: string;
  private user: FPUser;
  private toggles: { [key: string]: FPDetail } | undefined;
  private timer?: NodeJS.Timer;
  private timeoutTimer?: NodeJS.Timer;
  private readyPromise: null | Promise<void>;
  private status: string;
  private timeoutInterval: number;
  private storage: FPStorageProvider;
  private socket?: Socket<DefaultEventsMap, DefaultEventsMap>;
  private eventRecorder?: EventRecorder;

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

    this.toggles = undefined;
    this.togglesUrl = togglesUrl ?? remoteUrl + "/api/client-sdk/toggles";
    this.eventsUrl = eventsUrl ?? remoteUrl + "/api/events";
    this.getEventsUrl = eventsUrl ?? remoteUrl + "/api/client-sdk/events";
    this.realtimeUrl = realtimeUrl ?? remoteUrl + "/realtime";
    this.realtimePath = realtimePath ?? "/server/realtime";
    this.user = user;
    this.clientSdkKey = clientSdkKey;
    this.refreshInterval = refreshInterval;
    this.timeoutInterval = timeoutInterval;
    this.status = STATUS.START;
    this.storage = getPlatform().localStorage;
    this.readyPromise = null;
    this.eventRecorder = new EventRecorder(this.clientSdkKey, this.eventsUrl, this.refreshInterval);

    if (enableAutoReporting) {
      reportEvents(this.clientSdkKey, user, this.getEventsUrl, this.eventRecorder);
    }

    flushEventBeforPageUnload(this.eventRecorder);
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
    fp.toggles = _toggles;
    fp.successInitialized();
    return fp;
  }

  /**
   * Start the FeatureProbe client.
   */
  public async start(): Promise<void> {
    this.connectSocket();

    if (this.status !== STATUS.START) {
      return;
    }

    this.status = STATUS.PENDING;

    this.timeoutTimer = setTimeout(() => {
      if (this.status === STATUS.PENDING) {
        this.errorInitialized();
      }
    }, this.timeoutInterval);

    try {
      // Emit `cache_ready` event if toggles exist in localStorage
      const toggles = await this.storage.getItem(KEY);
      if (toggles) {
        this.toggles = JSON.parse(toggles);
        this.emit(EVENTS.CACHE_READY);
      }

      await this.fetchToggles();
    } finally {
      this.timer = setInterval(() => this.fetchToggles(), this.refreshInterval);
    }
  }

  /**
   * Stop the FeatureProbe client, once the client has been stopped, 
   * SDK will no longer listen for toggle changes or send metrics to Server.
   */
  public stop(): void {
    clearInterval(this.timer);
    clearTimeout(this.timeoutTimer);
    this.timeoutTimer = undefined;
    this.timer = undefined;
  }

  /**
   * Returns a Promise which tracks the client's ready state.
   *
   * The Promise will be resolved if the client successfully get toggles from the server
   * or ejected if client error get toggles from the server until `timeoutInterval` countdown reaches.
   */
  public waitUntilReady(): Promise<void> {
    if (this.readyPromise) {
      return this.readyPromise;
    }

    if (this.status === STATUS.READY) {
      return Promise.resolve();
    }

    if (this.status === STATUS.ERROR) {
      return Promise.reject();
    }

    this.readyPromise = new Promise((resolve, reject) => {
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

    return this.readyPromise;
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
    return Object.assign({}, this.toggles);
  }

  /**
   * Returns the current user.
   *
   * This is the user that was most recently passed to [[identifyUser]], or, if [[identifyUser]] has never
   * been called, the initial user specified when the client was created.
   */
  public getUser(): FPUser {
    return this.user;
  }

  /**
   * Changing the current user to FeatureProbe.
   *
   * @param user
   *   A new FPUser instance.
   */
  public identifyUser(user: FPUser): void {
    this.user = user;
    this.toggles = undefined;
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
    this.eventRecorder?.flush();
  }

  /**
   * Record custom events, value is optional.
   */
  public track(name: string, value?: unknown): void {
    this.eventRecorder?.recordTrackEvent({
      kind: "custom",
      name,
      time: Date.now(),
      user: this.getUser().getKey(),
      value,
    });
  }

  private connectSocket() {
    const socket = io(this.realtimeUrl, {
      path: this.realtimePath,
      transports: ["websocket"],
    });

    socket.on("connect", () => {
      socket.emit("register", { sdk_key: this.clientSdkKey });
    });

    socket.on("update", () => {
      (async () => {
        await this.fetchToggles();
      })();
    });

    this.socket = socket;
  }

  private toggleValue(key: string, defaultValue: IReturnValue, valueType: string): IReturnValue {
    if (this.toggles == undefined) {
      return defaultValue;
    }

    const detail = this.toggles[key];
    if (detail === undefined) {
      return defaultValue;
    }

    const v = detail.value;
    if (typeof v == valueType) {
      const timestamp = Date.now();

      const DEFAULT_VARIATION_INDEX = -1;
      const DEFAULT_VERSION = 0;

      this.eventRecorder?.recordAccessEvent({
        time: timestamp,
        key: key,
        value: detail.value,
        index: detail.variationIndex ?? DEFAULT_VARIATION_INDEX,
        version: detail.version ?? DEFAULT_VERSION,
        reason: detail.reason,
      });

      if (detail.trackAccessEvents) {
        this.eventRecorder?.recordTrackEvent({
          kind: "access",
          time: timestamp,
          user: this.getUser().getKey(),
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
    if (this.toggles == undefined) {
      return {
        value: defaultValue,
        ruleIndex: null,
        variationIndex: null,
        version: 0,
        reason: "Not ready",
      };
    }

    const detail = this.toggles[key];
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

      this.eventRecorder?.recordAccessEvent({
        time: timestamp,
        key: key,
        value: detail.value,
        index: detail.variationIndex ?? -1,
        version: detail.version ?? 0,
        reason: detail.reason
      });

      if (detail.trackAccessEvents) {
        this.eventRecorder?.recordTrackEvent({
          kind: "access",
          time: timestamp,
          user: this.getUser().getKey(),
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
        reason: "Value type mismatch",
      };
    }
  }

  private async fetchToggles() {
    const userStr = JSON.stringify(this.user);
    const userParam = Base64.encode(userStr);
    const url = this.togglesUrl;

    getPlatform().httpRequest.get(url, {
      Authorization: this.clientSdkKey,
      "Content-Type": "application/json",
      UA: getPlatform()?.UA,
    }, {
      user: userParam,
    }, (json: unknown) => {
      if (this.status !== STATUS.ERROR) {
        this.toggles = json as { [key: string]: FPDetail; } | undefined;

        if (this.status === STATUS.PENDING) {
          this.successInitialized();
        } else if (this.status === STATUS.READY) {
          this.emit(EVENTS.UPDATE);
        }

        this.storage.setItem(KEY, JSON.stringify(json));
      }
    }, (error: string) => {
      console.error("FeatureProbe JS SDK: Error getting toggles: ", error);
    })
  }

  // Emit `ready` event if toggles are successfully returned from server
  private successInitialized() {
    this.status = STATUS.READY;
    setTimeout(() => {
      this.emit(EVENTS.READY);
    });

    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = undefined;
    }
  }

  // Emit `error` event if toggles are not available and timeout has been reached
  private errorInitialized() {
    this.status = STATUS.ERROR;
    setTimeout(() => {
      this.emit(EVENTS.ERROR);
    });

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }
}

export { FeatureProbe, FPDetail };
