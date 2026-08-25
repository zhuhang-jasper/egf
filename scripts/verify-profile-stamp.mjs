/**
 * verify-profile-stamp.mjs
 *
 * Fixture table for src/utils/profile-stamp.js: stamp resolution and per-pillar staleness. Pure input →
 * output, no DOM and no browser, because the resolver takes its changelog as a parameter rather than
 * importing one. That injection is the whole reason this runs under bare node: changelog.js resolves an
 * `@/` alias on line 1 and reads `import.meta.env.DEV`, neither of which node can do.
 *
 * Most cases below stub their own tiny release history so a band rule is tested against known data rather
 * than against whatever v4.3 happens to have authored.
 *
 * Usage:
 *   node scripts/verify-profile-stamp.mjs
 *   node scripts/verify-profile-stamp.mjs --filter band
 *
 * Exits 0 when every case passes, 1 on the first failing run (all failures are printed first).
 */

import {
  isFlaggable,
  movedLevelsSince,
  PILLAR_STATE,
  resolvePillarState,
  resolveProfileStamp,
  resolveProfileState,
  STAMP_SOURCE,
} from "../src/utils/profile-stamp.js";

const filter = process.argv.includes("--filter") ? process.argv[process.argv.indexOf("--filter") + 1] : null;

const results = [];

function check(group, name, actual, expected) {
  if (filter && !group.toLowerCase().includes(filter.toLowerCase())) {
    return;
  }
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  results.push({ group, name, pass, actual, expected });
}

// A stand-in release history. Only `version` and the two moved-level fields matter to the resolver.
const HISTORY = [{ version: "4.3" }, { version: "4.2" }, { version: "4.1" }, { version: "4.0" }, { version: "3.2" }, { version: "3.0" }];

/** HISTORY with moved levels grafted onto the named versions. */
function stub(moves) {
  return HISTORY.map((entry) => ({ ...entry, ...(moves[entry.version] ?? {}) }));
}

