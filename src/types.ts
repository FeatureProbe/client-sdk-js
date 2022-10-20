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
  value: boolean | string | number | object;
  ruleIndex: number | null;
  variationIndex: number | null;
  version: number | null;
  reason: string;
}

export interface IOption {
  remoteUrl?: string;
  togglesUrl?: string;
  eventsUrl?: string;
  clientSdkKey: string;
  user: FPUser;
  refreshInterval?: number;
  timeoutInterval?: number
}

export interface IStorageProvider {
  setItem: (key: string, data: any) => Promise<void>;
  getItem: (key: string) => Promise<any>;
}