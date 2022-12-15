import "whatwg-fetch";
import { IPlatForm } from "./types";
import StorageProvider from "./localStorage";
import pkg from '../package.json';

const PKG_VERSION = pkg.version;
const UA = "JS/" + PKG_VERSION;

const httpRequest: any = {};

httpRequest.get = function(url: string, headers: any, data: any, successCb: any, errorCb: any) {
  fetch(url.toString() + '?' + new URLSearchParams(data), {
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
  .catch((e: any) => {
    errorCb(e);
  });
}

httpRequest.post = function(url: string, headers: any, data: any, successCb: any, errorCb: any) {
  fetch(url.toString(), {
    method: "POST",
    cache: "no-cache",
    headers: headers,
    body: data,
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
  .catch((e: any) => {
    errorCb(e);
  });
}

const platform: IPlatForm = {
  UA: UA,
  localStorage: new StorageProvider(),
  httpRequest: httpRequest,
};

export default platform;