// ── Stamp resolution: recorded stamp, else inferred from savedAt ──────────────────────────────────
// The rows that carry this table: a recorded stamp always wins, an unstamped profile is dated from its OWN
// savedAt, and a profile older than any shipped release is `unknown` — never the current version. Because
// stamping began in 4.3, an unstamped profile after the 4.2 boundary still resolves to 4.2.
{
  const g = "stamp";
  // Real bump timestamps, mirroring LEGACY_RELEASES in profile-stamp.js.
  const T = (iso) => Date.parse(iso);
  const AT = {
    v43: T("2026-08-20T00:00+08:00"),
    v42: T("2026-08-10T00:00+08:00"),
    v41: T("2026-07-28T00:00+08:00"),
    v32: T("2026-07-20T00:00+08:00"),
    v31: T("2026-07-10T00:00+08:00"),
    ancient: T("2026-01-01T00:00+08:00") /* before the first commit */,
  };
  const row = (frameworkVersion, savedAt) => {
    const p = { id: "p1", savedAt: savedAt ?? 0 };
    return frameworkVersion === undefined ? p : { ...p, frameworkVersion };
  };
  const resolve = (profile) => resolveProfileStamp({ profile });

  // Unstamped: the version that was LIVE when the profile was saved.
  check(g, "saved after stamping began", resolve(row(undefined, AT.v43)), { version: "4.2", source: STAMP_SOURCE.derived });
  check(g, "saved during 4.2", resolve(row(undefined, AT.v42)), { version: "4.2", source: STAMP_SOURCE.derived });
  check(g, "saved during 4.1", resolve(row(undefined, AT.v41)), { version: "4.1", source: STAMP_SOURCE.derived });
  check(g, "saved during 3.2", resolve(row(undefined, AT.v32)), { version: "3.2", source: STAMP_SOURCE.derived });
  check(g, "saved during 3.1", resolve(row(undefined, AT.v31)), { version: "3.1", source: STAMP_SOURCE.derived });
  // 2.9 and 2.8 predate the changelog — they were hardcoded on the Theory nav label. Dates in that window
  // must still name a version rather than falling to unknown.
  check(g, "saved before 3.1 dates to 2.9", resolve(row(undefined, T("2026-07-05T00:00+08:00"))), { version: "2.9", source: STAMP_SOURCE.derived });
  check(g, "saved in the 2.8 window", resolve(row(undefined, T("2026-06-18T00:00+08:00"))), { version: "2.8", source: STAMP_SOURCE.derived });
  // 2.4-2.7 are dated from the source PDF's own revision timestamps, since the app showed no version yet.
  check(g, "saved in the 2.7 window", resolve(row(undefined, T("2026-06-12T00:00+08:00"))), { version: "2.7", source: STAMP_SOURCE.derived });
  check(g, "saved in the 2.6 window", resolve(row(undefined, T("2026-06-10T12:30:00+08:00"))), { version: "2.6", source: STAMP_SOURCE.derived });
  check(g, "saved in the 2.4 window", resolve(row(undefined, T("2026-06-09T18:00:00+08:00"))), { version: "2.4", source: STAMP_SOURCE.derived });
  // Only a date before any known version has nothing to infer from.
  check(g, "saved before 2.4 existed", resolve(row(undefined, T("2026-06-08T00:00+08:00"))), { version: null, source: STAMP_SOURCE.unknown });
  check(g, "saved before the app existed", resolve(row(undefined, AT.ancient)), { version: null, source: STAMP_SOURCE.unknown });
  check(g, "no savedAt at all", resolve(row(undefined, 0)), { version: null, source: STAMP_SOURCE.unknown });

  // 4.0 AND 3.0 NEVER SHIPPED: the live bump went 3.2 -> 4.1 in one commit, so no profile can date to
  // either. A save in the window the changelog labels "4.0" must infer 3.2, the version actually running.
  check(g, "never-shipped 4.0 window infers 3.2", resolve(row(undefined, T("2026-07-25T00:00+08:00"))), {
    version: "3.2",
    source: STAMP_SOURCE.derived,
  });

  // A RECORDED STAMP ALWAYS WINS, including one older than the date would suggest. This is the precedence
  // canary: inverting it would re-date a correctly-stamped profile from when it happened to be re-saved.
  check(g, "recorded 4.2 beats a 4.3-era savedAt", resolve(row("4.2", AT.v43)), { version: "4.2", source: STAMP_SOURCE.recorded });
  check(g, "recorded 3.1 beats a 4.3-era savedAt", resolve(row("3.1", AT.v43)), { version: "3.1", source: STAMP_SOURCE.recorded });
  // Below the changelog floor but still a version: kept, and ranks Infinity, i.e. "older than everything".
  check(g, "recorded 2.9 is kept", resolve(row("2.9", AT.v43)), { version: "2.9", source: STAMP_SOURCE.recorded });

  // Junk stamps carry no version, so they fall through to the date like any unstamped row.
  for (const bad of [42, null, "x", {}, ""]) {
    check(g, `junk stamp ${JSON.stringify(bad)} falls through to the date`, resolve({ id: "p1", frameworkVersion: bad, savedAt: AT.v42 }), {
      version: "4.2",
      source: STAMP_SOURCE.derived,
    });
  }
  check(g, "junk stamp + ancient date is unknown", resolve({ id: "p1", frameworkVersion: 42, savedAt: AT.ancient }), {
    version: null,
    source: STAMP_SOURCE.unknown,
  });
}

// ── Bands: level scoping, the inclusive upper edge, and the gap ────────────────────────────────────
{
  const g = "band";
  const archL1 = stub({ "4.3": { barRaised: { architecture: [1] } } });
  const state = (changelog, pillar, score, stamp) => resolvePillarState({ pillar, score, stamp, changelog });

  check(g, "arch 1.0 flags", state(archL1, "architecture", 1.0, "4.2"), PILLAR_STATE.raised);
  check(g, "arch 1.5 flags", state(archL1, "architecture", 1.5, "4.2"), PILLAR_STATE.raised);
  // CANARY: the band's upper edge is inclusive. A 2.0 asserts L1, so a hardened L1 puts it in question.
  check(g, "arch 2.0 flags (inclusive upper edge)", state(archL1, "architecture", 2.0, "4.2"), PILLAR_STATE.raised);
  check(g, "arch 2.5 does not flag (past the band)", state(archL1, "architecture", 2.5, "4.2"), PILLAR_STATE.clear);
  // CANARY: level scoping. Someone at L4 plainly clears a slightly-harder L1.
  check(g, "arch 4.0 does not flag (level scoping)", state(archL1, "architecture", 4.0, "4.2"), PILLAR_STATE.clear);
  check(g, "untouched pillar does not flag", state(archL1, "coding", 1.5, "4.2"), PILLAR_STATE.clear);
  check(g, "stamp equal to the raise does not flag", state(archL1, "architecture", 1.0, "4.3"), PILLAR_STATE.clear);

  // CANARY: `levels` is a SET, not a ceiling and not a range. L1 and L4 hardened, L2-L3 untouched.
  const codingIslands = stub({ "4.3": { barRaised: { coding: [1, 4] } } });
  check(g, "coding 3.0 does not flag (the L2-L3 gap)", state(codingIslands, "coding", 3.0, "4.2"), PILLAR_STATE.clear);
  check(g, "coding 1.5 flags (lower island)", state(codingIslands, "coding", 1.5, "4.2"), PILLAR_STATE.raised);
  check(g, "coding 4.5 flags (upper island)", state(codingIslands, "coding", 4.5, "4.2"), PILLAR_STATE.raised);
  check(g, "coding 5.0 flags (4 to 5 inclusive)", state(codingIslands, "coding", 5.0, "4.2"), PILLAR_STATE.raised);

  // CANARY: direction. A release that only clarified must flag nobody.
  const clarifiedOnly = stub({ "4.3": {} });
  for (const score of [0, 1, 2.5, 4, 5]) {
    check(g, `clarify-only release does not flag at ${score}`, state(clarifiedOnly, "architecture", score, "4.2"), PILLAR_STATE.clear);
  }

  // A raise from an INTERMEDIATE version still counts.
  const uiUxAt42 = stub({ "4.2": { barRaised: { uiUx: [5] } } });
  check(g, "raise at 4.2 flags a 4.1 stamp", state(uiUxAt42, "uiUx", 5.0, "4.1"), PILLAR_STATE.raised);

  check(g, "unknown stamp is unverified, not stale", state(archL1, "architecture", 1.0, null), PILLAR_STATE.unverified);
}

