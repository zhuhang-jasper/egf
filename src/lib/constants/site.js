import { getPillarOrder } from "@/lib/constants/framework";
import { SENIORITY_LEVEL_COUNT } from "@/lib/constants/scoring";

export function getSiteCopy(trackVariant = "fe") {
  const pillarCount = getPillarOrder(trackVariant).length;
  const pointCount = pillarCount * SENIORITY_LEVEL_COUNT;
  const tagline = "A spider chart to measure software engineering mastery, identify core interests, and guide career paths.";
  const detail = `Supported by a ${pointCount}-point competency matrix across ${SENIORITY_LEVEL_COUNT} seniority levels.`;
  const byline = "— Jasper Loo Zhu Hang";
  return {
    title: `The ${pillarCount}-Pillar Engineer Growth Framework`,
    tagline,
    detail,
    byline,
    shortName: `${pillarCount}-Pillar Growth`,
    metaDescription: `${tagline} ${detail} Jasper Loo Zhu Hang.`,
  };
}
