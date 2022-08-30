import { FPUser } from "../src/index";

test("user init", (done) => {
  let user = new FPUser();
  const key = user.getKey();
  expect(user.getKey() != undefined);
  setTimeout(() => {
    const key2 = user.getKey();
    expect(key == key2);
    done();
  }, 10);
});

test("user attr", () => {
  const user = new FPUser().with("city", "1").with("type", "browser");
  expect(user.get("city")).toBe("1");
  expect(user.get("type")).toBe("browser");
});

test("user attrs", () => {
  const attrs = { city: "1" };
  let user = new FPUser().extendAttrs(attrs);
  expect(user.getAttrs() == attrs);
});

test("user stable key", () => {
  let user = new FPUser();
  let stableKey = "12jofjaewf";
  user.stableRollout(stableKey);
  expect(user.getKey() == stableKey);
});
