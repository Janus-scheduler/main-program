/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.ts"],
  // Source files use ESM-style ".js" import specifiers (NodeNext); strip the
  // extension so ts-jest resolves them to the ".ts" sources.
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        diagnostics: false,
        tsconfig: "<rootDir>/tsconfig.test.json",
      },
    ],
  },
};
