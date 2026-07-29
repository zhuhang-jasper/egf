import { ChartSection } from "@/components/ChartSection";
import { FormPanel } from "@/components/FormPanel";

export function ToolContent({ isVisible, onOpenPillarInMatrix }) {
  return (
    <div>
      <ChartSection isVisible={isVisible} />
      <FormPanel onOpenPillarInMatrix={onOpenPillarInMatrix} />
    </div>
  );
}
