import path from "path";
import commonjs from "@rollup/plugin-commonjs";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import json from "@rollup/plugin-json";
import inject from "@rollup/plugin-inject";
import { dts } from "rollup-plugin-dts";

const rootOutDir = "dist"
const outDirNode = path.join(rootOutDir, "node");
const outDirBrowser = path.join(rootOutDir, "esm");

const typescriptConfig = {
  tsconfig: path.resolve(`./tsconfig.build.json`),
  include: ["src/**/*.ts",  "src/**/*.js"],
  exclude: ["**/*spec.ts", "__mocks__", "tests/*"],
  outputToFilesystem: false,
}

// External dependencies that should not be bundled
const external = [
  'viem',
  'viem/accounts',
  'viem/chains',
  'maci-crypto',
];

export default [

  {
    input: "src/index.ts",
    output: [
      {
        dir: outDirBrowser,
        format: "esm",
        sourcemap: true,
        entryFileNames: "[name].mjs"
      },
    ],
    external,
    plugins: [
      nodeResolve({
        exportConditions: ["umd"],
        browser: true,
        preferBuiltins: true,
      }),
      commonjs({ requireReturnsDefault: "auto" }),
      json(),
      typescript({
        ...typescriptConfig,
        declaration: false,
        noEmit: true,
      }),
    ],
  },

  {
    input: "src/index.ts",
    output: [
      {
        dir: outDirNode,
        format: "esm",
        sourcemap: true,
        entryFileNames: "[name].mjs"
      },
    ],
    external,
    plugins: [
      nodeResolve({
        exportConditions: ["node"],
        browser: false,
        preferBuiltins: true,
      }),
      commonjs({ requireReturnsDefault: "auto" }),
      inject({
        __filename: path.resolve("src/filename.helper.js"),
        __dirname: path.resolve("src/dirname.helper.js")
      }),
      json(),
      typescript({
        ...typescriptConfig,
        declaration: false,
        noEmit: true,
      }),
    ],
  },

  {
    input: "src/index.ts",
    output: [
      {
        dir: path.join(rootOutDir, "types"),
        sourcemap: false,
      },
    ],
    external,
    plugins: [
      nodeResolve({
        exportConditions: ["node"],
        browser: false,
        preferBuiltins: true,
      }),
      commonjs({ requireReturnsDefault: "auto" }),
      json(),
      typescript({
        ...typescriptConfig,
        declaration: true,
        declarationDir: path.join(rootOutDir, "types"),
        emitDeclarationOnly: true,
      }),
    ],
  },

  {
    input: path.join(rootOutDir, "types", "index.d.ts"),
    output: [{ file: path.join(rootOutDir, "index.d.mts"), format: "esm" }],
    external,
    plugins: [dts()],
  }

];

