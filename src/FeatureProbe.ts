import "whatwg-fetch";
import { TinyEmitter } from "tiny-emitter";
import { Base64 } from "js-base64";
import StorageProvider from "./localStorage";
import { FPUser } from "./FPUser";
import { FPToggleDetail, IStorageProvider, IOption, IParams } from "./types";
import pkg from '../package.json';

const PKG_VERSION = pkg.version;
const UA = "JS/" + PKG_VERSION;
const KEY = 'repository';

const EVENTS = {
  READY: "ready",
  ERROR: "error",
  UPDATE: "update",
  CACHE_READY: 'cache_ready'
};

const STATUS = {
  PENDING: "pending",
  READY: "ready",
  ERROR: "error",
};

class FeatureProbe extends TinyEmitter {
  private togglesUrl: URL;
  private eventsUrl: URL;
  private refreshInterval: number;
  private clientSdkKey: string;
  private user: FPUser;
  private toggles: { [key: string]: FPToggleDetail } | undefined;
  private timer?: any;
  private timeoutTimer?: any;
  private readyPromise: Promise<void>;
  private status: string;
  private timeoutInterval: number;
  private storage: IStorageProvider;

  constructor({
    remoteUrl,
    togglesUrl,
    eventsUrl,
    clientSdkKey,
    user,
    refreshInterval = 1000,
    timeoutInterval = 10000
  }: IOption) {
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
    this.togglesUrl = new URL(togglesUrl || remoteUrl + "/api/client-sdk/toggles");
    this.eventsUrl = new URL(eventsUrl || remoteUrl + "/api/events");
    this.user = user;
    this.clientSdkKey = clientSdkKey;
    this.refreshInterval = refreshInterval;
    this.timeoutInterval = timeoutInterval;
    this.status = STATUS.PENDING;
    this.storage = new StorageProvider();

    this.readyPromise = new Promise<void>((resolve, reject) => {
      const onReadyCallback = () => {
        this.off(EVENTS.READY, onReadyCallback);
        resolve();
      };
      const onErrorCallback = (err: Error) => {
        this.off(EVENTS.ERROR, onErrorCallback);
        reject(err);
      };

      this.on(EVENTS.READY, onReadyCallback);
      this.on(EVENTS.ERROR, onErrorCallback);
    });
  }

