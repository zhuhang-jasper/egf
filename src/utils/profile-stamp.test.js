import { describe, expect, it } from "vitest";

import {
  isFlaggable,
  movedLevelsSince,
  PILLAR_STATE,
  resolvePillarState,
  resolveProfileStamp,
  resolveProfileState,
  STAMP_SOURCE,
} from "@/utils/profile-stamp";

// Most cases stub their own tiny release history so a band rule is tested against known data rather than
// against whatever the live changelog happens to have authored. Only `version` and the two moved-level fields
// matter to the resolver.
const HISTORY = [{ version: "4.3" }, { version: "4.2" }, { version: "4.1" }, { version: "4.0" }, { version: "3.2" }, { version: "3.0" }];

/** HISTORY with moved levels grafted onto the named versions. */
function stub(moves) {
  return HISTORY.map((entry) => ({ ...entry, ...(moves[entry.version] ?? {}) }));
}

const flaggedWith = (changelog) => (p) =>
  resolveProfileState({ pillarLevels: p.pillarLevels, stamp: resolveProfileStamp({ profile: p, changelog }).version, changelog });

// A recorded stamp always wins, an unstamped profile is dated from its OWN savedAt, and a profile older than
// any shipped release is `unknown`, never the current version. Because stamping began in 4.3, an unstamped
// profile after the 4.2 boundary still resolves to 4.2.
describe("stamp resolution", () => {
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
  const derived = (version) => ({ version, source: STAMP_SOURCE.derived });
  const recorded = (version) => ({ version, source: STAMP_SOURCE.recorded });
  const unknown = { version: null, source: STAMP_SOURCE.unknown };

  it.each([
    ["saved after stamping began", AT.v43, derived("4.2")],
    ["saved during 4.2", AT.v42, derived("4.2")],
    ["saved during 4.1", AT.v41, derived("4.1")],
    ["saved during 3.2", AT.v32, derived("3.2")],
    ["saved during 3.1", AT.v31, derived("3.1")],
    // 2.9 and 2.8 predate the changelog (hardcoded on the Theory nav label); dates there must still name a version.
    ["saved before 3.1 dates to 2.9", T("2026-07-05T00:00+08:00"), derived("2.9")],
    ["saved in the 2.8 window", T("2026-06-18T00:00+08:00"), derived("2.8")],
    // 2.4-2.7 are dated from the source PDF's own revision timestamps, since the app showed no version yet.
    ["saved in the 2.7 window", T("2026-06-12T00:00+08:00"), derived("2.7")],
    ["saved in the 2.6 window", T("2026-06-10T12:30:00+08:00"), derived("2.6")],
    ["saved in the 2.4 window", T("2026-06-09T18:00:00+08:00"), derived("2.4")],
    ["saved before 2.4 existed", T("2026-06-08T00:00+08:00"), unknown],
    ["saved before the app existed", AT.ancient, unknown],
    ["no savedAt at all", 0, unknown],
    // 4.0 AND 3.0 NEVER SHIPPED: the live bump went 3.2 -> 4.1 in one commit, so a save in the window the
    // changelog labels "4.0" must infer 3.2, the version actually running.
    ["never-shipped 4.0 window infers 3.2", T("2026-07-25T00:00+08:00"), derived("3.2")],
  ])("unstamped: %s", (_name, savedAt, expected) => {
    expect(resolve(row(undefined, savedAt))).toEqual(expected);
  });

  // A RECORDED STAMP ALWAYS WINS, including one older than the date would suggest. Inverting it would re-date
  // a correctly-stamped profile from when it happened to be re-saved.
  it("recorded 4.2 beats a 4.3-era savedAt", () => {
    expect(resolve(row("4.2", AT.v43))).toEqual(recorded("4.2"));
  });
  it("recorded 3.1 beats a 4.3-era savedAt", () => {
    expect(resolve(row("3.1", AT.v43))).toEqual(recorded("3.1"));
  });
  // Below the changelog floor but still a version: kept, and ranks Infinity, i.e. "older than everything".
  it("recorded 2.9 is kept", () => {
    expect(resolve(row("2.9", AT.v43))).toEqual(recorded("2.9"));
  });

  // Junk stamps carry no version, so they fall through to the date like any unstamped row.
  it.each([42, null, "x", {}, ""])("junk stamp %j falls through to the date", (bad) => {
    expect(resolve({ id: "p1", frameworkVersion: bad, savedAt: AT.v42 })).toEqual(derived("4.2"));
  });
  it("junk stamp + ancient date is unknown", () => {
    expect(resolve({ id: "p1", frameworkVersion: 42, savedAt: AT.ancient })).toEqual(unknown);
  });
});

