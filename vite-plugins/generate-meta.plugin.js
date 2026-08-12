import fs from "node:fs";
import path from "node:path";
import { tz } from "@date-fns/tz";
import { formatISO } from "date-fns";

import { resolveAppVersion } from "./resolve-app-version";
import { resolveFrameworkVersion } from "./resolve-framework-version";

/**
 * Writes build metadata next to the bundle for deployment dashboards and support.
 *
 * `frameworkVersion` IS ALSO THE README'S BADGE. The badge is a shields `dynamic` badge pointed at the
 * deployed copy of this file, so it reports the framework revision that is actually live rather than a
 * number kept in step by hand. That makes this field load-bearing for something outside the app: keep it
 * named as-is, since renaming it breaks the badge's JSONPath silently.
 */
export const generateMetaPlugin = () => ({
  closeBundle() {
    const outDir = path.resolve(process.cwd(), "dist");
    if (!fs.existsSync(outDir)) {
      return;
    }
    const now = new Date();
    const meta = {
      version: resolveAppVersion(),
      frameworkVersion: resolveFrameworkVersion(),
      buildTimeUtc: now.toISOString(),
      buildTimeMyt: formatISO(now, { in: tz("Asia/Kuala_Lumpur") }),
    };
    fs.writeFileSync(path.join(outDir, "meta.json"), `${JSON.stringify(meta, null, 2)}\n`, "utf8");
  },
  name: "z4b-generate-meta",
});