  public async start() {
    this.timeoutTimer = setTimeout(() => {
      if (this.status === STATUS.PENDING) {
        this.errorInitialized();
      }
    }, this.timeoutInterval);

    try {
      // Emit `cache_ready` event if toggles exist in LocalStorage
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

  public stop() {
    clearInterval(this.timer);
    clearTimeout(this.timeoutTimer);
    this.timeoutTimer = null;
    this.timer = null;
  }

  public waitUntilReady(): Promise<void> {
    return this.readyPromise;
  }

  public boolValue(key: string, defaultValue: boolean): boolean {
    return this.toggleValue(key, defaultValue, "boolean") as boolean;
  }

  public numberValue(key: string, defaultValue: number): number {
    return this.toggleValue(key, defaultValue, "number") as number;
  }

  public stringValue(key: string, defaultValue: string): string {
    return this.toggleValue(key, defaultValue, "string") as string;
  }

  public jsonValue(key: string, defaultValue: object): object {
    return this.toggleValue(key, defaultValue, "object") as object;
  }

  public boolDetail(key: string, defaultValue: boolean): FPToggleDetail {
    return this.toggleDetail(key, defaultValue, "boolean");
  }

  public numberDetail(key: string, defaultValue: number): FPToggleDetail {
    return this.toggleDetail(key, defaultValue, "number");
  }

  public stringDetail(key: string, defaultValue: string): FPToggleDetail {
    return this.toggleDetail(key, defaultValue, "string");
  }

  public jsonDetail(key: string, defaultValue: object): FPToggleDetail {
    return this.toggleDetail(key, defaultValue, "object");
  }

  public allToggles(): { [key: string]: FPToggleDetail } | undefined {
    return Object.assign({}, this.toggles);
  }

  public getUser(): FPUser {
    return this.user;
  }

  public identifyUser(user: FPUser) {
    this.user = user;
  }

  public logout() {
    const user = new FPUser();
    this.identifyUser(user);
  }

  static newForTest(toggles: { [key: string]: any }): FeatureProbe {
    var fp = new FeatureProbe({
      remoteUrl: "http://127.0.0.1:4000",
      clientSdkKey: "_",
      user: new FPUser(),
      timeoutInterval: 1000,
    });
    var _toggles: { [key: string]: FPToggleDetail } = {};
    for (let key in toggles) {
      let value = toggles[key];
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

  private toggleValue(key: string, defaultValue: any, valueType: string): any {
    this.sendEvents(key);

    if (this.toggles == undefined) {
      return defaultValue;
    }

    let detail = this.toggles[key];
    if (detail === undefined) {
      return defaultValue;
    }

    let v = detail.value;
    if (typeof v == valueType) {
      return v;
    } else {
      return defaultValue;
    }
  }

  private toggleDetail(
    key: string,
    defaultValue: any,
    valueType: string
  ): FPToggleDetail {
    this.sendEvents(key);

    if (this.toggles == undefined) {
      return {
        value: defaultValue,
        ruleIndex: null,
        variationIndex: null,
        version: 0,
        reason: "Not ready",
      };
    }

    let detail = this.toggles[key];
    if (detail === undefined) {
      return {
        value: defaultValue,
        ruleIndex: null,
        variationIndex: null,
        version: null,
        reason: "Toggle: [" + key + "] not found",
      };
    } else if (typeof detail.value === valueType) {
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
    url.searchParams.set("user", userParam);

    return fetch(url.toString(), {
      method: "GET",
      cache: "no-cache",
      headers: {
        Authorization: this.clientSdkKey,
        "Content-Type": "application/json",
        UA: UA,
      },
    })
    .then(response => {
      if (response.status >= 200 && response.status < 300) {
        return response;
      } else {
        const error: Error = new Error(response.statusText);
        throw error;
      }
    })
    .then(response => response.json())
    .then(json => {
      if (this.status !== STATUS.ERROR) {
        this.toggles = json;

        if (this.status === STATUS.PENDING) {
          this.successInitialized();
        } else if (this.status === STATUS.READY) {
          this.emit(EVENTS.UPDATE);
        }

        this.storage.setItem(KEY, JSON.stringify(json));
      }
    })
    .catch((e) => {
      console.error('FeatureProbe JS SDK: Error getting toggles: ', e);
    });
  }

  private async sendEvents(key: string): Promise<void> {
    if (this.toggles && this.toggles[key]) {
      const timestamp = Date.now();
      const payload: IParams[] = [
        {
          access: {
            startTime: timestamp,
            endTime: timestamp,
            counters: {
              [key]: [
                {
                  count: 1,
                  value: this.toggles[key].value,
                  index: this.toggles[key].variationIndex,
                  version: this.toggles[key].version,
                },
              ],
            },
          },
        },
      ];

      fetch(this.eventsUrl.toString(), {
        cache: "no-cache",
        method: "POST",
        headers: {
          Authorization: this.clientSdkKey,
          "Content-Type": "application/json",
          UA: UA,
        },
        body: JSON.stringify(payload),
      })
      .then(response => {
        if (response.status >= 200 && response.status < 300) {
          return response;
        }
        else {
          const error: Error = new Error(response.statusText);
          throw error;
        }
      })
      .catch((e) => {
        console.error('FeatureProbe JS SDK: Error reporting events: ', e);
      });
    }
  }

  // Emit `ready` event if toggles are successfully returned from server
  private successInitialized() {
    this.status = STATUS.READY;
    setTimeout(() => {
      this.emit(EVENTS.READY);
    });
            
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
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
      this.timer = null;
    }
  }
}

export { FeatureProbe, FPToggleDetail };
