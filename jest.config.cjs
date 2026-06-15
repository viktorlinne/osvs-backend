module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/test"],
  setupFiles: ["<rootDir>/test/setupEnv.ts"],
  clearMocks: true,
  restoreMocks: true,
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
  collectCoverageFrom: [
    "src/middleware/auth.ts",
    "src/services/sessionService.ts",
    "src/services/membershipPaymentsService.ts",
    "src/controllers/eventsController.ts",
    "src/controllers/paymentsController.ts",
  ],
  coverageThreshold: {
    global: {
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0,
    },
  },
};