// ── Half-step anchoring: the case a floor/ceil shortcut gets wrong ─────────────────────────────────
{
  const g = "halfstep";
  const l5 = stub({ "4.3": { barRaised: { coding: [5] } } });
  const l4 = stub({ "4.3": { barRaised: { coding: [4] } } });
  const state = (changelog, score) => resolvePillarState({ pillar: "coding", score, stamp: "4.2", changelog });

  // CANARY: L5's band is 5.0-6.0. `ceil(4.5) === 5` would wrongly flag this.
  check(g, "4.5 does NOT flag under a hardened L5", state(l5, 4.5), PILLAR_STATE.clear);
  check(g, "5.0 flags under a hardened L5", state(l5, 5.0), PILLAR_STATE.raised);
  check(g, "4.0 does not flag under a hardened L5", state(l5, 4.0), PILLAR_STATE.clear);
  // The same score under [4] vs [5] is what proves the band is anchored to the level, not the score.
  check(g, "4.5 DOES flag under a hardened L4", state(l4, 4.5), PILLAR_STATE.raised);
}

// ── Multi-version jump: the union, not newest-wins ─────────────────────────────────────────────────
// The two releases must harden DIFFERENT levels, or the case passes trivially under newest-wins.
{
  const g = "union";
  const jump = stub({ "4.3": { barRaised: { coding: [1] } }, "4.2": { barRaised: { coding: [4] } } });
  const state = (score, stamp) => resolvePillarState({ pillar: "coding", score, stamp, changelog: jump });

  // CANARY: newest-wins yields {4.3, [1]} and misses 4.2's L4 entirely.
  check(g, "4.1 stamp, 4.5 score flags (4.2 hardened L4)", state(4.5, "4.1"), PILLAR_STATE.raised);
  check(g, "4.1 stamp, 1.5 score flags (4.3 hardened L1)", state(1.5, "4.1"), PILLAR_STATE.raised);
  check(g, "4.1 stamp, 3.0 score does not flag", state(3.0, "4.1"), PILLAR_STATE.clear);
  check(g, "4.2 stamp, 4.5 score does not flag (4.2 is not newer)", state(4.5, "4.2"), PILLAR_STATE.clear);
  check(g, "4.2 stamp, 1.5 score flags (only 4.3 counts)", state(1.5, "4.2"), PILLAR_STATE.raised);

  const union = movedLevelsSince("coding", "4.1", jump);
  check(g, "union collects both releases", [...union.raised].sort(), [1, 4]);
  check(g, "union from 4.2 collects only the newer", [...movedLevelsSince("coding", "4.2", jump).raised], [1]);
}

// ── Eased: the mirror band, not a copy ─────────────────────────────────────────────────────────────
{
  const g = "eased";
  const easedL4 = stub({ "4.3": { barEased: { coding: [4] } } });
  const state = (changelog, score) => resolvePillarState({ pillar: "coding", score, stamp: "4.2", changelog });

  check(g, "3.0 may qualify", state(easedL4, 3.0), PILLAR_STATE.eased);
  check(g, "3.5 may qualify", state(easedL4, 3.5), PILLAR_STATE.eased);
  check(g, "4.0 may qualify", state(easedL4, 4.0), PILLAR_STATE.eased);
  // CANARY: the same [4] set flags a 4.5 under barRaised but must not under barEased.
  check(g, "4.5 does NOT flag (above the eased level)", state(easedL4, 4.5), PILLAR_STATE.clear);
  check(g, "2.5 does not flag", state(easedL4, 2.5), PILLAR_STATE.clear);
}

