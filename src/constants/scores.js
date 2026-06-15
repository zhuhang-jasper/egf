import {
  BREADTH_TOP_RATIO,
  CAREER_BREADTH_WEIGHT,
  CAREER_LEVEL_BY_AVG_BAND,
  CAREER_LEVEL_REQUIREMENTS,
  CAREER_PEAK_WEIGHT,
  getPillarGroupOrder,
  getPillarOrder,
  HUMAN_STRENGTH_TOP_K,
  normalizeTrackVariant,
  TECHNICAL_FLOOR_PILLARS,
} from "@/constants";

function computePillarSubsetAvg(levels, order, pillarIds) {
  let sum = 0;
  let count = 0;
  for (const pillarId of pillarIds) {
    const index = order.indexOf(pillarId);
    if (index >= 0 && levels[index] !== undefined) {
      sum += levels[index];
      count++;
    }
  }
  return count ? sum / count : NaN;
}

function resolveClusterRequirements(requirements, trackVariant) {
  const floors = { ...requirements.clusters };
  if (normalizeTrackVariant(trackVariant) === "fe" && requirements.feClusters) {
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

/** Mean pillar score per cluster on the active track (for display). */
export function computeClusterAvgs(levels, trackVariant = "fe") {
  const order = getPillarOrder(trackVariant);
  const avgs = {};

  for (const { id, pillars } of getPillarGroupOrder(trackVariant)) {
    avgs[id] = computePillarSubsetAvg(levels, order, pillars);
  }

  return avgs;
}

/** Cluster avgs used for career floors (technical excludes AI). */
export function computeCareerFloorClusterAvgs(levels, trackVariant = "fe") {
  const order = getPillarOrder(trackVariant);
  const avgs = computeClusterAvgs(levels, trackVariant);
  avgs.technical = computePillarSubsetAvg(levels, order, TECHNICAL_FLOOR_PILLARS);
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

function meetsCareerRequirements(peak, breadth, clusterAvgs, requirements, trackVariant) {
  return (
    peak >= requirements.peak &&
    breadth >= requirements.breadth &&
    meetsClusterFloors(clusterAvgs, resolveClusterRequirements(requirements, trackVariant))
  );
}

/** Highest level (L5→L2) where peak, breadth, and cluster floors pass; else L1. */
export function careerLevelFromScores(peak, breadth, clusterAvgs = {}, trackVariant = "fe") {
  if (!Number.isFinite(peak) || !Number.isFinite(breadth)) {
    return null;
  }

  for (let i = CAREER_LEVEL_BY_AVG_BAND.length - 1; i >= 1; i--) {
    const band = CAREER_LEVEL_BY_AVG_BAND[i];
    const requirements = CAREER_LEVEL_REQUIREMENTS[band.code];
    if (requirements && meetsCareerRequirements(peak, breadth, clusterAvgs, requirements, trackVariant)) {
      return band;
    }
  }

  return CAREER_LEVEL_BY_AVG_BAND[0];
}

/** @deprecated Use {@link careerLevelFromScores}. */
export const careerLevelFromAvg = (avg) => careerLevelFromScores(avg, avg);

/** @deprecated Use {@link careerLevelFromScores}. */
export const careerLevelFromStrengthIndex = careerLevelFromAvg;

export function computeAverages(levels, trackVariant = "fe") {
  const peak = computeHumanStrengthIndex(levels);
  const breadth = computeBreadthScore(levels);
  const effective = computeCareerScore(peak, breadth);
  const clusters = computeClusterAvgs(levels, trackVariant);
  const floorClusters = computeCareerFloorClusterAvgs(levels, trackVariant);

  return {
    overall: computeOverallPillarAvg(levels),
    human: peak,
    breadth,
    effective,
    clusters,
    career: careerLevelFromScores(peak, breadth, floorClusters, trackVariant),
  };
}
