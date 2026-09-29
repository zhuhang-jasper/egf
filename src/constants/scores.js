import { CAREER_STAGE_BANDS, CAREER_STAGE_REQUIREMENTS, getPillarGroupOrder, MIN_PILLAR_EXCLUDED, PILLAR_ORDER, TRACKS } from "@/constants";

/**
 * Every score below reads a `{ pillarId: level }` map, not a positional array — pillar order is a
 * chart-axis concern and scores do not depend on it. `pillarValues` is the one place that flattens the
 * map, so the aggregate helpers stay plain number-list maths.
 */
function pillarValues(pillarLevels, pillarIds = PILLAR_ORDER) {
  const values = [];
  for (const id of pillarIds) {
    const level = pillarLevels?.[id];
    if (level !== undefined) {
      values.push(level);
    }
  }
  return values;
}

function mean(values) {
  if (!values.length) {
    return NaN;
  }
  let sum = 0;
  for (const v of values) {
    sum += v;
  }
  return sum / values.length;
}

export function formatAvgScore(n) {
  if (!Number.isFinite(n)) {
    return "n/a";
  }
  return (Math.round(n * 100) / 100).toFixed(2);
}

/** Mean pillar score per cluster (for display). */
export function computeClusterAvgs(pillarLevels) {
  const avgs = {};

  for (const { id, pillars } of getPillarGroupOrder()) {
    avgs[id] = mean(pillarValues(pillarLevels, pillars));
  }

  return avgs;
}

const STAGE_RANK = new Map(CAREER_STAGE_BANDS.map(({ code }, i) => [code, i]));

/** The first of a stage's minimums the scores miss, or null when all pass. Raw values, never rounded. */
function firstUnmet(req, scores) {
  for (const metric of ["keyMean", "supportMean", "minPillar"]) {
    if (req[metric] !== null && !(scores[metric] >= req[metric])) {
      return { metric, required: req[metric] };
    }
  }
  return null;
}

/** Highest stage (S5 → S2) whose minimums all pass, else S1; `next` is what blocks the stage above. */
function stageForTrack(requirements, scores) {
  for (let i = CAREER_STAGE_BANDS.length - 1; i >= 1; i--) {
    if (!firstUnmet(requirements[CAREER_STAGE_BANDS[i].code], scores)) {
      const above = CAREER_STAGE_BANDS[i + 1];
      return { stage: CAREER_STAGE_BANDS[i].code, next: above ? firstUnmet(requirements[above.code], scores) : null };
    }
  }
  return { stage: CAREER_STAGE_BANDS[0].code, next: firstUnmet(requirements[CAREER_STAGE_BANDS[1].code], scores) };
}

/**
 * Best stage across {@link TRACKS}; that track is the match. Ties go to the higher keyMean, then to
 * TRACKS order. `tracks` holds every track's own result, in TRACKS order.
 */
export function careerStageFromScores(pillarLevels) {
  const minPillar = Math.min(
    ...pillarValues(
      pillarLevels,
      PILLAR_ORDER.filter((id) => !MIN_PILLAR_EXCLUDED.includes(id)),
    ),
  );

  const tracks = Object.entries(TRACKS).map(([track, { keyPillars }]) => {
    const scores = {
      keyMean: mean(pillarValues(pillarLevels, keyPillars)),
      supportMean: mean(
        pillarValues(
          pillarLevels,
          PILLAR_ORDER.filter((id) => !keyPillars.includes(id)),
        ),
      ),
      minPillar,
    };
    return { track, ...stageForTrack(CAREER_STAGE_REQUIREMENTS[track], scores), ...scores };
  });

  let best = tracks[0];
  for (const t of tracks) {
    const rank = STAGE_RANK.get(t.stage);
    const bestRank = STAGE_RANK.get(best.stage);
    if (rank > bestRank || (rank === bestRank && t.keyMean > best.keyMean)) {
      best = t;
    }
  }
  const { stage, track, keyMean, supportMean } = best;
  return { stage, track, keyMean, supportMean, minPillar, tracks };
}

export function computeAverages(pillarLevels) {
  return {
    overall: mean(pillarValues(pillarLevels)),
    clusters: computeClusterAvgs(pillarLevels),
    career: careerStageFromScores(pillarLevels),
  };
}