// ── Bottom of scale: asymmetry and the zero guard ──────────────────────────────────────────────────
{
  const g = "zero";
  const raisedL1 = stub({ "4.3": { barRaised: { coding: [1] } } });
  const easedL1 = stub({ "4.3": { barEased: { coding: [1] } } });
  const state = (changelog, score) => resolvePillarState({ pillar: "coding", score, stamp: "4.2", changelog });

  check(g, "0.0 raised: no flag", state(raisedL1, 0), PILLAR_STATE.clear);
  // The zero guard, not the band: [0,1] covers a 0, but a 0 means "I don't do this at all".
  check(g, "0.0 eased: no flag (zero guard)", state(easedL1, 0), PILLAR_STATE.clear);
  // CANARY: the two bands run in opposite directions. Both fail if mayQualify mirrors mayBeHigh.
  check(g, "0.5 raised: no flag (below [1,2])", state(raisedL1, 0.5), PILLAR_STATE.clear);
  check(g, "0.5 eased: flags (inside [0,1])", state(easedL1, 0.5), PILLAR_STATE.eased);
  check(g, "1.0 raised: flags", state(raisedL1, 1.0), PILLAR_STATE.raised);
  check(g, "1.0 eased: flags", state(easedL1, 1.0), PILLAR_STATE.eased);
  check(g, "2.0 raised: flags", state(raisedL1, 2.0), PILLAR_STATE.raised);
  check(g, "2.0 eased: no flag", state(easedL1, 2.0), PILLAR_STATE.clear);
  check(g, "2.5 raised: no flag", state(raisedL1, 2.5), PILLAR_STATE.clear);
  check(g, "2.5 eased: no flag", state(easedL1, 2.5), PILLAR_STATE.clear);
}

// ── Mixed: a squeeze, not two competing flags ──────────────────────────────────────────────────────
{
  const g = "mixed";
  const squeeze = stub({ "4.3": { barRaised: { coding: [2] }, barEased: { coding: [4] } } });
  check(
    g,
    "3.0 with L2 raised and L4 eased is mixed",
    resolvePillarState({ pillar: "coding", score: 3.0, stamp: "4.2", changelog: squeeze }),
    PILLAR_STATE.mixed,
  );
  // An eased-only pillar remains distinct for its positive tooltip, but is still flagged.
  check(
    g,
    "eased-only remains distinct at pillar level",
    resolvePillarState({ pillar: "coding", score: 4.0, stamp: "4.2", changelog: stub({ "4.3": { barEased: { coding: [4] } } }) }),
    PILLAR_STATE.eased,
  );
}

// ── Roll-up: preserve the aggregate changed direction ─────────────────────────────────────────────
{
  const g = "rollup";
  const changelog = stub({ "4.3": { barRaised: { architecture: [1] }, barEased: { coding: [4] } } });
  const roll = (pillarLevels, stamp = "4.2") => resolveProfileState({ pillarLevels, stamp, changelog });

  check(g, "all clear", roll({ architecture: 4.0, coding: 1.0 }), PILLAR_STATE.clear);
  check(g, "some raised, none eased", roll({ architecture: 1.0, coding: 1.0 }), PILLAR_STATE.raised);
  // STUB-ONLY BY NECESSITY, and the reason this group cannot be replaced by a fixture profile: as of v4.3
  // every eased level sits inside a raised band of the same pillar (domainLogic L2 under L1/L5, uiUx L2 under
  // L1/L3-L5), so no real score reaches eased-only. A later release that eases a pillar it does not also
  // harden will light this path up in the app for the first time — it is tested here so that day is boring.
  check(g, "some eased, none raised", roll({ architecture: 4.0, coding: 3.5 }), PILLAR_STATE.eased);
  // The profile-level mixed case: two DIFFERENT pillars moving oppositely preserves both directions.
  check(g, "raised + eased across pillars is mixed", roll({ architecture: 1.0, coding: 3.5 }), PILLAR_STATE.mixed);
  // A per-pillar mixed also rolls up as mixed.
  check(
    g,
    "per-pillar mixed rolls up as mixed",
    resolveProfileState({
      pillarLevels: { coding: 3.0 },
      stamp: "4.2",
      changelog: stub({ "4.3": { barRaised: { coding: [2] }, barEased: { coding: [4] } } }),
    }),
    PILLAR_STATE.mixed,
  );
  check(g, "unknown stamp is unverified", roll({ architecture: 1.0 }, null), PILLAR_STATE.unverified);
  check(g, "current stamp is clear", roll({ architecture: 1.0 }, "4.3"), PILLAR_STATE.clear);
  check(g, "empty levels are clear", roll({}), PILLAR_STATE.clear);
}

