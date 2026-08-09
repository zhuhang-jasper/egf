/**
 * The name comes in three forms, and a slot takes whichever one its room allows:
 *
 *   canonical  9-Pillar Engineer Growth Framework       `title` below (the <h1>), manifest `name`,
 *                                                        og:site_name, share.title, the image alts
 *   long       …Growth Framework — Jasper Loo            <title>, og:title, twitter:title
 *   short      9-Pillar EGF                              home-screen icon, application-name
 *
 * No article and no possessive in the name itself. See docs/DECISIONS.md#the-name-has-no-article.
 */
export const SITE_COPY = {
  title: "9-Pillar Engineer Growth Framework",
  tagline: "A spider chart to measure software engineering mastery, identify core interests, and guide career paths.",
  detail: "Supported by a 45-point competency matrix across 5 proficiency levels.",
  byline: "— Jasper Loo Zhu Hang",
  /**
   * MIRRORED IN TWO STATIC FILES that cannot import this: `short_name` in `public/manifest.json`, and
   * `application-name` plus `apple-mobile-web-app-title` in `index.html`. Change all three together.
   *
   * Keep it to ~12 characters, where both platforms truncate the home-screen label. Do not shorten to a
   * bare "EGF": nothing on the page spells the acronym out, so "9-Pillar" carries the recognition.
   */
  shortName: "9-Pillar EGF",
  /**
   * The header brand lockup (see AppShellBrandMark). Two lines rather than the poster's three, which inside
   * a 32px row lands at ~8.5px type. Split as data rather than derived from `title`, since the break points
   * are a typographic decision rather than something recoverable from the sentence.
   */
  shortLockup: {
    numeral: "9",
    lines: ["Pillar Engineer", "Growth Framework"],
  },
  // Shown muted as the chart title when the title field is blank but the title is enabled.
  chartTitlePlaceholder: "<chart_title_here>",
  share: {
    // Subject line for email share targets, so it takes the canonical form rather than the long one.
    title: "9-Pillar Engineer Growth Framework",
    // `{link}` is replaced at runtime with the canonical tool link.
    messageTemplate:
      "Check out my engineering spider chart! I just mapped my skills using Jasper's 9-Pillar Engineer Growth Framework. Find out yours at: {link}",
    // A different sentence, not a reworded one: the chart message is first-person about a result the sharer
    // produced, and the theory tab is the reference behind it rather than a result.
    theoryMessageTemplate:
      "Jasper's 9-Pillar Engineer Growth Framework: a model for measuring software engineering mastery and guiding career paths. {link}",
    toolLinkQuery: "?tab=tool",
    // `{profileName}` and `{date}` are filled by buildChartFileName. Date last, so one profile's exports
    // sort chronologically in a file listing.
    fileName: "9-pillar-egf-{profileName}-{date}.png",
    // Stands in for `{profileName}` when there is no name, so the file reads as deliberately unnamed rather
    // than as naming having failed. Set to "" to drop the segment.
    unnamedProfileSlug: "untitled",
    // Pre-rendered poster in `public/`, resolved against BASE_URL at call time. A static asset rather than a
    // runtime capture, since the theory tab has no single element worth rasterizing. Bump the vN when the
    // artwork is replaced, so caches and already-shared copies stay distinguishable.
    theoryImagePath: "poster-pillar-v4.png",
    theoryImageFileName: "9-pillar-egf-theory.png",
  },
};
