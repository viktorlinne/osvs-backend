module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/test"],
  setupFiles: ["<rootDir>/test/setupEnv.ts"],
  clearMocks: true,
  restoreMocks: true,
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
};
