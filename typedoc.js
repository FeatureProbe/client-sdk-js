
const pkg = require('./package.json');
const PKG_VERSION = pkg.version;

module.exports = {
  out: './docs',
  name: 'FeatureProbe Client Side SDK for JavaScript  (' + PKG_VERSION + ')',
  readme: 'none',
  entryPoints: ["./src/index.ts"]
};