describe("bands: level scoping, the inclusive upper edge, and the gap", () => {
  const archL1 = stub({ "4.3": { barRaised: { architecture: [1] } } });
  const state = (changelog, pillar, score, stamp) => resolvePillarState({ pillar, score, stamp, changelog });

  it("arch 1.0 flags", () => {
    expect(state(archL1, "architecture", 1.0, "4.2")).toBe(PILLAR_STATE.raised);
  });
  it("arch 1.5 flags", () => {
    expect(state(archL1, "architecture", 1.5, "4.2")).toBe(PILLAR_STATE.raised);
  });
  // CANARY: the band's upper edge is inclusive. A 2.0 asserts L1, so a hardened L1 puts it in question.
  it("arch 2.0 flags (inclusive upper edge)", () => {
    expect(state(archL1, "architecture", 2.0, "4.2")).toBe(PILLAR_STATE.raised);
  });
  it("arch 2.5 does not flag (past the band)", () => {
    expect(state(archL1, "architecture", 2.5, "4.2")).toBe(PILLAR_STATE.clear);
  });
  // CANARY: level scoping. Someone at L4 plainly clears a slightly-harder L1.
  it("arch 4.0 does not flag (level scoping)", () => {
    expect(state(archL1, "architecture", 4.0, "4.2")).toBe(PILLAR_STATE.clear);
  });
  it("untouched pillar does not flag", () => {
    expect(state(archL1, "coding", 1.5, "4.2")).toBe(PILLAR_STATE.clear);
  });
  it("stamp equal to the raise does not flag", () => {
    expect(state(archL1, "architecture", 1.0, "4.3")).toBe(PILLAR_STATE.clear);
  });

  // CANARY: `levels` is a SET, not a ceiling and not a range. L1 and L4 hardened, L2-L3 untouched.
  const codingIslands = stub({ "4.3": { barRaised: { coding: [1, 4] } } });
  it("coding 3.0 does not flag (the L2-L3 gap)", () => {
    expect(state(codingIslands, "coding", 3.0, "4.2")).toBe(PILLAR_STATE.clear);
  });
  it("coding 1.5 flags (lower island)", () => {
    expect(state(codingIslands, "coding", 1.5, "4.2")).toBe(PILLAR_STATE.raised);
  });
  it("coding 4.5 flags (upper island)", () => {
    expect(state(codingIslands, "coding", 4.5, "4.2")).toBe(PILLAR_STATE.raised);
  });
  it("coding 5.0 flags (4 to 5 inclusive)", () => {
    expect(state(codingIslands, "coding", 5.0, "4.2")).toBe(PILLAR_STATE.raised);
  });

  // CANARY: direction. A release that only clarified must flag nobody.
  const clarifiedOnly = stub({ "4.3": {} });
  it.each([0, 1, 2.5, 4, 5])("clarify-only release does not flag at %s", (score) => {
    expect(state(clarifiedOnly, "architecture", score, "4.2")).toBe(PILLAR_STATE.clear);
  });

  // A raise from an INTERMEDIATE version still counts.
  it("raise at 4.2 flags a 4.1 stamp", () => {
    expect(state(stub({ "4.2": { barRaised: { uiUx: [5] } } }), "uiUx", 5.0, "4.1")).toBe(PILLAR_STATE.raised);
  });
  it("unknown stamp is unverified, not stale", () => {
    expect(state(archL1, "architecture", 1.0, null)).toBe(PILLAR_STATE.unverified);
  });
});

