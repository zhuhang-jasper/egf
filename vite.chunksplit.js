/**
 * Rollup `manualChunks` for production splits. Inspect with `npm run analyze`
 * → `dist/stats.html`.
 *
 * Resolves the nearest `node_modules` package via regex so nested deps (e.g.
 * `scheduler`) group correctly on all platforms.
 */

/** Last `.../node_modules/<pkg>/...` segment (`pkg` is `name` or `@scope/name`). */
const NODE_MODULES_PKG = /\/node_modules\/(@[^/]+\/[^/]+|[^/]+)(?=\/|$)/g;

/**
 * First matching `[regex, chunk]` wins (order matters). Each pattern uses exact package names from this
 * repo's tree only (`package.json` + `package-lock.json`). Add entries when you add matching deps.
 */
const CHUNK_RULES = [
  [/^@radix-ui\//, "radix"],
  [/^chart\.js$/, "chart"],
  [/^@zumer\/snapdom$/, "snapdom"],
  [/^lucide-react$/, "lucide"],
  [/^zustand$/, "zustand"],
  [/^(clsx|tailwind-merge|class-variance-authority)$/, "ui-utils"],
  [/^(react|react-dom|scheduler|use-sync-external-store)$/, "react-vendor"],
];

const npmPackageName = (id) => {
  const normalized = id.replace(/\\/g, "/");
  NODE_MODULES_PKG.lastIndex = 0;
  let last;
  for (const [, segment] of normalized.matchAll(NODE_MODULES_PKG)) {
    last = segment;
  }
  return last;
};

export const manualChunks = (id) => {
  const pkg = npmPackageName(id);
  if (!pkg) {
    return undefined;
  }

  for (const [re, chunk] of CHUNK_RULES) {
    re.lastIndex = 0;
    if (re.test(pkg)) {
      return chunk;
    }
  }

  return undefined;
};
