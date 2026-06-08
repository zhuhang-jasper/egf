import { SENIORITY_LEVEL_COUNT } from "@/lib/constants/scoring";

const PILLAR_COUNT = 9;
const POINT_COUNT = PILLAR_COUNT * SENIORITY_LEVEL_COUNT;
const tagline = "A spider chart to measure software engineering mastery, identify core interests, and guide career paths.";
const detail = `Supported by a ${POINT_COUNT}-point competency matrix across ${SENIORITY_LEVEL_COUNT} seniority levels.`;

export const SITE_COPY = {
  title: `The ${PILLAR_COUNT}-Pillar Engineer Growth Framework`,
  tagline,
  detail,
  byline: "— Jasper Loo Zhu Hang",
  shortName: `${PILLAR_COUNT}-Pillar Growth`,
  metaDescription: `${tagline} ${detail} Jasper Loo Zhu Hang.`,
};
