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
   * The header does not use this — it shows `shortLockup` below, which is the mark rather than a text
   * label. This is for the places the OS asks for a name and gives us no room.
   */
  shortName: "9-Pillar EGF",
  /**
   * The brand lockup in the app header, beside the logo: an oversized numeral with the rest of the name
   * stacked tight against it (see AppShellBrandMark).
   *
   * TWO LINES, NOT THREE. The full title breaks as "Pillar Engineer / Growth / Framework" at poster
   * scale, but the header's row is 32px, and three lines inside it works out to ~8.5px type. Two lines
   * fit that row at a legible size.
   *
   * ONE LENGTH. There was a shorter `compactLines` pair ("Pillar" / "EGF") for when the lockup had to
   * clear a centred tablist beside it, which ran out of room at ~700px. Navigation moved to a bottom bar
   * and the header's title block is gone, so this form fits at every width the app supports and the
   * abbreviation had no width left to serve.
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
    // Message body for sharing the Theory tab itself. A DIFFERENT SENTENCE, not a reworded one: the chart
    // message is first-person about a result the sharer produced ("my spider chart"), and the theory tab is
    // not a result — it is the reference document behind it, so the message points at the framework instead.
    theoryMessageTemplate:
      "Jasper's 9-Pillar Engineer Growth Framework: a model for measuring software engineering mastery and guiding career paths. {link}",
    // Query string appended to the app's base URL so the recipient lands on the Tool tab.
    toolLinkQuery: "?tab=tool",
    // Filename for the exported chart PNG. `{profileName}` is the profile name slugged to lower-kebab and
    // `{date}` the local calendar date as yyyy-mm-dd — both filled by buildChartFileName. An unnamed profile
    // drops its placeholder AND the hyphen beside it, so the name never lands with a dangling separator.
    // The date is last so exports of one profile sort chronologically in a file listing.
    fileName: "9-pillar-egf-{profileName}-{date}.png",
    // The pre-rendered pillar poster in `public/`, attached to a Theory-tab share. A STATIC ASSET, not a
    // runtime capture: the theory tab has no single element worth rasterizing (it is a long document), and
    // this image is the framework's designed one-glance summary. Resolved against BASE_URL at call time
    // because the Pages build serves from /egf/. Bump the vN when the artwork is replaced, so caches and
    // already-shared copies stay distinguishable.
    theoryImagePath: "poster-pillar-v4.png",
    theoryImageFileName: "9-pillar-egf-theory.png",
  },
};
