import { assertProductionConfig, checkProductionConfig } from "../../src/config/env";

const goodProduction = {
  NODE_ENV: "production",
  JWT_SECRET: "q3J4vX0y8mB2nC6tK9pL1sR5uW7zA0dF4hG8jE2iO6",
  DB_USER: "osvs",
  DB_PASS: "s3cret-db-pass",
  FRONTEND_URL: "https://osvs.se",
  BACKEND_URL: "https://osvs.se",
  TRUST_PROXY: "1",
  CRON_RUNNER: "true",
  SMTP_HOST: "smtp.websupport.se",
  SMTP_USER: "noreply@osvs.se",
  SMTP_PASS: "smtp-pass",
  MAIL_FROM: "OSVS <noreply@osvs.se>",
  NOMINATIM_USER_AGENT: "OSVS (https://osvs.se; admin@osvs.se)",
};

describe("checkProductionConfig", () => {
  test("no findings outside production", () => {
    expect(checkProductionConfig({ NODE_ENV: "development", JWT_SECRET: "x" })).toEqual({
      errors: [],
      warnings: [],
    });
  });

  test("a complete production config passes", () => {
    expect(checkProductionConfig(goodProduction)).toEqual({ errors: [], warnings: [] });
    expect(assertProductionConfig(goodProduction)).toEqual([]);
  });

  test("refuses a short or placeholder JWT secret", () => {
    expect(checkProductionConfig({ ...goodProduction, JWT_SECRET: "test-secret" }).errors).toHaveLength(1);
    expect(
      checkProductionConfig({ ...goodProduction, JWT_SECRET: "<long random secret>" }).errors,
    ).toHaveLength(1);
  });

  test("refuses the env.production.example placeholders and an http frontend", () => {
    const { errors } = checkProductionConfig({
      ...goodProduction,
      DB_PASS: "<db password>",
      SMTP_PASS: "<smtp password>",
      NOMINATIM_USER_AGENT: "OSVS (https://osvs.se; <contact email>)",
      FRONTEND_URL: "http://osvs.se",
    });
    expect(errors).toHaveLength(4);
    expect(() =>
      assertProductionConfig({ ...goodProduction, DB_PASS: "" }),
    ).toThrow(/Refusing to start/);
  });

  test("warns about settings that are allowed but probably wrong", () => {
    const { errors, warnings } = checkProductionConfig({
      ...goodProduction,
      TRUST_PROXY: "false",
      DB_USER: "root",
      CRON_RUNNER: "false",
      SMTP_HOST: "127.0.0.1",
    });
    expect(errors).toEqual([]);
    expect(warnings).toHaveLength(4);
  });
});
