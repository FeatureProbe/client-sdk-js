import { FeatureProbe, FPUser } from "../src/index";
import { FetchMock } from "jest-fetch-mock";
import * as data from "./fixtures/toggles.json";

const _fetch = fetch as FetchMock;

beforeEach(() => {});

afterEach(() => {
  _fetch.resetMocks();
});

test("FeatureProbe init with invalid param", () => {
  expect(() => {
    new FeatureProbe({
      remoteUrl: "invalid url",
      clientSdkKey: "client-sdk-key1",
      user: new FPUser(),
    });
  }).toThrow();

  expect(() => {
    new FeatureProbe({
      remoteUrl: "invalid url",
      clientSdkKey: "",
      user: new FPUser(),
    });
  }).toThrow();

  expect(() => {
    new FeatureProbe({
      remoteUrl: "http://127.0.0.1:4007",
      clientSdkKey: "client-sdk-key1",
      user: new FPUser(),
      refreshInterval: -1,
    });
  }).toThrow();

  expect(() => {
    new FeatureProbe({
      clientSdkKey: "client-sdk-key1",
      user: new FPUser(),
    });
  }).toThrow();

  expect(() => {
    new FeatureProbe({
      togglesUrl: "http://127.0.0.1:4007",
      clientSdkKey: "client-sdk-key1",
      user: new FPUser(),
    });
  }).toThrow();

  expect(() => {
    new FeatureProbe({
      eventsUrl: "http://127.0.0.1:4007",
      clientSdkKey: "client-sdk-key1",
      user: new FPUser(),
    });
  }).toThrow();
});

test("FeatureProbe init", () => {
  expect(
    new FeatureProbe({
      remoteUrl: "http://127.0.0.1:4007",
      clientSdkKey: "client-sdk-key1",
      user: new FPUser(),
    })
  ).not.toBeNull();
});

test("FeatureProbe request", (done) => {
  _fetch.mockResponseOnce(JSON.stringify(data));
  const user = new FPUser().with("city", "2");
  let fp = new FeatureProbe({
    remoteUrl: "http://127.0.0.1:4007",
    clientSdkKey: "client-sdk-key1",
    user: user,
  });
  fp.start();
  fp.on("ready", function () {
    expect(fp.boolValue("bool_toggle", false)).toBe(true);
    fp.stop();
    done();
  });
});

test("FeatureProbe bool toggle", (done) => {
  _fetch.mockResponseOnce(JSON.stringify(data));
  const user = new FPUser().with("city", "2");
  let fp = new FeatureProbe({
    remoteUrl: "http://127.0.0.1:4007",
    clientSdkKey: "client-sdk-key1",
    user: user,
  });
  fp.start();
  fp.on("ready", function () {
    expect(fp.boolValue("bool_toggle", false)).toBe(true);
    expect(fp.boolValue("string_toggle", false)).toBe(false);
    expect(fp.boolValue("__not_exist_toggle", false)).toBe(false);

    let detail = fp.boolDetail("bool_toggle", false);
    expect(detail.value).toBe(true);
    expect(detail.ruleIndex).toBe(0);

    detail = fp.boolDetail("string_toggle", false);
    expect(detail.value).toBe(false);
    expect(detail.reason).toBe("Value type mismatch");
    done();
  });
});

test("FeatureProbe number toggle", (done) => {
  _fetch.mockResponseOnce(JSON.stringify(data));
  const user = new FPUser().with("city", "2");
  let fp = new FeatureProbe({
    remoteUrl: "http://127.0.0.1:4007",
    clientSdkKey: "client-sdk-key1",
    user: user,
  });
  fp.start();

  fp.on("ready", function () {
    expect(fp.numberValue("number_toggle", 0)).toBe(1);
    expect(fp.numberValue("string_toggle", 0)).toBe(0);
    expect(fp.numberValue("__not_exist_toggle", 1)).toBe(1);

    let detail = fp.numberDetail("number_toggle", 0);
    expect(detail.value).toBe(1);
    expect(detail.ruleIndex).toBe(0);

    detail = fp.numberDetail("string_toggle", 404);
    expect(detail.value).toBe(404);
    expect(detail.reason).toBe("Value type mismatch");
    done();
  });
});

test("FeatureProbe string toggle", (done) => {
  _fetch.mockResponseOnce(JSON.stringify(data));
  const user = new FPUser().with("city", "2");
  let fp = new FeatureProbe({
    remoteUrl: "http://127.0.0.1:4007",
    clientSdkKey: "client-sdk-key1",
    user: user,
  });
  fp.start();
  fp.on("ready", function () {
    expect(fp.stringValue("string_toggle", "ok")).toBe("1");
    expect(fp.stringValue("bool_toggle", "not_match")).toBe("not_match");
    expect(fp.stringValue("__not_exist_toggle", "not_exist")).toBe("not_exist");

    let detail = fp.stringDetail("bool_toggle", "not match");
    expect(detail.value).toBe("not match");
    expect(detail.reason).toBe("Value type mismatch");

    detail = fp.stringDetail("string_toggle", "defaultValue");
    expect(detail.value).toBe("1");
    expect(detail.ruleIndex).toBe(0);

    done();
  });
});

