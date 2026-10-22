import crypto from "crypto";
import fs from "fs";
import path from "path";
import { splitSqlStatements } from "../../src/db/migrateUtils";

/**
 * The runner tracks applied migrations by FILENAME only (`_migrations`), so an
 * edit to an applied file never reaches databases that already ran it, and
 * fresh and upgraded databases silently diverge (this happened with 004, 007
 * and 012). Applied migrations are therefore frozen: change the schema with a
 * NEW numbered file. If an edit is truly intended (e.g. a comment-only fix, or
 * a fix for databases that could never have run the file), update the hash
 * here in the same commit and say why in the commit message.
 *
 * Hashes are of the file with CRLF normalized to LF (Windows checkouts).
 */
const FROZEN: Record<string, string> = {
  "001_initial_schema.sql": "bd963f7a8a5e246973340a197bbcf850cafce70c0e6e602c87b2e7ddbe110c96",
  "002_add_groups_table.sql": "ad148205599c6227c625c9c5aba955cf08084e0734de4f2f6f161a0faa9f6d82",
  "003_event_audience_sources.sql": "dc36d9566b40e88307ba2f9ec6ab018c30eb677ddba96c99965b324b1b813b5d",
  "004_localize_archive.sql": "98c930ab1d17985fc0d8df829f7997020e82f259e763f07223de20ee7582e6ed",
  "005_password_action_tokens.sql": "212028c3d34e3a38dc769f518cfbab147660745357fa29f0dfd3649828f94d3f",
  "006_add_civicno.sql": "936b8158d22ee82685c3e27944b764cc4973154d85f2a5851d086629df62081d",
  "007_extend_archive_enum.sql": "06250acd12ad89874e155b299f72e5e0ba98469d795861731973f250f8afebc7",
  "008_legacy_password_compat.sql": "812bd0acfa9c8b1ebe00db16b7762b87241d9f92f42b3f8bdb9eb054773cd5ee",
  "009_user_flags.sql": "33683ce883b807cd9038f77fd69c40d108adc4dc182c8c7237013472f9c24a1d",
  "010_user_change_log.sql": "a20685ca6d6eda0c117f6d74141fc5961517fe7000bda88b715002b364047f98",
  "011_event_multiple_lodges.sql": "4e6efa269d869935f043e1a79567232ff8f8b2c859460ded0c2a88333e3dfb09",
  "012_archive_enum_avford.sql": "935e502522aea8f2b98cdc44220325acd6268c70e32551b0de63e12fd7b7b9f8",
  "013_group_mailings.sql": "3bfe758ad5971fe22d96f153ddefe78f43b858218d98eeac9cb5cba20aa17f47",
  "014_event_payment_audit.sql": "046080989058e3d32857b65d30bd6c8b1f2925e821850c901a434edeb5896140",
  "015_token_expiry_indexes.sql": "78c64142b1ebf1dbdaab493a67c25e5419ac3628b3b37db616480108b4fa6d2d",
  "016_soft_delete.sql": "99a9a02876f2b1663bca791c231e5feddb9fa0c554da46a628f0d061a11938d3",
  "017_groups_collation.sql": "1a2b630bae094b7f6b22c540bf7e66bca822ab54fe1706fdea9a55444c437005",
};

const dir = path.resolve(__dirname, "../../src/db/migrations");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

function hashOf(file: string): string {
  const text = fs.readFileSync(path.join(dir, file), "utf8").replace(/\r\n/g, "\n");
  return crypto.createHash("sha256").update(text).digest("hex");
}

describe("migrations are append-only", () => {
  test.each(Object.keys(FROZEN))("%s is unchanged", (file) => {
    expect(files).toContain(file);
    expect(hashOf(file)).toBe(FROZEN[file]);
  });

  test("file names use a unique three-digit prefix", () => {
    const prefixes = files.map((f) => {
      const m = /^(\d{3})_[a-z0-9_]+\.sql$/.exec(f);
      expect(m).not.toBeNull();
      return m ? m[1] : "";
    });
    expect(new Set(prefixes).size).toBe(prefixes.length);
  });
});

describe("migration 017 groups collation", () => {
  const statements = splitSqlStatements(
    fs.readFileSync(path.join(dir, "017_groups_collation.sql"), "utf8"),
  );

  test("only changes collation of the four tables created by 002/003", () => {
    expect(statements).toHaveLength(4);
    expect(statements[0]).toMatch(
      /^ALTER TABLE `groups`\s+CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci$/,
    );
    for (const [i, table] of ["users_groups", "groups_events", "users_events"].entries()) {
      expect(statements[i + 1]).toBe(
        `ALTER TABLE \`${table}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`,
      );
    }
  });
});

describe("migration 015 token expiry indexes", () => {
  const statements = splitSqlStatements(
    fs.readFileSync(path.join(dir, "015_token_expiry_indexes.sql"), "utf8"),
  );

  test("only adds indexes", () => {
    expect(statements).toEqual([
      expect.stringMatching(/^ALTER TABLE `refresh_tokens`\s+ADD KEY `idx_refresh_tokens_expiresAt` \(`expiresAt`\)$/),
      expect.stringMatching(/^ALTER TABLE `revoked_tokens`\s+ADD KEY `idx_revoked_tokens_expiresAt` \(`expiresAt`\)$/),
    ]);
  });
});
