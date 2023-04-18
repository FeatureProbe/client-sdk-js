import { getPlatform } from "./platform";
import { IAccessEvent, IAccess, IToggleCounter, ClickEvent, PageViewEvent, AccessEvent, CustomEvent } from "./types";

export class EventRecorder {
  private _clientSdkKey: string;
  private _eventsUrl: string;
  private _closed: boolean;
  private _sendAccessQueue: IAccessEvent[];
  private _sendEventQueue: (AccessEvent | CustomEvent | ClickEvent | PageViewEvent)[];
  private _taskQueue: AsyncBlockingQueue<Promise<void>>;
  private _timer: NodeJS.Timer;
  private readonly _dispatch: Promise<void>;

  constructor(
    clientSdkKey: string,
    eventsUrl: string,
    flushInterval: number,
  ) {
    this._clientSdkKey = clientSdkKey;
    this._eventsUrl = eventsUrl;
    this._closed = false;
    this._sendAccessQueue = [];
    this._sendEventQueue = [];
    this._taskQueue = new AsyncBlockingQueue<Promise<void>>();
    this._timer = setInterval(() => this.flush(), flushInterval);
    this._dispatch = this.startDispatch();
  }

  set flushInterval(value: number) {
    clearInterval(this._timer);
    this._timer = setInterval(() => this.flush(), value);
  }

  get accessQueue(): IAccessEvent[] {
    return this._sendAccessQueue;
  }

  get eventQueue(): (AccessEvent | CustomEvent | ClickEvent | PageViewEvent)[] {
    return this._sendEventQueue;
  }

  public recordAccessEvent(accessEvent: IAccessEvent): void {
    if (this._closed) {
      console.warn("Trying to push access record to a closed EventProcessor, omitted");
      return;
    }
    this._sendAccessQueue.push(accessEvent);
  }

  public recordTrackEvent(trackEvents: ClickEvent | PageViewEvent | AccessEvent | CustomEvent): void {
    if (this._closed) {
      console.warn("Trying to push access record to a closed EventProcessor, omitted");
      return;
    }
    this._sendEventQueue.push(trackEvents);
  }

  public flush(): void {
    if (this._closed) {
      console.warn("Trying to flush a closed EventProcessor, omitted");
      return;
    }
    this._taskQueue.enqueue(this.doFlush());
  }

  public async stop(): Promise<void> {
    if (this._closed) {
      console.warn("EventProcessor is already closed");
      return;
    }
    clearInterval(this._timer);
    this._closed = true;
    this._taskQueue.enqueue(this.doFlush());
    await this._dispatch;
  }

  private async startDispatch(): Promise<void> {
    while (!this._closed || !this._taskQueue.isEmpty()) {
      await this._taskQueue.dequeue();
    }
  }

  private prepareSendData(events: IAccessEvent[]): IAccess {
    let start = -1, end = -1;
    const counters: { [key: string]: IToggleCounter[] } = {};
    for (const event of events) {
      if (start < 0 || start < event.time) {
        start = event.time;
      }
      if (end < 0 || end > event.time) {
        end = event.time;
      }

      if (counters[event.key] === undefined) {
        counters[event.key] = [];
      }
      let added = false;
      for (const counter of counters[event.key]) {
        if (counter.index === event.index
          && counter.version === event.version
          && counter.value === event.value) {
          counter.count++;
          added = true;
          break;
        }
      }
      if (!added) {
        counters[event.key].push({
          index: event.index,
          version: event.version,
          value: event.value,
          count: 1,
        } as IToggleCounter);
      }
    }
    return {
      startTime: start,
      endTime: end,
      counters: counters,
    } as IAccess;
  }

  private async doFlush(): Promise<void> {
    if (this._sendAccessQueue.length === 0 && this._sendEventQueue.length === 0) {
      return;
    }
    const accessEvents = Object.assign([], this._sendAccessQueue);
    const trackEvents = Object.assign([], this._sendEventQueue);
    
    this._sendAccessQueue = [];
    this._sendEventQueue = [];

    const eventRepos = [{
      events: trackEvents,
      access: accessEvents.length === 0 ? null : this.prepareSendData(accessEvents),
    }];

    return getPlatform().httpRequest.post(this._eventsUrl, {
      "Authorization": this._clientSdkKey,
      "Content-Type": "application/json",
      "UA": getPlatform()?.UA,
    }, JSON.stringify(eventRepos), () => {
      // Do nothing
    }, (error: string) => {
      console.error(`FeatureProbe ${getPlatform()?.UA} SDK: Error reporting events: `, error);
    });

  }
}

// Reference: https://stackoverflow.com/questions/47157428/how-to-implement-a-pseudo-blocking-async-queue-in-js-ts
class AsyncBlockingQueue<T> {
  private promises: Promise<T>[];
  private resolvers: ((t: T) => void)[];

  constructor() {
    this.resolvers = [];
    this.promises = [];
  }

  public enqueue(t: T) {
    if (!this.resolvers.length) {
      this.add();
    }
    this.resolvers.shift()?.(t);
  }

  public dequeue(): Promise<T> | undefined {
    if (!this.promises.length) {
      this.add();
    }
    return this.promises.shift();
  }

  public isEmpty() {
    return !this.promises.length;
  }

  private add() {
    this.promises.push(new Promise(resolve => {
      this.resolvers.push(resolve);
    }));
  }
}