describe("half-step anchoring: the case a floor/ceil shortcut gets wrong", () => {
  const l5 = stub({ "4.3": { barRaised: { coding: [5] } } });
  const l4 = stub({ "4.3": { barRaised: { coding: [4] } } });
  const state = (changelog, score) => resolvePillarState({ pillar: "coding", score, stamp: "4.2", changelog });

  // CANARY: L5's band is 5.0-6.0. `ceil(4.5) === 5` would wrongly flag this.
  it("4.5 does NOT flag under a hardened L5", () => {
    expect(state(l5, 4.5)).toBe(PILLAR_STATE.clear);
  });
  it("5.0 flags under a hardened L5", () => {
    expect(state(l5, 5.0)).toBe(PILLAR_STATE.raised);
  });
  it("4.0 does not flag under a hardened L5", () => {
    expect(state(l5, 4.0)).toBe(PILLAR_STATE.clear);
  });
  // The same score under [4] vs [5] is what proves the band is anchored to the level, not the score.
  it("4.5 DOES flag under a hardened L4", () => {
    expect(state(l4, 4.5)).toBe(PILLAR_STATE.raised);
  });
});

// The two releases must harden DIFFERENT levels, or the case passes trivially under newest-wins.
describe("multi-version jump: the union, not newest-wins", () => {
  const jump = stub({ "4.3": { barRaised: { coding: [1] } }, "4.2": { barRaised: { coding: [4] } } });
  const state = (score, stamp) => resolvePillarState({ pillar: "coding", score, stamp, changelog: jump });

  // CANARY: newest-wins yields {4.3, [1]} and misses 4.2's L4 entirely.
  it("4.1 stamp, 4.5 score flags (4.2 hardened L4)", () => {
    expect(state(4.5, "4.1")).toBe(PILLAR_STATE.raised);
  });
  it("4.1 stamp, 1.5 score flags (4.3 hardened L1)", () => {
    expect(state(1.5, "4.1")).toBe(PILLAR_STATE.raised);
  });
  it("4.1 stamp, 3.0 score does not flag", () => {
    expect(state(3.0, "4.1")).toBe(PILLAR_STATE.clear);
  });
  it("4.2 stamp, 4.5 score does not flag (4.2 is not newer)", () => {
    expect(state(4.5, "4.2")).toBe(PILLAR_STATE.clear);
  });
  it("4.2 stamp, 1.5 score flags (only 4.3 counts)", () => {
    expect(state(1.5, "4.2")).toBe(PILLAR_STATE.raised);
  });
  it("union collects both releases", () => {
    expect([...movedLevelsSince("coding", "4.1", jump).raised].sort()).toEqual([1, 4]);
  });
  it("union from 4.2 collects only the newer", () => {
    expect([...movedLevelsSince("coding", "4.2", jump).raised]).toEqual([1]);
  });
});

describe("eased: the mirror band, not a copy", () => {
  const easedL4 = stub({ "4.3": { barEased: { coding: [4] } } });
  const state = (score) => resolvePillarState({ pillar: "coding", score, stamp: "4.2", changelog: easedL4 });

  it.each([3.0, 3.5, 4.0])("%s may qualify", (score) => {
    expect(state(score)).toBe(PILLAR_STATE.eased);
  });
  // CANARY: the same [4] set flags a 4.5 under barRaised but must not under barEased.
  it("4.5 does NOT flag (above the eased level)", () => {
    expect(state(4.5)).toBe(PILLAR_STATE.clear);
  });
  it("2.5 does not flag", () => {
    expect(state(2.5)).toBe(PILLAR_STATE.clear);
  });
});

describe("bottom of scale: asymmetry and the zero guard", () => {
  const raisedL1 = stub({ "4.3": { barRaised: { coding: [1] } } });
  const easedL1 = stub({ "4.3": { barEased: { coding: [1] } } });
  const state = (changelog, score) => resolvePillarState({ pillar: "coding", score, stamp: "4.2", changelog });

  it("0.0 raised: no flag", () => {
    expect(state(raisedL1, 0)).toBe(PILLAR_STATE.clear);
  });
  // The zero guard, not the band: [0,1] covers a 0, but a 0 means "I don't do this at all".
  it("0.0 eased: no flag (zero guard)", () => {
    expect(state(easedL1, 0)).toBe(PILLAR_STATE.clear);
  });
  // CANARY: the two bands run in opposite directions. Both fail if mayQualify mirrors mayBeHigh.
  it.each([
    [0.5, PILLAR_STATE.clear, PILLAR_STATE.eased],
    [1.0, PILLAR_STATE.raised, PILLAR_STATE.eased],
    [2.0, PILLAR_STATE.raised, PILLAR_STATE.clear],
    [2.5, PILLAR_STATE.clear, PILLAR_STATE.clear],
  ])("%s: raised → %s, eased → %s", (score, raised, eased) => {
    expect(state(raisedL1, score)).toBe(raised);
    expect(state(easedL1, score)).toBe(eased);
  });
});

