import fs from "fs";
import path from "path";

const schemaPath = path.resolve(__dirname, "../../src/db/schema.sql");
const schemaSql = fs.readFileSync(schemaPath, "utf8");

function getTableDefinition(tableName: string): string {
  const startToken = `CREATE TABLE \`${tableName}\` (`;
  const startIndex = schemaSql.indexOf(startToken);

  if (startIndex < 0) {
    throw new Error(`Table definition not found for ${tableName}`);
  }

  const endIndex = schemaSql.indexOf(") ENGINE", startIndex);
  if (endIndex < 0) {
    throw new Error(`Table definition terminator not found for ${tableName}`);
  }

  return schemaSql.slice(startIndex, endIndex);
}

describe("lookup table schema", () => {
  it("stores role values as unique varchar rows instead of an enum", () => {
    const rolesTable = getTableDefinition("roles");

    expect(rolesTable).toMatch(/`role`\s+varchar\(32\)\s+NOT NULL/i);
    expect(rolesTable).toMatch(/UNIQUE KEY `uq_roles_role` \(`role`\)/i);
    expect(rolesTable).not.toMatch(/`role`\s+enum\(/i);
  });

  it("stores achievement titles as unique varchar rows instead of an enum", () => {
    const achievementsTable = getTableDefinition("achievements");

    expect(achievementsTable).toMatch(/`title`\s+varchar\(128\)\s+NOT NULL/i);
    expect(achievementsTable).toMatch(
      /UNIQUE KEY `uq_achievements_title` \(`title`\)/i,
    );
    expect(achievementsTable).not.toMatch(/`title`\s+enum\(/i);
  });

  it("stores official titles as unique varchar rows instead of an enum", () => {
    const officialsTable = getTableDefinition("officials");

    expect(officialsTable).toMatch(/`title`\s+varchar\(128\)\s+NOT NULL/i);
    expect(officialsTable).toMatch(/UNIQUE KEY `uq_officials_title` \(`title`\)/i);
    expect(officialsTable).not.toMatch(/`title`\s+enum\(/i);
  });

  it("stores allergy titles as unique varchar rows instead of an enum", () => {
    const allergiesTable = getTableDefinition("allergies");

    expect(allergiesTable).toMatch(/`title`\s+varchar\(64\)\s+NOT NULL/i);
    expect(allergiesTable).toMatch(/UNIQUE KEY `uq_allergies_title` \(`title`\)/i);
    expect(allergiesTable).not.toMatch(/`title`\s+enum\(/i);
  });
});
