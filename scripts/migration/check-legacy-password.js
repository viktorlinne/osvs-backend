// OSVS-05: check a known password against its stored legacy hash in the
// Access extract, without the password appearing on screen or in any file.
//
// Usage (in your own terminal, NOT through Claude):
//   node scripts/migration/check-legacy-password.js <email | userId | contacts.Id>
// Prints MATCH / NO MATCH and which variant matched. Exit code 0 = match.

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const crypto = require("crypto");

// Same scheme as src/services/legacyPassword.ts (verified against the old
// site's sha256.asp): SHA-256 over password + salt, one byte per UTF-16 code
// unit (low byte), lowercase hex. login.asp doubled apostrophes first.
function legacyHash(password, salt) {
  const s = password + salt;
  const bytes = Buffer.alloc(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i) & 0xff;
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (str) => {
      if (str.includes(question)) rl.output.write(str);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

(async () => {
  const key = process.argv[2];
  if (!key) {
    console.error("Usage: node scripts/migration/check-legacy-password.js <email | userId | contacts.Id>");
    process.exit(2);
  }
  const contacts = JSON.parse(fs.readFileSync(path.join(__dirname, "extract", "contacts.json"), "utf8").replace(/^﻿/, ""));
  const k = key.trim().toLowerCase();
  const c = contacts.find(
    (x) => String(x.Id) === k || String(x.userId || "").toLowerCase() === k || String(x.email || "").trim().toLowerCase() === k,
  );
  if (!c) return console.error(`No contact found for "${key}".`), process.exit(2);
  if (!c.password || !c.passwordSalt) return console.error(`Contact ${c.Id} has no stored legacy hash/salt.`), process.exit(2);

  const password = await askHidden("Lösenord: ");
  const stored = String(c.password).trim().toLowerCase();
  const doubled = legacyHash(password.replace(/'/g, "''"), c.passwordSalt) === stored;
  const raw = legacyHash(password, c.passwordSalt) === stored;
  if (doubled || raw) {
    console.log(`MATCH for contacts.Id ${c.Id} (${doubled ? "login.asp variant, apostrophes doubled" : "raw variant"}).`);
    process.exit(0);
  }
  console.log(`NO MATCH for contacts.Id ${c.Id}.`);
  process.exit(1);
})();