describe("mixed: a squeeze, not two competing flags", () => {
  it("3.0 with L2 raised and L4 eased is mixed", () => {
    const squeeze = stub({ "4.3": { barRaised: { coding: [2] }, barEased: { coding: [4] } } });
    expect(resolvePillarState({ pillar: "coding", score: 3.0, stamp: "4.2", changelog: squeeze })).toBe(PILLAR_STATE.mixed);
  });
  // An eased-only pillar remains distinct for its positive tooltip, but is still flagged.
  it("eased-only remains distinct at pillar level", () => {
    const changelog = stub({ "4.3": { barEased: { coding: [4] } } });
    expect(resolvePillarState({ pillar: "coding", score: 4.0, stamp: "4.2", changelog })).toBe(PILLAR_STATE.eased);
  });
});

describe("roll-up: preserve the aggregate changed direction", () => {
  const changelog = stub({ "4.3": { barRaised: { architecture: [1] }, barEased: { coding: [4] } } });
  const roll = (pillarLevels, stamp = "4.2") => resolveProfileState({ pillarLevels, stamp, changelog });

  it("all clear", () => {
    expect(roll({ architecture: 4.0, coding: 1.0 })).toBe(PILLAR_STATE.clear);
  });
  it("some raised, none eased", () => {
    expect(roll({ architecture: 1.0, coding: 1.0 })).toBe(PILLAR_STATE.raised);
  });
  // STUB-ONLY BY NECESSITY: as of v4.3 every eased level sits inside a raised band of the same pillar, so no
  // real score reaches eased-only. A later release that eases a pillar it does not also harden lights this up.
  it("some eased, none raised", () => {
    expect(roll({ architecture: 4.0, coding: 3.5 })).toBe(PILLAR_STATE.eased);
  });
  it("raised + eased across pillars is mixed", () => {
    expect(roll({ architecture: 1.0, coding: 3.5 })).toBe(PILLAR_STATE.mixed);
  });
  it("per-pillar mixed rolls up as mixed", () => {
    const squeeze = stub({ "4.3": { barRaised: { coding: [2] }, barEased: { coding: [4] } } });
    expect(resolveProfileState({ pillarLevels: { coding: 3.0 }, stamp: "4.2", changelog: squeeze })).toBe(PILLAR_STATE.mixed);
  });
  it("unknown stamp is unverified", () => {
    expect(roll({ architecture: 1.0 }, null)).toBe(PILLAR_STATE.unverified);
  });
  it("current stamp is clear", () => {
    expect(roll({ architecture: 1.0 }, "4.3")).toBe(PILLAR_STATE.clear);
  });
  it("empty levels are clear", () => {
    expect(roll({})).toBe(PILLAR_STATE.clear);
  });
});

// REGRESSION. Shipped once with derived routed to `unverified`, which rendered "? v4.2" on every legacy row.
// The stamp and state resolvers were each correct in isolation, so only their COMPOSITION catches it.
describe("flaggability: a version and a question mark cannot coexist", () => {
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

  it("date-inferred version is flagged, not unverified", () => {
    expect(chip(stale)).toEqual({ version: "4.2", state: PILLAR_STATE.raised });
  });
  it("date-inferred version can also come back clear", () => {
    expect(chip(fresh)).toEqual({ version: "4.2", state: PILLAR_STATE.clear });
  });
  it("recorded version is flagged", () => {
    expect(chip({ ...stale, frameworkVersion: "4.2" })).toEqual({ version: "4.2", state: PILLAR_STATE.raised });
  });
  it("no version at all is unverified", () => {
    expect(chip({ ...stale, savedAt: ANCIENT })).toEqual({ version: null, state: PILLAR_STATE.unverified });
  });

  it.each([
    ["date-inferred", stale],
    ["recorded", { ...stale, frameworkVersion: "4.2" }],
    ["current", { ...stale, frameworkVersion: "4.3" }],
    ["ancient date", { ...stale, savedAt: ANCIENT }],
    // Below the changelog floor is a VERSION, so it is flagged like any other, not unverified.
    ["below floor", { ...stale, frameworkVersion: "2.9" }],
    ["junk stamp, ancient date", { ...stale, frameworkVersion: 42, savedAt: ANCIENT }],
  ])("%s: unverified iff no version", (_name, profile) => {
    const { version, state } = chip(profile);
    expect(state === PILLAR_STATE.unverified).toBe(version === null);
  });
});

