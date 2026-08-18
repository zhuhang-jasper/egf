import {
  BREADTH_TOP_RATIO,
  CAREER_BREADTH_WEIGHT,
  CAREER_LEVEL_BY_AVG_BAND,
  CAREER_LEVEL_REQUIREMENTS,
  CAREER_PEAK_WEIGHT,
  getPillarGroupOrder,
  HUMAN_STRENGTH_TOP_K,
  PILLAR_ORDER,
  TECHNICAL_FLOOR_PILLARS,
} from "@/constants";

/**
 * Every score below reads a `{ pillarId: level }` map, not a positional array — pillar order is a
 * chart-axis concern and scores do not depend on it. `pillarValues` is the one place that flattens the
 * map, so the aggregate helpers stay plain number-list maths.
 */
function pillarValues(pillarLevels) {
  const values = [];
  for (const id of PILLAR_ORDER) {
    const level = pillarLevels?.[id];
    if (level !== undefined) {
      values.push(level);
    }
  }
  return values;
}

function computePillarSubsetAvg(pillarLevels, pillarIds) {
  let sum = 0;
  let count = 0;
  for (const pillarId of pillarIds) {
    const level = pillarLevels?.[pillarId];
    if (level !== undefined) {
      sum += level;
      count++;
    }
  }
  return count ? sum / count : NaN;
}

function resolveClusterRequirements(requirements) {
  const floors = { ...requirements.clusters };
  if (requirements.feClusters) {
    Object.assign(floors, requirements.feClusters);
  }
  return floors;
}

export function formatAvgScore(n) {
  if (!Number.isFinite(n)) {
    return "—";
  }
  return (Math.round(n * 100) / 100).toFixed(2);
}

export function computeOverallPillarAvg(levels) {
  if (!levels?.length) {
    return NaN;
  }
  let sum = 0;
  for (let i = 0; i < levels.length; i++) {
    sum += levels[i];
  }
  return sum / levels.length;
}

/** @deprecated Use {@link computeOverallPillarAvg}. */
export const computeOverallSevenPillarAvg = computeOverallPillarAvg;

function computeTopKAvg(levels, k) {
  if (!levels?.length) {
    return NaN;
  }
  const take = Math.min(k, levels.length);
  const sorted = [...levels].sort((a, b) => b - a);
  let sum = 0;
  for (let i = 0; i < take; i++) {
    sum += sorted[i];
  }
  return sum / take;
}

/** Mean of top-3 pillars — peak / specialization signal. */
export function computeHumanStrengthIndex(levels) {
  return computeTopKAvg(levels, HUMAN_STRENGTH_TOP_K);
}

/** Mean of top ceil(n × {@link BREADTH_TOP_RATIO}) pillars — rounded breadth signal. */
export function computeBreadthScore(levels) {
  if (!levels?.length) {
    return NaN;
  }
  const k = Math.ceil(levels.length * BREADTH_TOP_RATIO);
  return computeTopKAvg(levels, k);
}

/** Mean pillar score per cluster (for display). */
export function computeClusterAvgs(pillarLevels) {
  const avgs = {};

  for (const { id, pillars } of getPillarGroupOrder()) {
    avgs[id] = computePillarSubsetAvg(pillarLevels, pillars);
  }

  return avgs;
}

/** Cluster avgs used for career floors (technical excludes AI). */
export function computeCareerFloorClusterAvgs(pillarLevels) {
  const avgs = computeClusterAvgs(pillarLevels);
  avgs.technical = computePillarSubsetAvg(pillarLevels, TECHNICAL_FLOOR_PILLARS);
  return avgs;
}

export function computeCareerScore(peak, breadth) {
  if (!Number.isFinite(peak) || !Number.isFinite(breadth)) {
    return NaN;
  }
  return peak * CAREER_PEAK_WEIGHT + breadth * CAREER_BREADTH_WEIGHT;
}

function meetsClusterFloors(clusterAvgs, clusterRequirements) {
  if (!clusterRequirements) {
    return true;
  }

  for (const [clusterId, min] of Object.entries(clusterRequirements)) {
    const avg = clusterAvgs[clusterId];
    if (!Number.isFinite(avg) || avg < min) {
      return false;
    }
  }

  return true;
}

function meetsCareerRequirements(peak, breadth, clusterAvgs, requirements) {
  return peak >= requirements.peak && breadth >= requirements.breadth && meetsClusterFloors(clusterAvgs, resolveClusterRequirements(requirements));
}

/** Highest level (L5→L2) where peak, breadth, and cluster floors pass; else L1. */
export function careerLevelFromScores(peak, breadth, clusterAvgs = {}) {
  if (!Number.isFinite(peak) || !Number.isFinite(breadth)) {
    return null;
  }

  for (let i = CAREER_LEVEL_BY_AVG_BAND.length - 1; i >= 1; i--) {
    const band = CAREER_LEVEL_BY_AVG_BAND[i];
    const requirements = CAREER_LEVEL_REQUIREMENTS[band.code];
    if (requirements && meetsCareerRequirements(peak, breadth, clusterAvgs, requirements)) {
      return band;
    }
  }

  return CAREER_LEVEL_BY_AVG_BAND[0];
}

/** @deprecated Use {@link careerLevelFromScores}. */
export const careerLevelFromAvg = (avg) => careerLevelFromScores(avg, avg);

/** @deprecated Use {@link careerLevelFromScores}. */
export const careerLevelFromStrengthIndex = careerLevelFromAvg;

export function computeAverages(pillarLevels) {
  const values = pillarValues(pillarLevels);
  const peak = computeHumanStrengthIndex(values);
  const breadth = computeBreadthScore(values);
  const effective = computeCareerScore(peak, breadth);
  const clusters = computeClusterAvgs(pillarLevels);
  const floorClusters = computeCareerFloorClusterAvgs(pillarLevels);

  return {
    pillarCount: values.length,
    overall: computeOverallPillarAvg(values),
    human: peak,
    breadth,
    effective,
    clusters,
    career: careerLevelFromScores(peak, breadth, floorClusters),
  };
}
