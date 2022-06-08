import 'whatwg-fetch';
import { TinyEmitter } from 'tiny-emitter';
import { Base64 } from 'js-base64';
import { FPUser } from './FPUser';

const EVENTS = {
  READY: 'ready',
  ERROR: 'error',
};

interface IValue {
  count: number;
  value: boolean | number | object;
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

interface IParams {
  access: IAccess;
}

interface FPToggleDetail {
  value: boolean | number | object;
  ruleIndex: number | null;
  version: number | null;
  reason: string;
}

interface IOption {
  remoteUrl?: string;
  togglesUrl?: string;
  eventsUrl?: string;
  clientSdkKey: string;
  user: FPUser;
  refreshInterval?: number;
}

class FeatureProbe extends TinyEmitter {
  private togglesUrl: URL;
  private eventsUrl: URL;
  private refreshInterval: number;
  private clientSdkKey: string;
  private user: FPUser;
  private toggles: { [key: string]: FPToggleDetail } | undefined;
  private timer?: any;

  constructor({
    remoteUrl,
    togglesUrl,
    eventsUrl,
    clientSdkKey,
    user,
    refreshInterval = 1000,
  }: IOption) {
    super();
    if (!clientSdkKey) {
      throw new Error('clientSdkKey is required');
    }
    if (refreshInterval <= 0) {
      throw new Error('refreshInterval is invalid');
    }

    if (!remoteUrl && !togglesUrl) {
      throw new Error('remoteUrl or togglesUrl is required');
    }

    if (!remoteUrl && !eventsUrl) {
      throw new Error('remoteUrl or eventsUrl is required');
    }

    if (!remoteUrl && !togglesUrl && !eventsUrl) {
      throw new Error('remoteUrl is required');
    }

    this.togglesUrl = new URL(togglesUrl || (remoteUrl + '/api/client-sdk/toggles'));
    this.eventsUrl = new URL(eventsUrl || (remoteUrl + '/api/server/events'));
    this.user = user;
    this.clientSdkKey = clientSdkKey;
    this.refreshInterval = refreshInterval;
    this.toggles = undefined;
  }

  public async start() {
    const interval = this.refreshInterval;
    await this.fetchToggles();
    this.emit(EVENTS.READY);
    this.timer = setInterval(() => this.fetchToggles(), interval);
  }

  public stop() {
    clearInterval(this.timer);
  }

  public boolValue(key: string, defaultValue: boolean): boolean {
    return this.toggleValue(key, defaultValue, 'boolean') as boolean;
  }

  public numberValue(key: string, defaultValue: number): number {
    return this.toggleValue(key, defaultValue, 'number') as number;
  }

  public stringValue(key: string, defaultValue: string): string {
    return this.toggleValue(key, defaultValue, 'string') as string;
  }

  public jsonValue(key: string, defaultValue: object): object {
    return this.toggleValue(key, defaultValue, 'object') as object;
  }

  public boolDetail(key: string, defaultValue: boolean): FPToggleDetail {
    return this.toggleDetail(key, defaultValue, 'boolean');
  }

  public numberDetail(key: string, defaultValue: number): FPToggleDetail {
    return this.toggleDetail(key, defaultValue, 'number');
  }

  public stringDetail(key: string, defaultValue: string): FPToggleDetail {
    return this.toggleDetail(key, defaultValue, 'string');
  }

  public jsonDetail(key: string, defaultValue: object): FPToggleDetail {
    return this.toggleDetail(key, defaultValue, 'object');
  }

  public allToggles(): { [key: string]: FPToggleDetail } | undefined {
    return Object.assign({}, this.toggles);
  }

  public getUser(): FPUser {
    return Object.assign({}, this.user);
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
        version: 0,
        reason: 'Not ready',
      };
    }

    let detail = this.toggles[key];
    if (detail === undefined) {
      return {
        value: defaultValue,
        ruleIndex: null,
        version: null,
        reason: 'Toggle: [' + key + '] not found',
      };
    } else if (typeof detail.value === valueType) {
      return detail;
    } else {
      return {
        value: defaultValue,
        ruleIndex: null,
        version: null,
        reason: 'Value type mismatch',
      };
    }
  }

  private async fetchToggles() {
    const userStr = JSON.stringify(this.user);
    const userParam = Base64.encode(userStr);
    const url = this.togglesUrl;
    url.searchParams.set('user', userParam);

    await fetch(url.toString(), {
      method: 'GET',
      cache: 'no-cache',
      headers: {
        Authorization: this.clientSdkKey,
        'Content-Type': 'application/json',
      },
    })
      .then((response) => {
        return response.json();
      })
      .then((json) => {
        this.toggles = json;
      })
      .catch((e) => {
        this.emit(EVENTS.ERROR, e);
      });
  }

  private async sendEvents(key: string): Promise<void> {
    if (this.toggles && this.toggles[key]) {
      const timestamp = Date.now();
      const payload: IParams[] = [
        {
          'access': {
            'startTime': timestamp,
            'endTime': timestamp,
            'counters': {
              [key]: [{
                'count': 1,
                'value': this.toggles[key].value,
                'index': this.toggles[key].ruleIndex,
                'version': this.toggles[key].version,
              }]
            }
          }
        }
      ];

      await fetch(this.eventsUrl.toString(), {
        cache: 'no-cache',
        method: 'POST',
        headers: {
          Authorization: this.clientSdkKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    }
  }
}

export { FeatureProbe, FPToggleDetail };