// Neither of these goes through the resolver, so both are modelled here rather than imported: the stamp is
// CARRIED, and the failure mode is a field silently dropped by an allow-list rebuild.
describe("round-trip and undo: the stamp must survive both", () => {
  // Export passes stored rows through unchanged; import is the single allow-list (normalizeStoredProfile).
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

  // Export/import must NOT bump: importProfiles calls normalizeStoredProfile directly, never writeProfile.
  it("export→import keeps the stamp", () => {
    expect(imported(exported(row)).frameworkVersion).toBe("4.2");
  });
  it("export→import keeps savedAt", () => {
    expect(imported(exported(row)).savedAt).toBe(1000);
  });
  it("an unstamped row stays unstamped", () => {
    expect(imported(exported({ ...row, frameworkVersion: undefined })).frameworkVersion).toBeNull();
  });

  // An accidental Update stamps the current version; Undo restores the PRIOR LIST, so the old stamp comes back
  // with the old levels. Guards the snapshot being taken before the write rather than after.
  const flagged = flaggedWith(stub({ "4.3": { barRaised: { architecture: [1] } } }));
  const snapshot = [row];
  const saved = { ...row, pillarLevels: { architecture: 2.5 }, savedAt: 2000, frameworkVersion: "4.3" };
  it("flagged before the save", () => {
    expect(flagged(row)).toBe(PILLAR_STATE.raised);
  });
  it("cleared by the save", () => {
    expect(flagged(saved)).toBe(PILLAR_STATE.clear);
  });
  it("undo restores the stamp and the flag", () => {
    expect(flagged(snapshot[0])).toBe(PILLAR_STATE.raised);
  });
  it("undo restores savedAt", () => {
    expect(snapshot[0].savedAt).toBe(1000);
  });
});

