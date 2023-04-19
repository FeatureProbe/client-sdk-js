import { initializePlatform } from "../src/index";
import { getPlatform } from "../src/platform"
import StorageProvider from "../src/localStorage";
import { IHttpRequest } from '../src/types';
import { io } from "socket.io-client";

const httpRequest:IHttpRequest = {
  get: function() {},
  post: function() {}
};

test("initializePlatform", (done) => {
  const platform = {
    UA: 'SSS',
    httpRequest: httpRequest,
    localStorage: new StorageProvider(),
    socket: io,
  }

  initializePlatform({
    platform: platform
  });

  expect(getPlatform()).toMatchObject(platform);
  done();
});
