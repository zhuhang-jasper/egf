export const SITE_COPY = {
  title: "The 9-Pillar Engineer Growth Framework",
  tagline: "A spider chart to measure software engineering mastery, identify core interests, and guide career paths.",
  detail: "Supported by a 45-point competency matrix across 5 seniority levels.",
  byline: "— Jasper Loo Zhu Hang",
  shortName: "9-Pillar Framework",
  // Shown (muted) as the chart title when the title field is left blank but the title is enabled.
  chartTitlePlaceholder: "<chart_title_here>",
  // Native share-sheet copy + chart-image export filename.
  share: {
    // Title hint passed to the OS share sheet (used as the subject line by email targets).
    title: "The 9-Pillar Engineer Growth Framework",
    // Message body. `{link}` is replaced at runtime with the canonical tool link.
    messageTemplate:
      "Check out my engineering spider chart! I just mapped my skills using Jasper's 9-Pillar Growth Framework. Find out yours at: {link}",
    // Query string appended to the app's base URL so the recipient lands on the Tool tab.
    toolLinkQuery: "?tab=tool",
    // Fixed filename for the exported chart PNG.
    fileName: "jaspers-9pillar-engineer-growth-framework.png",
  },
};
