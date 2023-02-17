import reportEvents from "../src/autoReportEvents";
import { EventRecorder } from "../src/EventRecorder";
import { FPUser } from "../src/FPUser"; 

import { FetchMock } from "jest-fetch-mock";
import * as data from "./fixtures/events.json";

const _fetch = fetch as FetchMock;

beforeEach(() => {});

afterEach(() => {
  _fetch.resetMocks();
});

test("report events", (done) => {
  _fetch.mockResponseOnce(JSON.stringify(data));
  const clientSdkKey = 'clientSdkKey';
  const eventsUrl = 'http://featureprobe.io/server/event';
  const recorder = new EventRecorder(clientSdkKey, eventsUrl, 10000);
  const user = new FPUser('11111').with("city", "2");

  reportEvents(clientSdkKey, user, eventsUrl, recorder);


  setTimeout(() => {
    document.body.click();
    expect(recorder.eventQueue.length).toBe(3);
    expect(recorder.eventQueue[0].kind).toBe('pageview');
    expect(recorder.eventQueue[1].kind).toBe('pageview');
    expect(recorder.eventQueue[2].kind).toBe('click');
    done();
  }, 100);
});