test("FeatureProbe json toggle", (done) => {
  _fetch.mockResponseOnce(JSON.stringify(data));
  const user = new FPUser().with("city", "2");
  let fp = new FeatureProbe({
    remoteUrl: "http://127.0.0.1:4007",
    clientSdkKey: "client-sdk-key1",
    user: user,
  });
  fp.start();

  fp.on("ready", function () {
    expect(fp.jsonValue("json_toggle", {})).toMatchObject({
      v: "v1",
      variation_0: "c2",
    });
    expect(fp.jsonValue("bool_toggle", {})).toMatchObject({});
    expect(fp.jsonValue("__not_exist_toggle", {})).toMatchObject({});

    let detail = fp.jsonDetail("bool_toggle", {});
    expect(detail.value).toMatchObject({});
    expect(detail.reason).toBe("Value type mismatch");

    detail = fp.jsonDetail("json_toggle", {});
    expect(detail.value).toMatchObject({});
    expect(detail.ruleIndex).toBe(0);
    done();
  });
});

test("FeatureProbe all toggle", (done) => {
  _fetch.mockResponseOnce(JSON.stringify(data));
  const user = new FPUser().with("city", "2");
  let fp = new FeatureProbe({
    remoteUrl: "http://127.0.0.1:4007",
    clientSdkKey: "client-sdk-key1",
    user: user,
  });
  fp.start();

  fp.on("ready", function () {
    expect(fp.allToggles()).toMatchObject(data);
    done();
  });
});

test("FeatureProbe unit testing", (done) => {
  let fp = FeatureProbe.newForTest({ testToggle: true });

  fp.on("ready", function () {
    let t = fp.boolValue("testToggle", false);
    expect(t).toBe(true);
    done();
  });
});

test("FeatureProbe used toggle value before ready", (done) => {
  _fetch.mockResponseOnce(JSON.stringify(data));
  const user = new FPUser().with("city", "2");
  let fp = new FeatureProbe({
    remoteUrl: "http://127.0.0.1:4007",
    clientSdkKey: "client-sdk-key1",
    user: user,
  });
  fp.start();

  expect(fp.boolValue("bool_toggle", false)).toBe(false);
  expect(fp.boolDetail("bool_toggle", false)).toMatchObject({
    value: false,
    ruleIndex: null,
    variationIndex: null,
    version: 0,
    reason: "Not ready",
  });
  done();
});

test("FeatureProbe used toggle value with error key", (done) => {
  _fetch.mockResponseOnce(JSON.stringify(data));
  const user = new FPUser().with("city", "2");
  let fp = new FeatureProbe({
    remoteUrl: "http://127.0.0.1:4007",
    clientSdkKey: "client-sdk-key1",
    user: user,
  });
  fp.start();

  fp.on('ready', () => {
    expect(fp.boolValue("error_toggle", false)).toBe(false);
    expect(fp.boolDetail("error_toggle", false)).toMatchObject({
      value: false,
      ruleIndex: null,
      variationIndex: null,
      version: null,
      reason: "Toggle: [error_toggle] not found",
    });
    done();
  });
});

test("FeatureProbe logout", (done) => {
  _fetch.mockResponseOnce(JSON.stringify(data));
  const user = new FPUser().with("city", "2");
  expect(user.get('city')).toBe('2');
  let fp = new FeatureProbe({
    remoteUrl: "http://127.0.0.1:4007",
    clientSdkKey: "client-sdk-key1",
    user: user,
  });
  fp.logout();
  expect(fp.getUser().get('city')).toBe(undefined);
  done();
});

test("feature promise api", (done) => {
  _fetch.mockResponseOnce(JSON.stringify(data));
  let fp = new FeatureProbe({
    remoteUrl: "http://127.0.0.1:4007",
    clientSdkKey: "client-sdk-key1",
    user: new FPUser(),
  });
  fp.start();

  fp.waitUntilReady().then(() => {
    done();
  });
});

test("FeatureProbe fetch error", (done) => {
  _fetch.mockRejectOnce(new Error("test error"));

  let fp = new FeatureProbe({
    remoteUrl: "http://error.error",
    clientSdkKey: "client-sdk-key1",
    user: new FPUser(),
    refreshInterval: 10000,
  });
  fp.start();

  done();
});

test("FeatureProbe fetch error trigger error event", (done) => {
  _fetch.mockReject(new Error("test error"));

  let fp = new FeatureProbe({
    remoteUrl: "http://error.error",
    clientSdkKey: "client-sdk-key1",
    user: new FPUser(),
    refreshInterval: 10000,
    timeoutInterval: 1000,
  });

  fp.on('error', () =>{
    done();
  });

  fp.start();
});
