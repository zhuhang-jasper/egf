import { PillarCluster } from "@/components/PillarCluster";
import { TitleToolbar } from "@/components/TitleToolbar";

import { useAppStore } from "@/store/useAppStore";

import { getPillarGroups } from "@/constants";

export function FormPanel() {
  const trackVariant = useAppStore((s) => s.trackVariant);

  return (
    <aside className="relative z-10 w-full min-w-0 border-t border-border pt-3 mt-3">
      <TitleToolbar />
      <div id="competencyInputs" className="mt-4 flex flex-col gap-3">
        {getPillarGroups(trackVariant).map((group) => (
          <PillarCluster key={group.id} group={group} />
        ))}
      </div>
    </aside>
  );
}
