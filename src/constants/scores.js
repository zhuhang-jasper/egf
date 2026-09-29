import {
  CAREER_BREADTH_WEIGHT,
  CAREER_PEAK_WEIGHT,
  CAREER_STAGE_BANDS,
  CAREER_STAGE_REQUIREMENTS,
  getPillarGroupOrder,
  MIN_PILLAR_EXCLUDED,
  PILLAR_ORDER,
  TRACKS,
} from "@/constants";

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

export function computeCareerScore(peak, breadth) {
  if (!Number.isFinite(peak) || !Number.isFinite(breadth)) {
    return NaN;
  }
  return peak * CAREER_PEAK_WEIGHT + breadth * CAREER_BREADTH_WEIGHT;
}

const STAGE_RANK = new Map(CAREER_STAGE_BANDS.map(({ code }, i) => [code, i]));

/** Highest stage (S5 → S2) whose three minimums all pass; else S1. Raw values, never rounded. */
function stageForTrack(requirements, keyMean, supportMean, minPillar) {
  for (let i = CAREER_STAGE_BANDS.length - 1; i >= 1; i--) {
    const { code } = CAREER_STAGE_BANDS[i];
    const req = requirements[code];
    if (keyMean >= req.keyMean && supportMean >= req.supportMean && (req.minPillar === null || minPillar >= req.minPillar)) {
      return code;
    }
  }
  return CAREER_STAGE_BANDS[0].code;
}

/**
 * Best stage across {@link TRACKS}; that track is the match. Ties go to the higher keyMean, then to
 * TRACKS order.
 */
export function careerStageFromScores(pillarLevels) {
  const minPillar = Math.min(
    ...pillarValues(
      pillarLevels,
      PILLAR_ORDER.filter((id) => !MIN_PILLAR_EXCLUDED.includes(id)),
    ),
  );

  let best = null;
  for (const [track, { keyPillars }] of Object.entries(TRACKS)) {
    const keyMean = mean(pillarValues(pillarLevels, keyPillars));
    const supportMean = mean(
      pillarValues(
        pillarLevels,
        PILLAR_ORDER.filter((id) => !keyPillars.includes(id)),
      ),
    );
    const stage = stageForTrack(CAREER_STAGE_REQUIREMENTS[track], keyMean, supportMean, minPillar);
    const rank = STAGE_RANK.get(stage);
    const bestRank = best ? STAGE_RANK.get(best.stage) : -1;
    if (rank > bestRank || (rank === bestRank && keyMean > best.keyMean)) {
      best = { stage, track, keyMean, supportMean, minPillar };
    }
  }
  return best;
}

export function computeAverages(pillarLevels) {
  const career = careerStageFromScores(pillarLevels);
  const peak = career.keyMean;
  const breadth = career.supportMean;

  return {
    overall: mean(pillarValues(pillarLevels)),
    peak,
    breadth,
    effective: computeCareerScore(peak, breadth),
    clusters: computeClusterAvgs(pillarLevels),
    career,
  };
}
