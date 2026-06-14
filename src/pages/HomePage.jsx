import { AppIntro } from "@/components/AppIntro";
import { ChartSection } from "@/components/ChartSection";
import { FormPanel } from "@/components/FormPanel";

import { FE_UI } from "@/lib/constants";

const appVersion = import.meta.env.VITE_APP_VERSION;

const pageWidthStyle = {
  maxWidth: FE_UI.page.maxWidthPx,
  minWidth: FE_UI.page.minWidthPx,
};

export default function HomePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center gap-2 bg-black p-1.5 sm:p-3">
      <main className="grid w-full grid-cols-1 items-stretch rounded-[14px] bg-white p-2 shadow-sm sm:p-3" style={pageWidthStyle}>
        <AppIntro />
        <ChartSection />
        <FormPanel />
      </main>
      <p className="mt-auto mb-1 text-center text-[14px] tabular-nums text-white/60">v{appVersion}</p>
    </div>
  );
}
