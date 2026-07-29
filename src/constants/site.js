/**
 * THE NAME COMES IN THREE FORMS, and a slot takes whichever one its room allows:
 *
 *   canonical  9-Pillar Engineer Growth Framework       `title` below (the <h1>), manifest `name`,
 *                                                        og:site_name, share.title, the image alts
 *   long       …Growth Framework — Jasper Loo            <title>, og:title, twitter:title
 *   short      9-Pillar EGF                              home-screen icon, application-name
 *
 * NO ARTICLE, NO POSSESSIVE — the two things stripped from the name, for the same reason in both cases: the
 * opening word of a title is its most valuable position, and neither "The" nor "Jasper's" earns it.
 *
 * The possessive cost more than prominence. A self-applied one reads as one person's take rather than a model
 * others can cite, and the eponymous frameworks this was modelled on (the Barrett Model, Bloom's Taxonomy)
 * had that possessive CONFERRED by the people citing them, never claimed up front.
 *
 * Dropping "The" is what leaves ONE canonical string instead of two that differed only by the article — the
 * <h1> and og:site_name had drifted apart on exactly that, and there is now nothing to keep in sync. The
 * article survives only inside real sentences (`tagline`, `detail`, `share.messageTemplate`), where it is
 * grammar rather than naming.
 *
 * Attribution is not lost, only separated from the name: appended as a suffix in the long form, and carried
 * on-page by `byline`, `<meta name="author">`, and the og:description.
 */
export const SITE_COPY = {
  title: "9-Pillar Engineer Growth Framework",
  tagline: "A spider chart to measure software engineering mastery, identify core interests, and guide career paths.",
  detail: "Supported by a 45-point competency matrix across 5 proficiency levels.",
  byline: "— Jasper Loo Zhu Hang",
  /**
   * The app's short name. MIRRORED IN TWO STATIC FILES that cannot import this module — `short_name` in
   * `public/manifest.json`, and both `application-name` and `apple-mobile-web-app-title` in `index.html`.
   * Change them together.
   *
   * The one that prints under the home-screen icon is platform-specific: the manifest's `short_name` on
   * Android, `apple-mobile-web-app-title` on iOS (which falls back to the long <title> if absent).
   * `application-name` is the spec's generic "short name of the web application" and is read by pinned
   * sites rather than the icon label.
   *
   * KEEP IT SHORT — ~12 CHARACTERS. This is what a phone prints under the home-screen icon once the app is
   * installed, and both iOS and Android truncate past roughly that; the older "9-Pillar Framework" (18)
   * showed there as "9-Pillar Fram…". The limit is really a pixel width rather than a character count, so
   * this value sits right at the edge and may still be cut to "9-Pillar EG…" on a narrow phone.
   *
   * "EGF" expands to the Engineer Growth Framework of the full `title`, and is the same abbreviation the
   * app deploys under (/egf/). Nothing on the page spells the acronym out, so "9-Pillar" is carrying the
   * recognition here — do not shorten this to a bare "EGF".
   *
   * The header does not use this — the collapsed header shows `shortLockup` below, which is the mark
   * rather than a text label. This is for the places the OS asks for a name and gives us no room.
   */
  shortName: "9-Pillar EGF",
  /**
   * The compact brand lockup shown beside the logo once the header is collapsed: an oversized numeral
   * with the rest of the name stacked tight against it (see AppShellBrandMark).
   *
   * TWO LINES, NOT THREE. The full title breaks as "Pillar Engineer / Growth / Framework" at poster
   * scale, but the collapsed header's row is 32px, and three lines inside it works out to ~8.5px type.
   * Two lines fit that row at 11px, which stays legible.
   *
   * Split as data rather than derived from `title`: the break points are a typographic decision about
   * this lockup, not something recoverable from the sentence.
   */
  shortLockup: {
    numeral: "9",
    lines: ["Pillar Engineer", "Growth Framework"],
  },
  // Shown (muted) as the chart title when the title field is left blank but the title is enabled.
  chartTitlePlaceholder: "<chart_title_here>",
  // Native share-sheet copy + chart-image export filename.
  share: {
    // Title hint passed to the OS share sheet (used as the subject line by email targets). The canonical
    // name — a subject line is a label, so it takes the same form as the <h1> rather than the long one.
    title: "9-Pillar Engineer Growth Framework",
    // Message body. `{link}` is replaced at runtime with the canonical tool link.
    messageTemplate:
      "Check out my engineering spider chart! I just mapped my skills using Jasper's 9-Pillar Engineer Growth Framework. Find out yours at: {link}",
    // Query string appended to the app's base URL so the recipient lands on the Tool tab.
    toolLinkQuery: "?tab=tool",
    // Fixed filename for the exported chart PNG.
    fileName: "jaspers-9pillar-engineer-growth-framework.png",
  },
};