// ── Flaggability: a version and a question mark cannot coexist ─────────────────────────────────────
// REGRESSION. Shipped once with derived routed to `unverified`, which rendered "? v4.2" on every legacy
// row: a chip displaying a version while claiming not to know one, and no profile ever flagged. The stamp
// and state resolvers were each correct in isolation, so only their COMPOSITION catches it.
{
  const g = "flaggable";
  const changelog = stub({ "4.3": { barRaised: { architecture: [1] } } });
  const chip = (profile) => {
    const stamp = resolveProfileStamp({ profile });
    const state = isFlaggable(stamp)
      ? resolveProfileState({ pillarLevels: profile.pillarLevels, stamp: stamp.version, changelog })
      : PILLAR_STATE.unverified;
    return { version: stamp.version, state };
  };
  const AT_42 = Date.parse("2026-08-10T00:00+08:00");
  const ANCIENT = Date.parse("2026-01-01T00:00+08:00");
  const stale = { id: "p", pillarLevels: { architecture: 1.5 }, savedAt: AT_42 };
  const fresh = { id: "p", pillarLevels: { architecture: 4.0 }, savedAt: AT_42 };

  check(g, "date-inferred version is flagged, not unverified", chip(stale), { version: "4.2", state: PILLAR_STATE.raised });
  check(g, "date-inferred version can also come back clear", chip(fresh), { version: "4.2", state: PILLAR_STATE.clear });
  check(g, "recorded version is flagged", chip({ ...stale, frameworkVersion: "4.2" }), { version: "4.2", state: PILLAR_STATE.raised });
  check(g, "no version at all is unverified", chip({ ...stale, savedAt: ANCIENT }), { version: null, state: PILLAR_STATE.unverified });

  // The invariant itself, stated once: unverified iff there is no version to show.
  for (const [name, profile] of [
    ["date-inferred", stale],
    ["recorded", { ...stale, frameworkVersion: "4.2" }],
    ["current", { ...stale, frameworkVersion: "4.3" }],
    ["ancient date", { ...stale, savedAt: ANCIENT }],
    // Below the changelog floor is a VERSION, so it is flagged like any other — not unverified.
    ["below floor", { ...stale, frameworkVersion: "2.9" }],
    ["junk stamp, ancient date", { ...stale, frameworkVersion: 42, savedAt: ANCIENT }],
  ]) {
    const { version, state } = chip(profile);
    check(g, `${name}: unverified iff no version`, state === PILLAR_STATE.unverified, version === null);
  }
}

// ── Round-trip and undo: the stamp must survive both ───────────────────────────────────────────────
// Neither of these goes through the resolver, so both are modelled here rather than imported: the point is
// that the stamp is CARRIED, and the failure mode is a field silently dropped by an allow-list rebuild.
{
  const g = "carry";
  // Export passes stored rows through unchanged (`{...p}`) — it deliberately keeps no field list, because
  // its input already came from normalizeStoredProfile. Import is the single allow-list, and the only place
  // a new profile field has to be declared.
  const exported = (p) => ({ ...p });
  const imported = (p) => ({
    id: p.id,
    title: p.title,
    pillarLevels: p.pillarLevels,
    attachedBadge: p.attachedBadge,
    savedAt: Number.isFinite(p.savedAt) ? p.savedAt : 0,
    frameworkVersion: typeof p.frameworkVersion === "string" && p.frameworkVersion ? p.frameworkVersion : null,
  });

  const row = { id: "a", title: "T", pillarLevels: { architecture: 1.5 }, attachedBadge: "none", savedAt: 1000, frameworkVersion: "4.2" };
  const back = imported(exported(row));
  // Export/import must NOT bump: importProfiles calls normalizeStoredProfile directly, never writeProfile.
  check(g, "export→import keeps the stamp", back.frameworkVersion, "4.2");
  check(g, "export→import keeps savedAt", back.savedAt, 1000);
  check(g, "an unstamped row stays unstamped", imported(exported({ ...row, frameworkVersion: undefined })).frameworkVersion, null);

  // An accidental Update stamps the current version and clears the flags; Undo restores the PRIOR LIST,
  // so the old stamp comes back with the old levels and every hint resurfaces. Guards the snapshot being
  // taken before the write rather than after.
  const changelog = stub({ "4.3": { barRaised: { architecture: [1] } } });
  const flagged = (p) =>
    resolveProfileState({ pillarLevels: p.pillarLevels, stamp: resolveProfileStamp({ profile: p, changelog }).version, changelog });
  const snapshot = [row];
  const saved = { ...row, pillarLevels: { architecture: 2.5 }, savedAt: 2000, frameworkVersion: "4.3" };
  check(g, "flagged before the save", flagged(row), PILLAR_STATE.raised);
  check(g, "cleared by the save", flagged(saved), PILLAR_STATE.clear);
  check(g, "undo restores the stamp and the flag", flagged(snapshot[0]), PILLAR_STATE.raised);
  check(g, "undo restores savedAt", snapshot[0].savedAt, 1000);
}