// Mirrors writeProfile's stamp decision (useAppStore.js), modelled rather than imported for the round-trip
// group's reason. Keep the two in step.
describe("stamp-on-save: only a levels change heals", () => {
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
  // carried past a bumped date re-dates it to the current version. A stamp-preserving save therefore RECORDS
  // the version the row currently resolves to. `source` is the profile the draft was LOADED FROM, null for an
  // unlinked draft; the stamp follows the source wherever the write lands. NOW is after the 4.2 boundary.
  const NOW = Date.parse("2026-08-20T00:00+08:00");
  const writeRow = (draft, source) => {
    const unchanged = source != null && levelsMatch(draft.pillarLevels, source.pillarLevels);
    const carried = unchanged ? (resolveProfileStamp({ profile: source }).version ?? null) : null;
    return { ...draft, savedAt: NOW, frameworkVersion: unchanged ? carried : LIVE };
  };
  const stampFor = (draft, target) => writeRow(draft, target).frameworkVersion;

  const stored = { id: "a", title: "T", pillarLevels: { architecture: 1.5 }, attachedBadge: "none", savedAt: 1000, frameworkVersion: "4.1" };

  // The laundering bug: neither of these touched a score, so neither may clear a flag.
  it("rename carries the old stamp", () => {
    expect(stampFor({ ...stored, title: "T2" }, stored)).toBe("4.1");
  });
  it("badge switch carries the old stamp", () => {
    expect(stampFor({ ...stored, attachedBadge: "be" }, stored)).toBe("4.1");
  });
  // savedAt is last-modified, so it moves on every write.
  it("rename moves savedAt", () => {
    expect(writeRow({ ...stored, title: "T2" }, stored).savedAt).toBe(NOW);
  });
  it("badge switch moves savedAt", () => {
    expect(writeRow({ ...stored, attachedBadge: "be" }, stored).savedAt).toBe(NOW);
  });

  it("a raised level stamps", () => {
    expect(stampFor({ ...stored, pillarLevels: { architecture: 2.5 } }, stored)).toBe(LIVE);
  });
  it("a lowered level stamps", () => {
    expect(stampFor({ ...stored, pillarLevels: { architecture: 0.5 } }, stored)).toBe(LIVE);
  });
  it("a re-rate moves savedAt", () => {
    expect(writeRow({ ...stored, pillarLevels: { architecture: 2.5 } }, stored).savedAt).toBe(NOW);
  });
  // fillPillarLevels defaults a missing pillar in the store, so this guards the key-union, not a user action.
  it("a differing pillar set stamps", () => {
    expect(stampFor({ ...stored, pillarLevels: { architecture: 1.5, testing: 3 } }, stored)).toBe(LIVE);
  });
  it("a new row stamps", () => {
    expect(stampFor(stored, null)).toBe(LIVE);
  });

  // A COLLISION IS JUDGED BY ITS SOURCE, not the row it lands on.
  it("rename into a collision carries the source stamp", () => {
    expect(writeRow({ ...stored, title: "B" }, stored).frameworkVersion).toBe("4.1");
  });
  it("unlinked draft overwriting a row stamps", () => {
    expect(writeRow({ ...stored, title: "B" }, null).frameworkVersion).toBe(LIVE);
  });
  // Even when the draft's numbers happen to equal the row it replaces: coincidence is not provenance.
  it("unlinked draft stamps even with matching levels", () => {
    expect(writeRow({ ...stored }, null).frameworkVersion).toBe(LIVE);
  });

  // CLONES CARRY THE SOURCE'S RATING. "Save new" keeps the link; "Save as copy" detaches and inherits the
  // stamp on the draft (`draftFrameworkVersion`), since a clone's fresh savedAt would re-derive wrongly.
  const cloneRow = (draft, source, inherited) => {
    let carried = null;
    if (source == null) {
      carried = inherited;
    } else if (levelsMatch(draft.pillarLevels, source.pillarLevels)) {
      carried = resolveProfileStamp({ profile: source }).version ?? null;
    }
    return { ...draft, savedAt: NOW, frameworkVersion: carried ?? LIVE };
  };
  it("Save new carries the source stamp", () => {
    expect(cloneRow({ ...stored, title: "Copy" }, stored, null).frameworkVersion).toBe("4.1");
  });
  it("Save as copy carries the inherited stamp", () => {
    expect(cloneRow({ ...stored, title: "Copy" }, null, "4.1").frameworkVersion).toBe("4.1");
  });
  it("a clone with nothing to inherit stamps", () => {
    expect(cloneRow({ ...stored, title: "Copy" }, null, null).frameworkVersion).toBe(LIVE);
  });
  // savedAt 1000 predates every release, so there is nothing to record.
  const unstamped = { ...stored, frameworkVersion: null };
  it("an undatable unstamped row stays unstamped", () => {
    expect(stampFor({ ...stored, title: "T2" }, unstamped)).toBeNull();
  });

  const flagged = flaggedWith(stub({ "4.2": { barRaised: { architecture: [1] } } }));
  it("flag survives a rename", () => {
    expect(flagged(writeRow({ ...stored, title: "T2" }, stored))).toBe(PILLAR_STATE.raised);
  });
  it("flag survives a badge switch", () => {
    expect(flagged(writeRow({ ...stored, attachedBadge: "be" }, stored))).toBe(PILLAR_STATE.raised);
  });
  it("flag clears on a re-rate", () => {
    expect(flagged(writeRow({ ...stored, pillarLevels: { architecture: 2.5 } }, stored))).toBe(PILLAR_STATE.clear);
  });

  // THE SHIPPED BUG, end to end: a pre-4.3 row is dated from savedAt, and renaming it must not re-date it into
  // the clear. Dated to the 4.1 era, where a 4.2 hardening still flags.
  const legacy = { ...unstamped, savedAt: Date.parse("2026-07-28T00:00+08:00") };
  it("renaming a legacy row records its inferred version", () => {
    expect(stampFor({ ...legacy, title: "T2" }, legacy)).toBe("4.1");
  });
  it("an unstamped legacy row is flagged", () => {
    expect(flagged(legacy)).toBe(PILLAR_STATE.raised);
  });
  it("renaming an unstamped legacy row keeps the flag", () => {
    expect(flagged(writeRow({ ...legacy, title: "T2" }, legacy))).toBe(PILLAR_STATE.raised);
  });
  it("switching its badge keeps the flag", () => {
    expect(flagged(writeRow({ ...legacy, attachedBadge: "be" }, legacy))).toBe(PILLAR_STATE.raised);
  });
});

