import { FPUser } from "../src/index";

test("user init", () => {
  let user = new FPUser("some-key");
  expect(user.getKey()).toBe("some-key");
});

test("user attr", () => {
  let user = new FPUser("some-key").with("city", "1").with("type", "browser");
  expect(user.get("city")).toBe("1");
  expect(user.get("type")).toBe("browser");
});
