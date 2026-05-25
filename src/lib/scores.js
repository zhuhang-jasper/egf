import { CAREER_LEVEL_BY_AVG_BAND, HUMAN_STRENGTH_TOP_K } from "@/lib/constants";

export function formatAvgScore(n) {
  if (!Number.isFinite(n)) {return "—";}
  return (Math.round(n * 100) / 100).toFixed(2);
}

export function computeOverallSevenPillarAvg(levels) {
  if (!levels?.length) {return NaN;}
  let sum = 0;
  for (let i = 0; i < levels.length; i++) {sum += levels[i];}
  return sum / levels.length;
}

export function computeHumanStrengthIndex(levels) {
  if (!levels?.length) {return NaN;}
  const k = Math.min(HUMAN_STRENGTH_TOP_K, levels.length);
  const sorted = [...levels].sort((a, b) => b - a);
  let sum = 0;
  for (let i = 0; i < k; i++) {sum += sorted[i];}
  return sum / k;
}

export function computeAvgAiThree(aiLevels) {
  if (!aiLevels?.length) {return NaN;}
  return (aiLevels[0] + aiLevels[1] + aiLevels[2]) / 3;
}

export function careerLevelFromStrengthIndex(avg) {
  if (!Number.isFinite(avg)) {return null;}
  const c = Math.max(0, Math.min(5, avg));
  if (c < 1.5) {return CAREER_LEVEL_BY_AVG_BAND[0];}
  if (c < 2.5) {return CAREER_LEVEL_BY_AVG_BAND[1];}
  if (c < 3.5) {return CAREER_LEVEL_BY_AVG_BAND[2];}
  if (c < 4.0) {return CAREER_LEVEL_BY_AVG_BAND[3];}
  return CAREER_LEVEL_BY_AVG_BAND[4];
}

export function computeAverages(levels, aiLevels) {
  const humanIndex = computeHumanStrengthIndex(levels);
  return {
    overall: computeOverallSevenPillarAvg(levels),
    human: humanIndex,
    ai: computeAvgAiThree(aiLevels),
    career: careerLevelFromStrengthIndex(humanIndex),
  };
}
