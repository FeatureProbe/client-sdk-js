import "whatwg-fetch";
import { IHttpRequest, IPlatForm } from "./types";
import { io } from "socket.io-client";
import StorageProvider from "./localStorage";
import pkg from "../package.json";

const PKG_VERSION = pkg.version;
const UA = "JS/" + PKG_VERSION;

const httpRequest:IHttpRequest = {
  get: function(url, headers, data, successCb, errorCb) {
    fetch(url.toString() + "?" + new URLSearchParams(data), {
      method: "GET",
      cache: "no-cache",
      headers: headers,
    })
    .then(response => {
      if (response.status >= 200 && response.status < 300) {
        return response;
      } else {
        const error: Error = new Error(response.statusText);
        throw error;
      }
    })
    .then(response => response.json())
    .then(json => {
      successCb(json);
    })
    .catch(e => {
      errorCb(e);
    });
  },
  post: function(url, headers, data, successCb, errorCb) {
    fetch(url.toString(), {
      method: "POST",
      cache: "no-cache",
      headers: headers,
      body: data,
      keepalive: true,
    })
    .then(response => {
      if (response.status >= 200 && response.status < 300) {
        return response;
      } else {
        const error: Error = new Error(response.statusText);
        throw error;
      }
    })
    // .then(response => response.json())
    .then(() => {
      successCb();
    })
    .catch(e => {
      errorCb(e);
    });
  }
};

const Platform: {
  default: IPlatForm
} = {
  default: {
    UA: UA,
    localStorage: new StorageProvider(),
    httpRequest: httpRequest,
    socket: io,
  }
}; 

function setPlatform(platform: IPlatForm): void {
  Platform.default = platform;
}

function getPlatform(): IPlatForm {
  return Platform.default;
}

export { getPlatform, setPlatform };