// ── Stamp-on-save: only a levels change heals ──────────────────────────────────────────────────────
// Mirrors writeProfile's stamp decision (useAppStore.js), modelled rather than imported for the carry group's
// reason: the store needs an alias + import.meta.env. Keep the two in step.
{
  const g = "onsave";
  const LIVE = "4.3";
  const levelsMatch = (a, b) => {
    const keys = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);
    for (const k of keys) {
      if ((a ?? {})[k] !== (b ?? {})[k]) {
        return false;
      }
    }
    return true;
  };
  // The WHOLE written row, not just its stamp: an unstamped row is dated from `savedAt`, so a null stamp
  // carried forward past a bumped date re-dates the row to the current version — the same laundering by
  // another channel. Modelling only the stamp is what let that ship. So a stamp-preserving save RECORDS the
  // version the row currently resolves to, pinning the verdict and freeing `savedAt` to be last-modified.
  // `target` null → a brand-new row, which always stamps. NOW is any time after the 4.2 boundary.
  const NOW = Date.parse("2026-08-20T00:00+08:00");
  // `source` is the profile the draft was LOADED FROM — null for an unlinked draft. The stamp describes a
  // rating, so it follows the source wherever the write lands, never the row being overwritten.
  const writeRow = (draft, source) => {
    const unchanged = source != null && levelsMatch(draft.pillarLevels, source.pillarLevels);
    const carried = unchanged ? (resolveProfileStamp({ profile: source }).version ?? null) : null;
    return { ...draft, savedAt: NOW, frameworkVersion: unchanged ? carried : LIVE };
  };
  const stampFor = (draft, target) => writeRow(draft, target).frameworkVersion;

  const stored = { id: "a", title: "T", pillarLevels: { architecture: 1.5 }, attachedBadge: "none", savedAt: 1000, frameworkVersion: "4.1" };

  // The laundering bug: neither of these touched a score, so neither may clear a flag.
  check(g, "rename carries the old stamp", stampFor({ ...stored, title: "T2" }, stored), "4.1");
  check(g, "badge switch carries the old stamp", stampFor({ ...stored, attachedBadge: "be" }, stored), "4.1");
  // savedAt is last-modified, so it moves on every write — a rename and a badge switch DO modify the row.
  check(g, "rename moves savedAt", writeRow({ ...stored, title: "T2" }, stored).savedAt, NOW);
  check(g, "badge switch moves savedAt", writeRow({ ...stored, attachedBadge: "be" }, stored).savedAt, NOW);

  // A real re-rate stamps, in either direction, and moves the date.
  check(g, "a raised level stamps", stampFor({ ...stored, pillarLevels: { architecture: 2.5 } }, stored), LIVE);
  check(g, "a lowered level stamps", stampFor({ ...stored, pillarLevels: { architecture: 0.5 } }, stored), LIVE);
  check(g, "a re-rate moves savedAt", writeRow({ ...stored, pillarLevels: { architecture: 2.5 } }, stored).savedAt, NOW);
  // A pillar added/removed from the map is a levels change too — fillPillarLevels defaults it in the store,
  // so this guards the key-union rather than a real user action.
  check(g, "a differing pillar set stamps", stampFor({ ...stored, pillarLevels: { architecture: 1.5, testing: 3 } }, stored), LIVE);

  check(g, "a new row stamps", stampFor(stored, null), LIVE);

  // A COLLISION IS JUDGED BY ITS SOURCE, not the row it lands on. Renaming A onto B changed no score, so the
  // survivor keeps A's stamp — B's stamp is irrelevant, its data is being replaced.
  check(g, "rename into a collision carries the source stamp", writeRow({ ...stored, title: "B" }, stored).frameworkVersion, "4.1");
  // An UNLINKED draft overwriting a row has no source: a new assessment, so it stamps and inherits nothing.
  check(g, "unlinked draft overwriting a row stamps", writeRow({ ...stored, title: "B" }, null).frameworkVersion, LIVE);
  // Even when the draft's numbers happen to equal the row it replaces — coincidence is not provenance.
  check(g, "unlinked draft stamps even with matching levels", writeRow({ ...stored }, null).frameworkVersion, LIVE);

  // CLONES CARRY THE SOURCE'S RATING. "Save new" keeps the link, so the source basis covers it. "Save as
  // copy" detaches first and instead inherits the stamp on the draft (`draftFrameworkVersion`), which the
  // write falls back to — a clone gets a fresh savedAt, so a null stamp would re-derive from the wrong date.
  const cloneRow = (draft, source, inherited) => {
    const unchanged = source != null && levelsMatch(draft.pillarLevels, source.pillarLevels);
    const carried = unchanged ? (resolveProfileStamp({ profile: source }).version ?? null) : (source == null ? inherited : null);
    return { ...draft, savedAt: NOW, frameworkVersion: carried ?? LIVE };
  };
  check(g, "Save new carries the source stamp", cloneRow({ ...stored, title: "Copy" }, stored, null).frameworkVersion, "4.1");
  check(g, "Save as copy carries the inherited stamp", cloneRow({ ...stored, title: "Copy" }, null, "4.1").frameworkVersion, "4.1");
  // A clone of an undatable profile inherits nothing, so it is a fresh rating.
  check(g, "a clone with nothing to inherit stamps", cloneRow({ ...stored, title: "Copy" }, null, null).frameworkVersion, LIVE);
  // An unstamped row RECORDS the version its own date resolved to — not the current one, and not null (which
  // would re-date it once savedAt moves). savedAt 1000 predates every release, so there is nothing to record.
  const unstamped = { ...stored, frameworkVersion: null };
  check(g, "an undatable unstamped row stays unstamped", stampFor({ ...stored, title: "T2" }, unstamped), null);

  // The behaviour that matters: the flag survives a rename and falls to a re-rate.
  const changelog = stub({ "4.2": { barRaised: { architecture: [1] } } });
  const flagged = (p) =>
    resolveProfileState({ pillarLevels: p.pillarLevels, stamp: resolveProfileStamp({ profile: p, changelog }).version, changelog });
  check(g, "flag survives a rename", flagged(writeRow({ ...stored, title: "T2" }, stored)), PILLAR_STATE.raised);
  check(g, "flag survives a badge switch", flagged(writeRow({ ...stored, attachedBadge: "be" }, stored)), PILLAR_STATE.raised);
  check(g, "flag clears on a re-rate", flagged(writeRow({ ...stored, pillarLevels: { architecture: 2.5 } }, stored)), PILLAR_STATE.clear);

  // THE SHIPPED BUG, end to end: a pre-4.3 row carries no stamp, so it is dated from savedAt. Renaming it
  // must not re-date it into the clear. Dated to the 4.1 era, where a 4.2 hardening still flags.
  const legacy = { ...unstamped, savedAt: Date.parse("2026-07-28T00:00+08:00") };
  // Its inferred 4.1 is RECORDED on the write, which is what survives the date moving to NOW.
  check(g, "renaming a legacy row records its inferred version", stampFor({ ...legacy, title: "T2" }, legacy), "4.1");
  check(g, "an unstamped legacy row is flagged", flagged(legacy), PILLAR_STATE.raised);
  check(g, "renaming an unstamped legacy row keeps the flag", flagged(writeRow({ ...legacy, title: "T2" }, legacy)), PILLAR_STATE.raised);
  check(g, "switching its badge keeps the flag", flagged(writeRow({ ...legacy, attachedBadge: "be" }, legacy)), PILLAR_STATE.raised);
}

