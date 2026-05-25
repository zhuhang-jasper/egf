import fs from "node:fs";
import path from "node:path";
import { tz } from "@date-fns/tz";
import { formatISO } from "date-fns";

import { resolveAppVersion } from "./resolve-app-version";

/**
 * Writes build metadata next to the bundle for deployment dashboards and support.
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
      buildTimeUtc: now.toISOString(),
      buildTimeMyt: formatISO(now, { in: tz("Asia/Kuala_Lumpur") }),
    };
    fs.writeFileSync(path.join(outDir, "meta.json"), `${JSON.stringify(meta, null, 2)}\n`, "utf8");
  },
  name: "z4b-generate-meta",
});
