#!/usr/bin/env node
/**
 * Checks that the active Node version satisfies `engines.node` in package.json.
 * Run from repo root: node scripts/check-node-version.js [verbose]
 *
 * Must not import packages from node_modules (safe before `npm ci`). Optional manual check; installs use `engine-strict=true` in `.npmrc` with `package.json` → `engines`.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { styleText } from "node:util";

const VERBOSE_FORCED = false;
const args = process.argv.slice(2);
const VERBOSE = VERBOSE_FORCED || (args.length > 0 && args[0] === "verbose");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_PATH = path.resolve(__dirname, "..", "package.json");

const printSuccessAndExit = (x) => {
  const line = "------------------------";
  console.log(styleText("green", line));
  console.log(styleText("green", x));
  console.log(styleText("green", line));
  process.exit(0);
};

const printErrAndExit = (x) => {
  const line = "------------------------";
  console.error(styleText("red", line));
  console.error(styleText("red", x));
  console.error(styleText("red", "Aborting..."));
  console.error(styleText("red", line));
  process.exit(1);
};

const parseVersion = (v) => {
  const cleaned = v.replace(/^v/i, "").split(/[.+]/);
  return {
    major: Number.parseInt(cleaned[0] ?? "0", 10) || 0,
    minor: Number.parseInt(cleaned[1] ?? "0", 10) || 0,
    patch: Number.parseInt(cleaned[2] ?? "0", 10) || 0,
  };
};

const cmp = (a, b) => {
  if (a.major !== b.major) {
    return a.major - b.major;
  }
  if (a.minor !== b.minor) {
    return a.minor - b.minor;
  }
  return a.patch - b.patch;
};

/**
 * Subset of semver ranges used in `engines` (no full semver spec).
 * Supports: >=, >, <=, <, ^, ~, exact, * / empty, and simple "||" alternatives.
 */
const satisfiesEngine = (version, range) => {
  const v = parseVersion(version);
  const r = range.trim();
  if (!r || r === "*") {
    return true;
  }

  if (r.includes("||")) {
    return r.split("||").some((part) => satisfiesEngine(version, part));
  }

  const opMatch = r.match(/^(>=|<=|>|<|=|\^|~)?\s*(.+)$/);
  const op = opMatch?.[1] ?? "";
  const rest = (opMatch?.[2] ?? r).trim();

  if (rest === "*") {
    return true;
  }

  if (op === "^") {
    const min = parseVersion(rest);
    if (cmp(v, min) < 0) {
      return false;
    }
    return v.major === min.major;
  }

  if (op === "~") {
    const min = parseVersion(rest);
    if (cmp(v, min) < 0) {
      return false;
    }
    return v.major === min.major && v.minor === min.minor;
  }

  const bound = parseVersion(rest.replace(/^v/i, ""));
  if (op === ">=" || op === "") {
    return cmp(v, bound) >= 0;
  }
  if (op === ">") {
    return cmp(v, bound) > 0;
  }
  if (op === "<=") {
    return cmp(v, bound) <= 0;
  }
  if (op === "<") {
    return cmp(v, bound) < 0;
  }
  if (op === "=") {
    return cmp(v, bound) === 0;
  }

  return cmp(v, bound) === 0;
};

const checkNodeVersion = (nodeVersionRequired) => {
  if (!nodeVersionRequired) {
    console.log("No required node version specified in package.json");
    return;
  }
  const nodeVersion = process.version;
  if (VERBOSE) {
    console.log(`node required: '${nodeVersionRequired}' - current: '${nodeVersion}'`);
  }

  console.log("Current Node version -> ", nodeVersion);
  if (!satisfiesEngine(nodeVersion, nodeVersionRequired)) {
    printErrAndExit(`Node version - MISMATCH\nRequired: '${nodeVersionRequired}' | Current: '${nodeVersion}'`);
  } else {
    printSuccessAndExit(`Node version - OK\nCurrent: '${nodeVersion}'`);
  }
};

const json = JSON.parse(fs.readFileSync(PKG_PATH, "utf8"));
if (!json.engines) {
  printErrAndExit("no engines entry in package json?");
}
checkNodeVersion(json.engines.node);
