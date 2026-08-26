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
/**
 * The OWNERSHIP HALF every credit line opens with, shared so the four surfaces cannot drift apart on the
 * copyright year or the licence name. Each surface appends its own `·`-separated tail:
 *
 *   app footer (screen)   · Build-<appVersion>                    which build you are looking at
 *   app footer (print)    · <title> · v<frameworkVersion> · <date> which document, and which revision
 *   chart PNG             · 9-Pillar Engineer Growth Framework    names the work — the PNG travels alone
 *   poster PNG            · zhuhang-jasper.github.io/egf          the way back, for print and projection
 *
 * ORDER IS OWNERSHIP FIRST, IDENTITY SECOND. The exception is the canonical attribution reusers copy (README,
 * mirrored in index.html's <noscript>), which is work-first because that is the form CC prescribes.
 */
const CREDIT_OWNERSHIP = "© 2026 Jasper Loo Zhu Hang · CC BY-NC 4.0";

export const SITE_COPY = {
  title: "9-Pillar Engineer Growth Framework",
  tagline: "A spider chart to measure software engineering mastery, identify core interests, and guide career paths.",
  detail: "Supported by a 45-point competency matrix across 5 proficiency levels.",
  // Text only — the trailing Malaysian flag is a component, so render sites compose
  // `{SITE_COPY.byline} <MalaysiaFlag />`. Deliberately absent from `share.imageAttribution` below.
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
  // Shown muted as the chart title when the name field is blank but the name is enabled. Bracketed on purpose:
  // this can land in an exported PNG, and brackets read as an unfilled slot rather than as a real title.
  chartTitlePlaceholder: "[Untitled profile name]",
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
    /**
     * Credit line painted along the bottom of an exported chart PNG — not in the DOM, since it belongs to the
     * artifact rather than the on-screen chart (renderChartImageBlob reserves a strip and draws it).
     *
     * NAMES THE WORK, unlike the app footer: a PNG lands in a chat or a deck with nothing around it, so it has
     * to identify the framework as well as the author. The poster is the reverse — its masthead already does,
     * which is why `posterAttribution` spends its tail on the URL. Order matches the footer: ownership first.
     *
     * The framework version is appended at export time from the profile's own stamp (see measureAttribution).
     * The type is a pinned 9px and a line longer than the chart is CLIPPED, so keep this short.
     */
    imageAttribution: `${CREDIT_OWNERSHIP} · 9-Pillar Engineer Growth Framework`,
    /**
     * The poster's own credit line. Same ownership head as the chart export, DIFFERENT TAIL: the poster's
     * masthead already names the framework in 52px type, so repeating it in the footer would be the only
     * thing on the paper said twice. The tail is the app URL instead — the poster is the artifact most likely
     * to be printed or projected, where a link is the only way back to the tool.
     *
     * A LITERAL, not `window.location.origin`: rasterized into a PNG, so a dev origin would ship inside the
     * image. Bare (no scheme, no `?tab=`) because it is read off paper, not clicked.
     */
    posterAttribution: `${CREDIT_OWNERSHIP} · zhuhang-jasper.github.io/egf`,
    // `{profileName}` and `{date}` are filled by buildChartFileName. Date last, so one profile's exports
    // sort chronologically in a file listing.
    fileName: "9-pillar-egf-{profileName}-{date}.png",
    // Stands in for `{profileName}` when there is no name, so the file reads as deliberately unnamed rather
    // than as naming having failed. Set to "" to drop the segment.
    unnamedProfileSlug: "untitled",
    // Pre-rendered poster in `public/`, resolved against BASE_URL at call time. A static asset rather than a
    // runtime capture, since the theory tab has no single element worth rasterizing. Bump the vN when the
    // artwork is replaced, so caches and already-shared copies stay distinguishable.
    theoryImagePath: "poster-masthead-pillar-v4.png",
    theoryImageFileName: "9-pillar-egf-theory.png",
  },
};
