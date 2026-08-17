import { PillarCluster } from "@/components/PillarCluster";
import { TitleToolbar } from "@/components/TitleToolbar";

import { getPillarGroups } from "@/constants";

// `relative` with NO z-index on the <aside>: the panel contains the name combobox and Save menu, and a z-index
// here would both trap their dropdowns and (at the `z-10` it used to carry) paint the panel over the chart
// toolbar's open gear menu. See `LAYER` in constants/layers.js.
export function FormPanel({ onOpenPillarInMatrix }) {
  return (
    // `border-slate-300`, not `border-border`: that token is a neutral 90% grey, which was a visible hairline on
    // a white page and is nearly the page's own value now that the base carries a tint. A divider has to be a
    // step DARKER than the surface it divides, so it moves with the base rather than staying an absolute grey.
    <aside className="relative w-full min-w-0 border-t border-slate-300 pt-3 mt-3">
      {/* <h2 className="mb-2 text-sm font-semibold text-slate-900">Build Your Profile</h2> */}
      <TitleToolbar />
      <div className="mt-2 flex flex-col gap-2">
        {getPillarGroups().map((group) => (
          <PillarCluster key={group.id} group={group} onOpenPillarInMatrix={onOpenPillarInMatrix} />
        ))}
      </div>
    </aside>
  );
}