// The escape hatch from the stamp-on-save rule: keeping your scores after re-reading changes nothing, so no
// save can heal it. Mirrors restampProfile (useAppStore.js).
describe("restamp: the explicit heal for an unchanged rating", () => {
  const LIVE = "4.3";
  const changelog = stub({ "4.3": { barRaised: { architecture: [1] } } });
  const flagged = flaggedWith(changelog);
  // savedAt stays put because it means "when the ratings last changed", and a restamp changes none.
  const restamp = (p) => ({ ...p, frameworkVersion: LIVE });

  const stale = { id: "a", title: "T", pillarLevels: { architecture: 1.5 }, attachedBadge: "none", savedAt: 1000, frameworkVersion: "4.2" };
  const restamped = restamp(stale);
  it("flagged before restamp", () => {
    expect(flagged(stale)).toBe(PILLAR_STATE.raised);
  });
  it("restamp clears the flag", () => {
    expect(flagged(restamped)).toBe(PILLAR_STATE.clear);
  });
  it("restamp leaves the levels alone", () => {
    expect(restamped.pillarLevels.architecture).toBe(1.5);
  });
  it("restamp leaves savedAt alone", () => {
    expect(restamped.savedAt).toBe(1000);
  });
  it("undo restores the flag", () => {
    expect(flagged(stale)).toBe(PILLAR_STATE.raised);
  });

  // An unstamped profile is flaggable too (dated from savedAt), so restamp must reach it.
  const undated = { ...stale, frameworkVersion: null, savedAt: Date.parse("2026-07-27T16:04:18+08:00") };
  it("an unstamped stale profile is flagged", () => {
    expect(flagged(undated)).toBe(PILLAR_STATE.raised);
  });
  it("restamp clears it too", () => {
    expect(flagged(restamp(undated))).toBe(PILLAR_STATE.clear);
  });
  // The recorded stamp must WIN over the older savedAt, which is what makes preserving savedAt safe.
  it("the recorded stamp beats the retained date", () => {
    expect(resolveProfileStamp({ profile: restamp(undated), changelog })).toEqual({ version: LIVE, source: STAMP_SOURCE.recorded });
  });
});

// The stamp is one field on the profile, so a save that edits ONE pillar clears every pillar's warning.
// Mirrors untouchedFlaggedPillars (profile-stamp-state.js), which feeds the count the save toast owns up to.
describe("untouched flags: what a whole-profile stamp silences", () => {
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

  it("editing one of three leaves two unreviewed", () => {
    expect(count({ ...L, architecture: 2.5 })).toBe(2);
  });
  it("editing two leaves one", () => {
    expect(count({ ...L, architecture: 2.5, coding: 2.5 })).toBe(1);
  });
  // The message must NOT appear when every flag was addressed.
  it("editing all three leaves none", () => {
    expect(count({ ...L, architecture: 2.5, coding: 2.5, testing: 2.5 })).toBe(0);
  });
  it("editing an unflagged pillar leaves all three", () => {
    expect(count({ ...L, design: 5.0 })).toBe(3);
  });
  // `requireLevelChange` is the save path: a rename or badge switch clears nothing, so the dialog must not
  // appear. The restamp button passes false and still counts 3.
  it("no level moved, save path -> nothing to confirm", () => {
    expect(count({ ...L }, true)).toBe(0);
  });
  it("no level moved, restamp path -> still 3", () => {
    expect(count({ ...L }, false)).toBe(3);
  });
  it("an unverified profile silences nothing", () => {
    expect(isFlaggable(resolveProfileStamp({ profile: { ...target, frameworkVersion: null, savedAt: 0 } }))).toBe(false);
  });
});
