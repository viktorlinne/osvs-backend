import fs from "fs";
import os from "os";
import path from "path";
import { buildSeedPlan } from "../../src/db/seed";

describe("buildSeedPlan", () => {
  function createTempSeedDir(files: string[]): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "osvs-seed-plan-"));
    for (const file of files) {
      fs.writeFileSync(path.join(dir, file), "-- test seed\n", "utf8");
    }
    return dir;
  }

  test("puts the baseline seed first and then add-on seeds alphabetically", () => {
    const dir = createTempSeedDir([
      "seedUsers.sql",
      "seed.sql",
      "seedPosts.sql",
      "seedGroups.sql",
    ]);

    expect(buildSeedPlan(dir)).toEqual([
      "seed.sql",
      "seedGroups.sql",
      "seedPosts.sql",
      "seedUsers.sql",
    ]);
  });

  test("returns only the baseline seed when baseOnly is enabled", () => {
    const dir = createTempSeedDir(["seed.sql", "seedUsers.sql"]);

    expect(buildSeedPlan(dir, true)).toEqual(["seed.sql"]);
  });

  test("throws when the baseline seed is missing", () => {
    const dir = createTempSeedDir(["seedUsers.sql"]);

    expect(() => buildSeedPlan(dir)).toThrow(
      `Baseline seed file seed.sql is missing in ${dir}`,
    );
  });
});
