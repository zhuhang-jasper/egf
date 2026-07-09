/**
 * verify-poster-export.mjs
 *
 * Headless smoke test for the /poster PNG export (src/pages/PosterPage.jsx → renderPosterBlob).
 * It drives a real headless Chrome over the DevTools Protocol — no Puppeteer/Playwright needed —
 * navigates to the running dev server's /poster route, reproduces the export's off-screen-clone
 * render path, and asserts:
 *
 *   1. The PNG is the expected 2× resolution (2160 × 3240).
 *   2. It is not blank — a row 72% down the image (inside the career-tracks band) has coloured
 *      pixels, proving the *entire* poster was captured, not just the top header band.
 *   3. The on-screen <article> rect is unchanged before vs. after the render, proving the export
 *      no longer un-scales the live preview (no visible flicker).
 *
 * Why this exists: the export path is fragile in non-obvious ways — Tailwind v4 emits oklch()/
 * oklab() colours (which killed html2canvas, hence the snapdom swap), and the preview uses a
 * `transform: scale()` that can clip or shrink the capture. This script catches regressions in
 * any of those without a manual click-and-eyeball.
 *
 * Prerequisites:
 *   - A dev server running the poster (npm run dev), default http://localhost:5174.
 *   - Google Chrome installed at the macOS default path (override via CHROME_PATH env var).
 *
 * Usage:
 *   node scripts/verify-poster-export.mjs [baseUrl]
 *   node scripts/verify-poster-export.mjs http://localhost:5175
 *
 * Exits 0 on pass, 1 on failure.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE_URL = process.argv[2] || "http://localhost:5174";
const POSTER_URL = `${BASE_URL}/poster`;
const DEBUG_PORT = 9339;
const EXPECT_W = 2160; // CANVAS_W (1080) × export scale (2)
const EXPECT_H = 3240; // CANVAS_H (1620) × export scale (2)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function cdpHttp(path) {
  const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}${path}`);
  return res.json();
}

// Minimal CDP client over a target websocket.
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

// The render path under test, mirrored from src/pages/PosterPage.jsx (renderPosterBlob). Kept in
// sync by hand — if the export logic there changes materially, update this expression too.
const RENDER_AND_ASSERT = `(async () => {
  try {
    const { snapdom } = await import('/node_modules/.vite/deps/@zumer_snapdom.js');
    const node = document.querySelector('article');
    if (!node) return JSON.stringify({ ok: false, error: 'no <article> found' });

    // The bundled webfont must be loaded (and actually applied) so exports render the same
    // Inter glyphs on every device instead of falling back to the OS's system-ui font.
    await document.fonts.ready;
    const interLoaded = document.fonts.check('700 26px "Inter Variable"');
    const h1 = node.querySelector('h1');
    const h1Font = h1 ? getComputedStyle(h1).fontFamily : '';
    const usesInter = /Inter Variable/i.test(h1Font);

    const before = node.getBoundingClientRect();

    const holder = document.createElement('div');
    holder.style.cssText = 'position:fixed;left:-100000px;top:0;width:1080px;height:1620px;overflow:visible;background:#fff;z-index:-1;pointer-events:none;';
    const clone = node.cloneNode(true);
    clone.style.transform = 'none';
    clone.style.transformOrigin = 'top left';
    clone.style.margin = '0';
    holder.appendChild(clone);
    document.body.appendChild(holder);

    const live = node.querySelectorAll('canvas');
    const cloned = clone.querySelectorAll('canvas');
    cloned.forEach((c, i) => {
      const s = live[i];
      if (!s) return;
      c.width = s.width;
      c.height = s.height;
      c.getContext('2d').drawImage(s, 0, 0);
    });

    const blob = await snapdom.toBlob(clone, {
      type: 'png', scale: 2, backgroundColor: '#fff',
      exclude: ['[data-export-ignore]'], excludeMode: 'remove',
    });
    holder.remove();

    const after = node.getBoundingClientRect();

    const bmp = await createImageBitmap(blob);
    const cv = document.createElement('canvas');
    cv.width = bmp.width; cv.height = bmp.height;
    const cx = cv.getContext('2d');
    cx.drawImage(bmp, 0, 0);
    const row = cx.getImageData(0, Math.floor(bmp.height * 0.72), bmp.width, 1).data;
    let nonWhite = 0;
    for (let i = 0; i < row.length; i += 4) {
      if (row[i] < 250 || row[i + 1] < 250 || row[i + 2] < 250) nonWhite++;
    }

    return JSON.stringify({
      ok: true,
      width: bmp.width,
      height: bmp.height,
      bytes: blob.size,
      nonWhiteTracksRow: nonWhite,
      liveRectUnchanged: Math.abs(before.width - after.width) < 0.5 && Math.abs(before.height - after.height) < 0.5,
      interLoaded,
      usesInter,
      h1Font,
    });
  } catch (e) {
    return JSON.stringify({ ok: false, error: String((e && e.message) || e) });
  }
})()`;

let chrome;
let pass = false;
const userDataDir = mkdtempSync(join(tmpdir(), "egf-poster-verify-"));
try {
  chrome = spawn(CHROME, [
    "--headless=new",
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${userDataDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    "--window-size=1400,2200",
    "about:blank",
  ]);
  chrome.stderr.on("data", () => {}); // swallow Chrome's noise

  let version = null;
  for (let i = 0; i < 50; i++) {
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

  const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" });
  const pageTarget = (await cdpHttp("/json")).find((t) => t.id === targetId);
  const pageWs = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise((r) => pageWs.addEventListener("open", r));
  const page = new CDP(pageWs);

  await page.send("Page.enable");
  await page.send("Runtime.enable");

  const loaded = new Promise((resolve) => page.on((m) => m.method === "Page.loadEventFired" && resolve()));
  await page.send("Page.navigate", { url: POSTER_URL });
  await loaded;
  await sleep(2000); // let React + Chart.js mount and draw

  const res = await page.send("Runtime.evaluate", { expression: RENDER_AND_ASSERT, awaitPromise: true, returnByValue: true });
  const out = JSON.parse(res.result.value);
  console.log("RESULT:", JSON.stringify(out, null, 2));

  const checks = [
    [out.ok, "render succeeded"],
    [out.width === EXPECT_W && out.height === EXPECT_H, `dimensions are ${EXPECT_W}×${EXPECT_H}`],
    [out.bytes > 50_000, "PNG is non-trivial (>50KB)"],
    [out.nonWhiteTracksRow > 100, "tracks band has content (not a clipped header)"],
    [out.liveRectUnchanged, "live preview did not re-scale (no flicker)"],
    [out.interLoaded, "Inter Variable webfont is loaded (device-consistent glyphs)"],
    [out.usesInter, `poster text resolves to Inter (h1 font: ${out.h1Font})`],
  ];
  pass = checks.every(([c]) => c);
  console.log("\nCHECKS:");
  for (const [ok, label] of checks) {
    console.log(`  ${ok ? "✓" : "✗"} ${label}`);
  }
  console.log(`\n${pass ? "PASS ✓" : "FAIL ✗"}`);
} catch (err) {
  console.error("ERROR:", err.stack || String(err));
} finally {
  if (chrome) {
    chrome.kill("SIGKILL");
  }
  try {
    rmSync(userDataDir, { recursive: true, force: true });
  } catch {}
}

process.exit(pass ? 0 : 1);
