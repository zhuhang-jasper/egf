import { PillarCluster } from "@/components/PillarCluster";
import { TitleToolbar } from "@/components/TitleToolbar";

import { PILLAR_GROUPS } from "@/lib/constants";

export function FormPanel() {
  return (
    <aside className="relative z-10 w-full min-w-0 border-t border-border pt-3">
      <TitleToolbar />
      <div id="competencyInputs" className="mt-4 flex flex-col gap-3">
        {PILLAR_GROUPS.map((group) => (
          <PillarCluster key={group.id} group={group} />
        ))}
      </div>
    </aside>
  );
}
