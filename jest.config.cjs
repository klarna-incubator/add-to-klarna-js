/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  // Map TS-style ".js" import suffixes back to source files (matches the
  // Node16/Bundler resolver convention used in src/).
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  testMatch: ["<rootDir>/test/**/*.test.ts"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: "test/tsconfig.json",
      },
    ],
  },
  collectCoverageFrom: ["src/**/*.ts", "!src/index.ts", "!src/types.ts"],
  coverageReporters: ["text", "html", "lcov"],
};
