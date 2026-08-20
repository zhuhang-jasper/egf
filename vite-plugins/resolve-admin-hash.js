import { loadEnv } from "vite";

import { pbkdf2Sync } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * PBKDF2 parameters. Shared with the runtime check in constants/features.js — changing either side alone
 * invalidates every password. The salt is NOT a secret: it ships in the bundle and exists to defeat
 * precomputed tables, so it is a constant here rather than a second thing to manage in CI.
 */
export const ADMIN_PBKDF2 = {
  salt: "7aed937406415246e7d075db043a0d7f",
  iterations: 600000,
  keyLengthBytes: 32,
  hash: "SHA-256",
};

/**
 * Hash VITE_ADMIN_PASSWORD at build time so the plaintext never reaches the bundle. Returns "" when the
 * secret is unset (local dev, preview, fork PRs), which leaves admin locked — see features.js.
 *
 * This raises the cost of recovering the password from a shipped bundle; it does NOT protect the gate,
 * which is still a client-side check. See docs/DECISIONS.md#admin-gating-is-not-a-security-boundary.
 */
export const resolveAdminPasswordHash = (mode = process.env.NODE_ENV || "development") => {
  // loadEnv, NOT `process.env` and NOT `import.meta.env`, and each exclusion matters:
  //  - `import.meta.env` would mean Vite inlining the PLAINTEXT into client code, which is the whole thing
  //    this file exists to avoid. Only the digest below may cross into the bundle.
  //  - `process.env` alone misses `.env.local`: Vite never copies those files into it, so the hash came out
  //    empty in dev and the unlock prompt silently never appeared.
  //  - loadEnv covers both, since it merges prefixed `process.env` vars over the `.env` files. So CI's real
  //    env var wins over a local file, which is the precedence we want.
  const password = loadEnv(mode, repoRoot, "VITE_").VITE_ADMIN_PASSWORD?.trim();
  if (!password) {
    return "";
  }
  return pbkdf2Sync(
    password,
    ADMIN_PBKDF2.salt,
    ADMIN_PBKDF2.iterations,
    ADMIN_PBKDF2.keyLengthBytes,
    ADMIN_PBKDF2.hash.replace("-", "").toLowerCase(),
  ).toString("hex");
};
