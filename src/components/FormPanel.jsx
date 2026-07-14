import { FormControlsRow } from "@/components/FormControlsRow";
import { PillarCluster } from "@/components/PillarCluster";
import { TitleToolbar } from "@/components/TitleToolbar";

import { getPillarGroups } from "@/constants";

export function FormPanel({ onOpenPillarInMatrix }) {
  return (
    <aside className="relative z-10 w-full min-w-0 border-t border-border pt-3 mt-3">
      <TitleToolbar />
      <FormControlsRow />
      <div id="competencyInputs" className="mt-2 flex flex-col gap-3">
        {getPillarGroups().map((group) => (
          <PillarCluster key={group.id} group={group} onOpenPillarInMatrix={onOpenPillarInMatrix} />
        ))}
      </div>
    </aside>
  );
}
