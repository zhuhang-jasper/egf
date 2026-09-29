import { describe, expect, it } from "vitest";

import { careerStageFromScores, formatAvgScore } from "@/constants/scores";

const ORDER = ["coding", "domainLogic", "architecture", "ai", "uiUx", "productSense", "process", "communication", "ownership"];
const levels = (values) => Object.fromEntries(ORDER.map((id, i) => [id, values[i]]));
const all = (v) => levels(ORDER.map(() => v));

describe("careerStageFromScores", () => {
  it.each([
    ["the original bug stays below S3", levels([5, 5, 5, 0, 3.5, 3.5, 0, 0, 0]), "S2", "deepTechnical"],
    ["support 3.2 misses S5's 3.3", levels([5, 4.5, 5, 3.5, 2.5, 3, 3, 3.5, 4]), "S4", "deepTechnical"],
    ["an S4 tie goes to the higher keyMean", levels([3, 3, 2.5, 2.5, 2.5, 4, 4.5, 4.5, 4.5]), "S4", "peopleDelivery"],
    ["an all-track tie goes to TRACKS order", all(2), "S2", "deepTechnical"],
    ["all zero is S1", all(0), "S1", "deepTechnical"],
    ["a product-led profile matches Product-Focused", levels([3.5, 3.5, 2.5, 3, 4.5, 4, 2.5, 4, 3]), "S4", "productFocused"],
    ["one zero caps at S2, never S1", { ...all(5), ownership: 0 }, "S2", "deepTechnical"],
  ])("%s", (_name, pillarLevels, stage, track) => {
    expect(careerStageFromScores(pillarLevels)).toMatchObject({ stage, track });
  });

  it("does not let a zero AI score cap the stage", () => {
    expect(careerStageFromScores({ ...all(5), ai: 0 })).toMatchObject({ stage: "S5", minPillar: 5 });
  });

  it("returns the matched track's means", () => {
    expect(careerStageFromScores(levels([5, 4.5, 5, 3.5, 2.5, 3, 3, 3.5, 4]))).toEqual({
      stage: "S4",
      track: "deepTechnical",
      keyMean: 4.5,
      supportMean: 3.2,
      minPillar: 2.5,
    });
  });
});

describe("formatAvgScore", () => {
  it("rounds to two decimals", () => {
    expect(formatAvgScore(3.456)).toBe("3.46");
  });
  it("shows n/a for a non-finite value", () => {
    expect(formatAvgScore(NaN)).toBe("n/a");
  });
});
