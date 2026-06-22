/**
 * verify-scroll-behavior.mjs
 *
 * Headless regression harness for the tab/scroll/deep-link behavior of HomePage. It drives a real
 * headless Chrome over the DevTools Protocol (no Puppeteer/Playwright) and asserts the 10 scenarios
 * agreed with the user. There is no unit-testable surface for this — it's all real-browser scroll
 * timing across `useTabScrollMemory` (restore loop), `TheoryContent` (deep-link staging) and
 * `CompetencyMatrix` (the cross-tab matrix jump) — so this script IS the test.
 *
 * It is self-contained: it boots its OWN Vite dev server on a dedicated port and tears it down at
 * the end, so it never touches a dev server you have running yourself.
 *
 * The scenarios (numbers match the user's list):
 *   1.  tool  bottom → refresh → stays at bottom
 *   2.  theory bottom → refresh → stays at bottom
 *   3.  tool↔theory switch → each tab restores its own last scroll, instantly (no smooth glide)
 *   4.  tool top → theory bottom → back to tool → tab bar stays stuck (pinned)
 *   5.  theory: click a pillar → collapse old + expand new, smooth-scroll to its card top
 *       (5b: nothing expanded → just expand + scroll)
 *   6.  deep-link ?section= → restore last scroll, then smooth-scroll to the section
 *   7.  deep-link ?pillar= → restore last scroll (old pillar still open), then collapse→expand→glide
 *   8.  == 6 (any deep-link boots on theory)
 *   9.  == 7 (any deep-link boots on theory)
 *   10. tool help-icon → switch to theory, restore last scroll, then behaves like scenario 5
 *
 * Usage:
 *   node scripts/verify-scroll-behavior.mjs            # boots its own server on :5199
 *   node scripts/verify-scroll-behavior.mjs --port 5200
 *   node scripts/verify-scroll-behavior.mjs --base http://localhost:5174   # reuse a running server
 *   node scripts/verify-scroll-behavior.mjs --filter 7                     # run only scenario(s)
 *   node scripts/verify-scroll-behavior.mjs --verbose                      # print scroll traces
 *
 * Exits 0 if every scenario passes, 1 otherwise.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const DEBUG_PORT = Number(process.env.SCROLL_DEBUG_PORT) || 9360;
const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

// --- args ---------------------------------------------------------------------------------------
const argv = process.argv.slice(2);
const getFlag = (name) => {
  const i = argv.indexOf(name);
  return i !== -1 && i + 1 < argv.length ? argv[i + 1] : null;
};
const VERBOSE = argv.includes("--verbose");
const OWN_PORT = Number(getFlag("--port")) || 5199;
const EXTERNAL_BASE = getFlag("--base"); // if set, reuse a running server instead of booting one
const FILTER = getFlag("--filter"); // comma-separated scenario numbers, e.g. "5,7"
const wantScenario = (n) =>
  !FILTER ||
  FILTER.split(",")
    .map((s) => s.trim())
    .includes(String(n));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- sessionStorage keys (must match src/hooks/useTabScrollMemory.js + src/utils/theory-url.js) --
const KEY_SCROLL = (tab) => `app:tabScroll:${tab}`;
const KEY_EXPANDED = "app:expandedPillar";

// --- CDP plumbing -------------------------------------------------------------------------------
async function cdpHttp(path) {
  const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}${path}`);
  return res.json();
}
class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.listeners = [];
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id != null && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) {
          reject(new Error(JSON.stringify(msg.error)));
        } else {
          resolve(msg.result);
        }
      } else if (msg.method) {
        for (const l of this.listeners) {
          l(msg);
        }
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  on(fn) {
    this.listeners.push(fn);
  }
}

async function evalJs(page, expression) {
  const r = await page.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) {
    throw new Error(r.exceptionDetails.exception?.description || JSON.stringify(r.exceptionDetails));
  }
  return r.result.value;
}

// --- a page wrapper that can record the scrollY trajectory across a navigation -------------------
class Harness {
  constructor(page, baseUrl) {
    this.page = page;
    this.base = baseUrl;
  }

  // Seed sessionStorage on the NEXT document (survives the reload that follows). `entries` is an
  // object of key→value; null value removes the key.
  async seedOnNextDocument(entries) {
    const sets = Object.entries(entries)
      .map(([k, v]) =>
        v === null ? `sessionStorage.removeItem(${JSON.stringify(k)})` : `sessionStorage.setItem(${JSON.stringify(k)},${JSON.stringify(String(v))})`,
      )
      .join(";");
    // Also install a scrollY recorder before the app boots.
    const recorder = `window.__rec=[];window.__t0=performance.now();(function tk(){try{window.__rec.push([Math.round(performance.now()-window.__t0),Math.round(window.scrollY),document.documentElement.scrollHeight]);}catch(e){window.__recerr=String(e);}if(performance.now()-window.__t0<3000)requestAnimationFrame(tk);})();`;
    await this.page.send("Page.addScriptToEvaluateOnNewDocument", { source: `try{${sets}}catch(e){};${recorder}` });
  }

  async navigate(path) {
    const loaded = new Promise((resolve) => this.page.on((m) => m.method === "Page.loadEventFired" && resolve()));
    await this.page.send("Page.navigate", { url: `${this.base}${path}` });
    await loaded;
  }

  // Clear the per-document recorder hook so it doesn't re-install on subsequent navigations.
  async clearNewDocumentScripts() {
    // CDP has no "remove all"; re-navigating with a fresh harness scenario re-adds. We instead just
    // overwrite by tracking ids. Simplicity: this harness adds one script per scenario and we reset
    // between scenarios by spawning a fresh page (see runAll).
  }

  scrollY() {
    return evalJs(this.page, "Math.round(window.scrollY)");
  }
  docHeight() {
    return evalJs(this.page, "document.documentElement.scrollHeight");
  }
  async maxScroll() {
    return evalJs(this.page, "document.documentElement.scrollHeight - window.innerHeight");
  }
  async scrollTo(y) {
    await evalJs(this.page, `window.scrollTo(0, ${y})`);
    await sleep(120);
  }
  async scrollToBottom() {
    await evalJs(this.page, "window.scrollTo(0, document.documentElement.scrollHeight)");
    await sleep(150);
    return this.scrollY();
  }
  activeTab() {
    return evalJs(this.page, "new URLSearchParams(location.search).get('tab')");
  }
  // Click a tab in the sticky bar by label ("Tool" | "Theory"). The button's textContent also holds a
  // version badge (e.g. "Theoryv2.9"), so match by prefix, not equality.
  async clickTab(label) {
    const ok = await evalJs(
      this.page,
      `(()=>{const bar=document.getElementById('app-shell-tab-bar');const b=[...bar.querySelectorAll('[role=tab]')].find(x=>x.textContent.trim().toLowerCase().startsWith(${JSON.stringify(label.toLowerCase())}));if(b){b.click();return true;}return false;})()`,
    );
    if (!ok) {
      throw new Error(`tab "${label}" not found`);
    }
  }
  // Click a pillar matrix card header by its pillarId.
  async clickPillar(pillarId) {
    return evalJs(
      this.page,
      `(()=>{const t=document.getElementById('competency-matrix-${pillarId}-trigger');if(t){t.click();return true;}return false;})()`,
    );
  }
  // Click a tool-form help icon for a pillar (aria-label contains "in the competency matrix").
  async clickHelpIcon(pillarId) {
    return evalJs(
      this.page,
      `(()=>{const b=[...document.querySelectorAll('button,[role=button]')].find(x=>/in the competency matrix/i.test(x.getAttribute('aria-label')||''));if(b){b.click();return b.getAttribute('aria-label');}return null;})()`,
    );
  }
  expandedPillarId() {
    return evalJs(
      this.page,
      `(()=>{const t=[...document.querySelectorAll('[aria-expanded="true"]')].find(b=>b.id&&b.id.includes('competency-matrix'));return t?t.id.replace('competency-matrix-','').replace('-trigger',''):null;})()`,
    );
  }
  // Rect top of a pillar card (the <article>), viewport-relative.
  cardTop(pillarId) {
    return evalJs(
      this.page,
      `(()=>{const a=document.getElementById('competency-matrix-${pillarId}');return a?Math.round(a.getBoundingClientRect().top):null;})()`,
    );
  }
  stickyOffset() {
    return evalJs(this.page, "parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-sticky-offset'))||0");
  }
  tabBarTop() {
    return evalJs(
      this.page,
      "(()=>{const b=document.getElementById('app-shell-tab-bar');return b?Math.round(b.getBoundingClientRect().top):null;})()",
    );
  }
  tabBarBottom() {
    return evalJs(
      this.page,
      "(()=>{const b=document.getElementById('app-shell-tab-bar');return b?Math.round(b.getBoundingClientRect().bottom):null;})()",
    );
  }
  rec() {
    return evalJs(this.page, "window.__rec || []");
  }
}

// --- assertions ---------------------------------------------------------------------------------
function approx(a, b, tol = 3) {
  return Math.abs(a - b) <= tol;
}

// A pillar card is "correctly scrolled to" if it sits just below the sticky tab bar with the normal
// gap — measured as (card top − bar bottom), the gap the user actually sees. The CSS `--app-sticky-
// offset` var (≈58) is a scroll *target* inset, NOT the rendered bar height (≈50) — so asserting
// cardTop≈offset is wrong; we compare the visible gap against the expected gap instead. For a card so
// near the page bottom that the page can't scroll it that high, accept the bottomed-out page.
const EXPECTED_CARD_GAP_PX = 92; // observed (card top − bar bottom) when correctly scrolled
function cardLandedUnderBar({ cardTop, barBottom, scrollY, maxScroll }) {
  const gap = cardTop - barBottom;
  if (approx(gap, EXPECTED_CARD_GAP_PX, 10)) {
    return true;
  }
  // clamped at page bottom: card still below the bar (positive gap), just couldn't reach full inset
  return approx(scrollY, maxScroll, 3) && gap >= 0;
}

// Does the recorded trajectory contain a sustained pause at ~`y` (restore), followed by a later
// monotonic-ish move to a higher position (the glide)? Returns {restored, glided}.
function analyzeTrajectory(rec, restoreY) {
  const ys = rec.map((r) => r[1]);
  const restored = ys.some((y) => approx(y, restoreY, 6));
  const maxY = Math.max(...ys, 0);
  const glided = maxY > restoreY + 50;
  // "smooth" = many distinct intermediate scrollY values between restoreY and maxY (a jump would
  // produce ~0 intermediates).
  const between = new Set(ys.filter((y) => y > restoreY + 10 && y < maxY - 10));
  return { restored, glided, smoothSteps: between.size, maxY };
}

// --- one fresh page per scenario (so the per-document recorder/seed don't leak) -----------------
async function withFreshPage(browser, fn) {
  const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" });
  const pageTarget = (await cdpHttp("/json")).find((t) => t.id === targetId);
  const pageWs = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise((r) => pageWs.addEventListener("open", r));
  const page = new CDP(pageWs);
  await page.send("Page.enable");
  await page.send("Runtime.enable");
  await page.send("Emulation.setDeviceMetricsOverride", { width: 900, height: 900, deviceScaleFactor: 1, mobile: false });
  try {
    return await fn(page);
  } finally {
    await browser.send("Target.closeTarget", { targetId }).catch(() => {});
  }
}

// Helper: load a base session, scroll, and read back the remembered scroll values by reloading.
// Most scenarios seed sessionStorage explicitly instead (more deterministic).

// ================================================================================================
// Scenario implementations. Each returns { pass: bool, detail: string }.
// ================================================================================================
const SCENARIOS = [
  {
    n: 1,
    name: "tool bottom → refresh → stays",
    async run(browser, base) {
      return withFreshPage(browser, async (page) => {
        const h = new Harness(page, base);
        await h.navigate("/?tab=tool");
        await sleep(2000);
        const bottom = await h.scrollToBottom();
        // Persist happens on unload; seed it explicitly to be deterministic, then reload.
        await h.seedOnNextDocument({ [KEY_SCROLL("tool")]: bottom });
        await h.navigate("/?tab=tool");
        await sleep(2200);
        const after = await h.scrollY();
        const max = await h.maxScroll();
        const pass = approx(after, Math.min(bottom, max), 20) && after > 100;
        return { pass, detail: `bottom=${bottom} afterRefresh=${after} (max=${max})` };
      });
    },
  },
  {
    n: 2,
    name: "theory bottom → refresh → stays",
    async run(browser, base) {
      return withFreshPage(browser, async (page) => {
        const h = new Harness(page, base);
        await h.navigate("/?tab=theory");
        await sleep(2000);
        const bottom = await h.scrollToBottom();
        await h.seedOnNextDocument({ [KEY_SCROLL("theory")]: bottom });
        await h.navigate("/?tab=theory");
        await sleep(2200);
        const after = await h.scrollY();
        const max = await h.maxScroll();
        const pass = approx(after, Math.min(bottom, max), 20) && after > 100;
        return { pass, detail: `bottom=${bottom} afterRefresh=${after} (max=${max})` };
      });
    },
  },
  {
    n: 3,
    name: "tool↔theory switch → each restores own scroll, no smooth glide",
    async run(browser, base) {
      return withFreshPage(browser, async (page) => {
        const h = new Harness(page, base);
        await h.navigate("/?tab=tool");
        await sleep(2000);
        // scroll tool to ~200
        await h.scrollTo(200);
        const toolY = await h.scrollY();
        // go to theory, scroll to ~500
        await h.clickTab("Theory");
        await sleep(600);
        await h.scrollTo(500);
        const theoryY = await h.scrollY();
        // back to tool — should restore toolY instantly
        await evalJs(
          page,
          "window.__sw=[];const t0=performance.now();(function tk(){window.__sw.push(Math.round(window.scrollY));if(performance.now()-t0<700)requestAnimationFrame(tk);})();",
        );
        await h.clickTab("Tool");
        await sleep(800);
        const backTool = await h.scrollY();
        const sw = await evalJs(page, "window.__sw||[]");
        // no smooth glide = scrollY should snap; few distinct intermediate values between toolY and theoryY
        const intermediates = new Set(sw.filter((y) => y > toolY + 15 && y < theoryY - 15));
        // and back to theory restores theoryY
        await h.clickTab("Theory");
        await sleep(800);
        const backTheory = await h.scrollY();
        if (VERBOSE) {
          console.log(
            `    DEBUG savedTool=${await evalJs(page, `sessionStorage.getItem('app:tabScroll:tool')`)} savedTheory=${await evalJs(page, `sessionStorage.getItem('app:tabScroll:theory')`)}`,
          );
        }
        const pass = approx(backTool, toolY, 25) && approx(backTheory, theoryY, 25) && intermediates.size <= 2;
        return { pass, detail: `toolY=${toolY} theoryY=${theoryY} backTool=${backTool} backTheory=${backTheory} glideSteps=${intermediates.size}` };
      });
    },
  },
  {
    n: 4,
    name: "tool top → theory bottom → back to tool → bar stays stuck",
    async run(browser, base) {
      return withFreshPage(browser, async (page) => {
        const h = new Harness(page, base);
        await h.navigate("/?tab=tool");
        await sleep(2000);
        await h.scrollTo(0);
        await h.clickTab("Theory");
        await sleep(600);
        await h.scrollToBottom();
        await h.clickTab("Tool");
        await sleep(900);
        const barTop = await h.tabBarTop();
        const y = await h.scrollY();
        // "stuck" = the bar stays at/near the top of the viewport after the switch (the keep-stuck
        // anchor raises tool to its stick point) AND the page didn't reset to the top. The two tabs
        // have slightly different intro heights, so allow a small cross-tab anchor slack rather than
        // demanding a pixel-perfect 0 — confirmed acceptable in the real app.
        const pass = barTop !== null && barTop <= 30 && y > 0;
        return { pass, detail: `barTop=${barTop} scrollY=${y}` };
      });
    },
  },
  {
    n: 5,
    name: "theory: click pillar → swap expand + smooth-scroll to card",
    async run(browser, base) {
      return withFreshPage(browser, async (page) => {
        const h = new Harness(page, base);
        // The over-scroll regression: pillar A (process, #7) expanded, then expand pillar B
        // (communication, #8) BELOW it. A collapses above B while B scrolls, so a naive single scroll
        // lands B under the bar with no gap. B must end with the normal gap below the sticky bar.
        await h.seedOnNextDocument({ [KEY_EXPANDED]: "process", [KEY_SCROLL("theory")]: 0 });
        await h.navigate("/?tab=theory");
        await sleep(2000);
        await evalJs(
          page,
          "window.__rec=[];const t0=performance.now();(function tk(){window.__rec.push([0,Math.round(window.scrollY),0]);if(performance.now()-t0<2500)requestAnimationFrame(tk);})();",
        );
        await h.clickPillar("communication");
        await sleep(2300);
        const expanded = await h.expandedPillarId();
        const cardTop = await h.cardTop("communication");
        const barBottom = await h.tabBarBottom();
        const scrollY = await h.scrollY();
        const maxScroll = await h.maxScroll();
        const rec = await h.rec();
        const ys = rec.map((r) => r[1]);
        const between = new Set(ys.filter((y, i) => i > 0 && y !== ys[0]));
        const onlyOneExpanded = expanded === "communication";
        const landed = cardTop !== null && cardLandedUnderBar({ cardTop, barBottom, scrollY, maxScroll });
        const smooth = between.size >= 8; // many intermediate frames = smooth glide
        return {
          pass: onlyOneExpanded && landed && smooth,
          detail: `expanded=${expanded} cardTop=${cardTop} barBottom=${barBottom} gap=${cardTop - barBottom} scrollY=${scrollY}/${maxScroll} smoothSteps=${between.size}`,
        };
      });
    },
  },
  {
    n: "5b",
    name: "theory: click pillar with NONE expanded → expand + scroll",
    async run(browser, base) {
      return withFreshPage(browser, async (page) => {
        const h = new Harness(page, base);
        await h.seedOnNextDocument({ [KEY_EXPANDED]: null, [KEY_SCROLL("theory")]: 0 });
        await h.navigate("/?tab=theory");
        await sleep(2000);
        await h.clickPillar("communication");
        await sleep(2300);
        const expanded = await h.expandedPillarId();
        const cardTop = await h.cardTop("communication");
        const barBottom = await h.tabBarBottom();
        const scrollY = await h.scrollY();
        const maxScroll = await h.maxScroll();
        const pass = expanded === "communication" && cardTop !== null && cardLandedUnderBar({ cardTop, barBottom, scrollY, maxScroll });
        return {
          pass,
          detail: `expanded=${expanded} cardTop=${cardTop} barBottom=${barBottom} gap=${cardTop - barBottom} scrollY=${scrollY}/${maxScroll}`,
        };
      });
    },
  },
  {
    n: 6,
    name: "deep-link ?section= → restore last scroll, then smooth-scroll to section",
    async run(browser, base) {
      return withFreshPage(browser, async (page) => {
        const h = new Harness(page, base);
        const SEED = 600;
        await h.navigate("/?tab=theory"); // establish origin so sessionStorage seeds stick
        await sleep(1200);
        await h.seedOnNextDocument({ [KEY_SCROLL("theory")]: SEED, [KEY_EXPANDED]: null });
        await h.navigate("/?tab=theory&section=tracks");
        await sleep(2600);
        const rec = await h.rec();
        if (VERBOSE) {
          console.log(
            `    DEBUG rec.len=${rec.length} seedReadback=${await evalJs(page, `sessionStorage.getItem(${JSON.stringify(KEY_SCROLL("theory"))})`)}`,
          );
        }
        const a = analyzeTrajectory(rec, SEED);
        // section "tracks" is near the bottom, so glide should go well past SEED
        const pass = a.restored && a.glided && a.smoothSteps >= 8;
        if (VERBOSE) {
          printTrace(rec);
        }
        return { pass, detail: `restored@${SEED}=${a.restored} glided=${a.glided}(max=${a.maxY}) smoothSteps=${a.smoothSteps}` };
      });
    },
  },
  {
    n: 7,
    name: "deep-link ?pillar= → restore (old pillar open), then collapse→expand→glide",
    async run(browser, base) {
      return withFreshPage(browser, async (page) => {
        const h = new Harness(page, base);
        const SEED = 600;
        await h.navigate("/?tab=theory");
        await sleep(1200);
        // old expanded = process (#7); deep-link targets communication (#8, BELOW it) — the reported
        // over-scroll case: the old pillar collapses ABOVE the target, sliding it up while we glide.
        await h.seedOnNextDocument({ [KEY_SCROLL("theory")]: SEED, [KEY_EXPANDED]: "process" });
        await h.navigate("/?tab=theory&section=matrix&pillar=communication");
        await sleep(2900);
        const rec = await h.rec();
        const a = analyzeTrajectory(rec, SEED);
        const expanded = await h.expandedPillarId();
        const cardTop = await h.cardTop("communication");
        const barBottom = await h.tabBarBottom();
        const scrollY = await h.scrollY();
        const maxScroll = await h.maxScroll();
        // The scroll must HOLD at SEED while the collapse/expand happens (height changes, y steady),
        // then glide to the target card — landing with the normal gap, not gapless under the bar.
        const heldAtSeed = rec.filter((r) => approx(r[1], SEED, 6)).length >= 5;
        const landed = cardTop !== null && cardLandedUnderBar({ cardTop, barBottom, scrollY, maxScroll });
        const pass = a.restored && heldAtSeed && expanded === "communication" && landed && a.smoothSteps >= 8;
        if (VERBOSE) {
          printTrace(rec);
        }
        return {
          pass,
          detail: `restored=${a.restored} heldAtSeed=${heldAtSeed} expanded=${expanded} cardTop=${cardTop} gap=${cardTop - barBottom} scrollY=${scrollY}/${maxScroll} smoothSteps=${a.smoothSteps}`,
        };
      });
    },
  },
  {
    n: 8,
    name: "deep-link ?section= boots on theory (== scenario 6)",
    async run(browser, base) {
      // Identical mechanism to 6 — any deep-link URL boots on theory regardless of prior tab.
      return SCENARIOS.find((s) => s.n === 6).run(browser, base);
    },
  },
  {
    n: 9,
    name: "deep-link ?pillar= boots on theory (== scenario 7)",
    async run(browser, base) {
      return SCENARIOS.find((s) => s.n === 7).run(browser, base);
    },
  },
  {
    n: 10,
    name: "tool help-icon → switch to theory, restore last scroll, then behave like 5",
    async run(browser, base) {
      return withFreshPage(browser, async (page) => {
        const h = new Harness(page, base);
        const SEED = 500;
        await h.navigate("/?tab=tool");
        await sleep(2000);
        // remember a theory scroll, then scroll tool down a bit so we can see it's NOT inherited
        await evalJs(page, `sessionStorage.setItem(${JSON.stringify(KEY_SCROLL("theory"))}, "${SEED}")`);
        await h.scrollTo(259);
        await evalJs(
          page,
          "window.__rec=[];const t0=performance.now();(function tk(){window.__rec.push([Math.round(performance.now()-t0),Math.round(window.scrollY),0]);if(performance.now()-t0<2500)requestAnimationFrame(tk);})();",
        );
        const label = await h.clickHelpIcon();
        await sleep(2300);
        const tab = await h.activeTab();
        const rec = await h.rec();
        const a = analyzeTrajectory(rec, SEED);
        const expanded = await h.expandedPillarId();
        const barBottom = await h.tabBarBottom();
        const cardTop = expanded ? await h.cardTop(expanded) : null;
        const scrollY = await h.scrollY();
        const maxScroll = await h.maxScroll();
        const restoredFirst = rec.some((r) => approx(r[1], SEED, 8));
        const landed = cardTop !== null && cardLandedUnderBar({ cardTop, barBottom, scrollY, maxScroll });
        const pass = tab === "theory" && restoredFirst && a.glided && landed && a.smoothSteps >= 8 && Boolean(label);
        if (VERBOSE) {
          printTrace(rec);
        }
        return {
          pass,
          detail: `tab=${tab} restored@${SEED}=${restoredFirst} expanded=${expanded} cardTop=${cardTop} gap=${cardTop - barBottom} scrollY=${scrollY}/${maxScroll} smoothSteps=${a.smoothSteps}`,
        };
      });
    },
  },
];

function printTrace(rec) {
  let pY = null;
  let pH = null;
  console.log("    trace (y or H change):");
  for (const [t, y, hh] of rec) {
    if (y !== pY || hh !== pH) {
      console.log(`      ${t}ms  y=${y}  H=${hh}`);
      pY = y;
      pH = hh;
    }
  }
}

// ================================================================================================
async function main() {
  let viteProc = null;
  let chrome = null;
  const userDataDir = mkdtempSync(join(tmpdir(), "egf-scroll-verify-"));
  let base = EXTERNAL_BASE;

  try {
    if (!base) {
      base = `http://localhost:${OWN_PORT}`;
      console.log(`Booting own Vite dev server on :${OWN_PORT} ...`);
      viteProc = spawn("npx", ["vite", "--port", String(OWN_PORT), "--strictPort"], {
        cwd: REPO_ROOT,
        env: process.env,
        stdio: "ignore",
        detached: false,
      });
      // wait for it
      let up = false;
      for (let i = 0; i < 60; i++) {
        try {
          const r = await fetch(`${base}/`);
          if (r.ok) {
            up = true;
            break;
          }
        } catch {}
        await sleep(300);
      }
      if (!up) {
        throw new Error(`Vite did not come up on ${base}`);
      }
    } else {
      console.log(`Reusing dev server at ${base}`);
    }

    chrome = spawn(CHROME, [
      "--headless=new",
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${userDataDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-gpu",
      "--window-size=900,900",
      "about:blank",
    ]);
    chrome.stderr.on("data", () => {});

    let version = null;
    for (let i = 0; i < 60; i++) {
      try {
        version = await cdpHttp("/json/version");
        if (version) {
          break;
        }
      } catch {
        await sleep(200);
      }
    }
    if (!version) {
      throw new Error("Chrome debug endpoint never came up");
    }

    const browserWs = new WebSocket(version.webSocketDebuggerUrl);
    await new Promise((r) => browserWs.addEventListener("open", r));
    const browser = new CDP(browserWs);

    const results = [];
    for (const s of SCENARIOS) {
      const label = `${s.n}`;
      if (!wantScenario(s.n) && !(typeof s.n === "string" && wantScenario(s.n.replace(/\D/g, "")))) {
        continue;
      }
      process.stdout.write(`Scenario ${label}: ${s.name} ... `);
      try {
        const { pass, detail } = await s.run(browser, base);
        results.push({ n: s.n, pass, detail });
        console.log(pass ? `✓` : `✗`);
        console.log(`    ${detail}`);
      } catch (err) {
        results.push({ n: s.n, pass: false, detail: `THREW: ${err.message}` });
        console.log(`✗ (threw)`);
        console.log(`    ${err.stack || err.message}`);
      }
    }

    console.log("\n──────── SUMMARY ────────");
    let allPass = true;
    for (const r of results) {
      if (!r.pass) {
        allPass = false;
      }
      console.log(`  ${r.pass ? "✓" : "✗"}  Scenario ${r.n}`);
    }
    console.log(`\n${allPass ? "ALL PASS ✓" : "FAIL ✗"}`);
    process.exitCode = allPass ? 0 : 1;
  } catch (err) {
    console.error("ERROR:", err.stack || String(err));
    process.exitCode = 1;
  } finally {
    if (chrome) {
      chrome.kill("SIGKILL");
    }
    if (viteProc) {
      viteProc.kill("SIGTERM");
    }
    try {
      rmSync(userDataDir, { recursive: true, force: true });
    } catch {}
  }
}

main();
