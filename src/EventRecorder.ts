import { getPlatform } from "./platform";
import { IAccessEvent, IAccess, IToggleCounter, ClickEvent, PageViewEvent, AccessEvent, CustomEvent } from "./types";

export class EventRecorder {
  private clientSdkKey: string;
  private eventsUrl: string;
  private closed: boolean;
  private sendAccessQueue: IAccessEvent[];
  private sendEventQueue: (AccessEvent | CustomEvent | ClickEvent | PageViewEvent)[];
  private taskQueue: AsyncBlockingQueue<Promise<void>>;
  private timer: NodeJS.Timer;
  private readonly dispatch: Promise<void>;

  set flushInterval(value: number) {
    clearInterval(this.timer);
    this.timer = setInterval(() => this.flush(), value);
  }

  get accessQueue(): IAccessEvent[] {
    return this.sendAccessQueue;
  }

  get eventQueue(): (AccessEvent | CustomEvent | ClickEvent | PageViewEvent)[] {
    return this.sendEventQueue;
  }

  constructor(
    clientSdkKey: string,
    eventsUrl: string,
    flushInterval: number,
  ) {
    this.clientSdkKey = clientSdkKey;
    this.eventsUrl = eventsUrl;
    this.closed = false;
    this.sendAccessQueue = [];
    this.sendEventQueue = [];
    this.taskQueue = new AsyncBlockingQueue<Promise<void>>();
    this.timer = setInterval(() => this.flush(), flushInterval);
    this.dispatch = this.startDispatch();
  }

  public recordAccessEvent(accessEvent: IAccessEvent): void {
    if (this.closed) {
      console.warn("Trying to push access record to a closed EventProcessor, omitted");
      return;
    }
    this.sendAccessQueue.push(accessEvent);
  }

  public recordTrackEvent(trackEvents: ClickEvent | PageViewEvent | AccessEvent | CustomEvent): void {
    if (this.closed) {
      console.warn("Trying to push access record to a closed EventProcessor, omitted");
      return;
    }
    this.sendEventQueue.push(trackEvents);
  }

  public flush(): void {
    if (this.closed) {
      console.warn("Trying to flush a closed EventProcessor, omitted");
      return;
    }
    this.taskQueue.enqueue(this.doFlush());
  }

  public async stop(): Promise<void> {
    if (this.closed) {
      console.warn("EventProcessor is already closed");
      return;
    }
    clearInterval(this.timer);
    this.closed = true;
    this.taskQueue.enqueue(this.doFlush());
    await this.dispatch;
  }

  private async startDispatch(): Promise<void> {
    while (!this.closed || !this.taskQueue.isEmpty()) {
      await this.taskQueue.dequeue();
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
    if (this.sendAccessQueue.length === 0 && this.sendEventQueue.length === 0) {
      return;
    }
    const accessEvents = Object.assign([], this.sendAccessQueue);
    const trackEvents = Object.assign([], this.sendEventQueue);
    
    this.sendAccessQueue = [];
    this.sendEventQueue = [];

    const eventRepos = [{
      events: trackEvents,
      access: accessEvents.length === 0 ? null : this.prepareSendData(accessEvents),
    }];

    getPlatform().httpRequest.post(this.eventsUrl, {
      "Authorization": this.clientSdkKey,
      "Content-Type": "application/json",
      "UA": getPlatform()?.UA,
    }, JSON.stringify(eventRepos), () => {
      // Do nothing
    }, (error: string) => {
      console.error("FeatureProbe JS SDK: Error reporting events: ", error);
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

  private add() {
    this.promises.push(new Promise(resolve => {
      this.resolvers.push(resolve);
    }));
  }

  enqueue(t: T) {
    if (!this.resolvers.length) {
      this.add();
    }
    this.resolvers.shift()?.(t);
  }

  dequeue(): Promise<T> | undefined {
    if (!this.promises.length) {
      this.add();
    }
    return this.promises.shift();
  }

  isEmpty() {
    return !this.promises.length;
  }
}
