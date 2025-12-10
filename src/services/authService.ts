import argon2 from "argon2";

const ARGON2_MEMORY_KB = Number(process.env.ARGON2_MEMORY_KB ?? 65536); // 64 MB
const ARGON2_TIME = Number(process.env.ARGON2_TIME ?? 3);
const ARGON2_PARALLELISM = Number(process.env.ARGON2_PARALLELISM ?? 1);

export async function hashPassword(password: string): Promise<string> {
  const options = {
    type: argon2.argon2id,
    memoryCost: ARGON2_MEMORY_KB,
    timeCost: ARGON2_TIME,
    parallelism: ARGON2_PARALLELISM,
  };

  const out = await argon2.hash(password, options);
  // argon2.hash returns a string; coerce to string to be defensive
  return String(out);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}