// ── Restamp ("Mark as rated using v…"): the explicit heal for an unchanged rating ─────────────────
// The escape hatch from the onsave rule: re-reading the moved levels and keeping your scores changes nothing,
// so no save can heal it. Mirrors restampProfile (useAppStore.js).
{
  const g = "restamp";
  const LIVE = "4.3";
  const changelog = stub({ "4.3": { barRaised: { architecture: [1] } } });
  const flagged = (p) =>
    resolveProfileState({ pillarLevels: p.pillarLevels, stamp: resolveProfileStamp({ profile: p, changelog }).version, changelog });
  // Levels AND savedAt untouched, stamp advanced — the whole point. savedAt stays put because it means
  // "when the ratings last changed", and a restamp changes none.
  const restamp = (p) => ({ ...p, frameworkVersion: LIVE });

  const stale = { id: "a", title: "T", pillarLevels: { architecture: 1.5 }, attachedBadge: "none", savedAt: 1000, frameworkVersion: "4.2" };
  check(g, "flagged before restamp", flagged(stale), PILLAR_STATE.raised);
  const restamped = restamp(stale);
  check(g, "restamp clears the flag", flagged(restamped), PILLAR_STATE.clear);
  check(g, "restamp leaves the levels alone", restamped.pillarLevels.architecture, 1.5);
  check(g, "restamp leaves savedAt alone", restamped.savedAt, 1000);
  // Undo restores the PRIOR LIST, so the old stamp and the flag both come back.
  check(g, "undo restores the flag", flagged(stale), PILLAR_STATE.raised);

  // An unstamped profile is flaggable too (dated from savedAt), so restamp must reach it — otherwise the one
  // cohort most likely to be stale has no way out.
  const undated = { ...stale, frameworkVersion: null, savedAt: Date.parse("2026-07-27T16:04:18+08:00") };
  check(g, "an unstamped stale profile is flagged", flagged(undated), PILLAR_STATE.raised);
  // The recorded stamp must WIN over the older savedAt the row is still carrying — that ordering is what
  // makes preserving savedAt safe here.
  check(g, "restamp clears it too", flagged(restamp(undated)), PILLAR_STATE.clear);
  check(g, "the recorded stamp beats the retained date", resolveProfileStamp({ profile: restamp(undated), changelog }), {
    version: LIVE,
    source: STAMP_SOURCE.recorded,
  });
}

