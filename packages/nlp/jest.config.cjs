/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.ts"],
  coverageDirectory: "coverage",
  coverageReporters: ["lcov", "text"],
  collectCoverageFrom: ["src/**/*.ts"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        diagnostics: false, // skip type-checking; only transpile
      },
    ],
  },
};
