import "whatwg-fetch";
import { IPlatForm } from "./types";
import StorageProvider from "./localStorage";
import pkg from '../package.json';

const PKG_VERSION = pkg.version;
const UA = "JS/" + PKG_VERSION;

const platform: IPlatForm = {
  _fetch: window.fetch.bind(window),
  localStorage: new StorageProvider(),
  UA: UA,
};

export default platform;