// ── Untouched flags: what a whole-profile stamp silences ──────────────────────────────────────────
// The stamp is one field on the profile, so a save that edits ONE pillar clears every pillar's warning.
// Mirrors untouchedFlaggedPillars (profile-stamp-state.js), which feeds the count the save toast owns up to.
{
  const g = "untouched";
  const changelog = stub({ "4.3": { barRaised: { architecture: [1], coding: [1], testing: [1] } } });
  const target = { frameworkVersion: "4.2", savedAt: 1000, pillarLevels: { architecture: 1.5, coding: 1.5, testing: 1.5, design: 4.0 } };
  const count = (draftLevels, requireLevelChange = false) => {
    const stamp = resolveProfileStamp({ profile: target });
    if (!isFlaggable(stamp)) {
      return 0;
    }
    let changedAny = false;
    let c = 0;
    for (const [pillar, score] of Object.entries(target.pillarLevels)) {
      if (draftLevels[pillar] !== score) {
        changedAny = true;
        continue;
      }
      const state = resolvePillarState({ pillar, score, stamp: stamp.version, changelog });
      if (state === PILLAR_STATE.raised || state === PILLAR_STATE.eased || state === PILLAR_STATE.mixed) {
        c += 1;
      }
    }
    return requireLevelChange && !changedAny ? 0 : c;
  };
  const L = target.pillarLevels;

  check(g, "editing one of three leaves two unreviewed", count({ ...L, architecture: 2.5 }), 2);
  check(g, "editing two leaves one", count({ ...L, architecture: 2.5, coding: 2.5 }), 1);
  // The message must NOT appear when every flag was addressed — that is the case the count exists to exclude.
  check(g, "editing all three leaves none", count({ ...L, architecture: 2.5, coding: 2.5, testing: 2.5 }), 0);
  // An unflagged pillar's edit addresses nothing, so all three still go unreviewed.
  check(g, "editing an unflagged pillar leaves all three", count({ ...L, design: 5.0 }), 3);
  // `requireLevelChange` is the save path: a rename or badge switch moves no level, carries the old stamp,
  // and so clears nothing — the dialog must not appear. The restamp button passes false and still counts 3.
  check(g, "no level moved, save path -> nothing to confirm", count({ ...L }, true), 0);
  check(g, "no level moved, restamp path -> still 3", count({ ...L }, false), 3);

  // Nothing to silence when the profile has no version to compare against.
  const undatable = { ...target, frameworkVersion: null, savedAt: 0 };
  check(g, "an unverified profile silences nothing", isFlaggable(resolveProfileStamp({ profile: undatable })), false);
}

// ── Report ─────────────────────────────────────────────────────────────────────────────────────────
const failed = results.filter((r) => !r.pass);
for (const r of failed) {
  console.error(`FAIL  [${r.group}] ${r.name}\n        expected ${JSON.stringify(r.expected)}\n        actual   ${JSON.stringify(r.actual)}`);
}
const byGroup = new Map();
for (const r of results) {
  const g = byGroup.get(r.group) ?? { pass: 0, total: 0 };
  g.total += 1;
  if (r.pass) {
    g.pass += 1;
  }
  byGroup.set(r.group, g);
}
for (const [group, { pass, total }] of byGroup) {
  console.log(`${pass === total ? "ok  " : "FAIL"}  ${group.padEnd(10)} ${pass}/${total}`);
}
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length > 0 ? 1 : 0);
