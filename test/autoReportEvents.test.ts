import reportEvents from "../src/autoReportEvents";
import { FeatureProbe } from "../src/FeatureProbe";
import { FPUser } from "../src/FPUser"; 

import { FetchMock } from "jest-fetch-mock";
import * as data from "./fixtures/events.json";

const _fetch = fetch as FetchMock;
let originalError: () => void;

beforeEach(() => {
  originalError = console.error;
  console.error = jest.fn();
});

afterEach(() => {
  _fetch.resetMocks();
  console.error = originalError;
});

test("report events", (done) => {
  _fetch.mockResponseOnce(JSON.stringify(data));
  const clientSdkKey = 'clientSdkKey';
  const user = new FPUser('11111').with("city", "2");
  const DELAY = 100;
  const fp = new FeatureProbe({
    clientSdkKey,
    user,
    remoteUrl: 'http://featureprobe.io/server',
  });

  reportEvents(fp);

  setTimeout(() => {
    document.body.click();
    expect(fp.eventRecorder.eventQueue.length).toBe(3);
    expect(fp.eventRecorder.eventQueue.shift()?.kind).toBe('pageview');
    expect(fp.eventRecorder.eventQueue.shift()?.kind).toBe('pageview');
    expect(fp.eventRecorder.eventQueue.shift()?.kind).toBe('click');
    done();
  }, DELAY);
});
