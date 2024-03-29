import typescript from "rollup-plugin-typescript2";
import minify from "rollup-plugin-babel-minify";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import nodePolyfills from "rollup-plugin-node-polyfills";

export default {
  input: "./src/index.ts",
  output: [
    {
      file: "./dist/featureprobe-client-sdk-js.min.js",
      format: "iife",
      name: "featureProbe",
    },
  ],
  plugins: [
    resolve({
      browser: true,
    }),
    commonjs({
      include: "node_modules/**",
    }),
    typescript({ tsconfigOverride: { compilerOptions: { module: "ES2015" } } }),
    minify({ comments: false }),
    json(),
    nodePolyfills(),
  ],
};
