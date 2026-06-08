import { AppIntro } from "@/components/AppIntro";
import { ChartSection } from "@/components/ChartSection";
import { FormPanel } from "@/components/FormPanel";

import { FE_UI } from "@/lib/constants";

export default function App() {
  return (
    <div className="flex min-h-dvh flex-col items-center gap-4 p-3">
      <div
        className="w-full"
        style={{
          maxWidth: FE_UI.page.maxWidthPx,
          minWidth: FE_UI.page.minWidthPx,
        }}
      >
        <AppIntro />
      </div>
      <main
        className="grid w-full grid-cols-1 items-stretch rounded-[14px] border border-[#e8e8e8] bg-white p-3 pb-4 shadow-sm"
        style={{
          maxWidth: FE_UI.page.maxWidthPx,
          minWidth: FE_UI.page.minWidthPx,
        }}
      >
        <ChartSection />
        <FormPanel />
      </main>
    </div>
  );
}
