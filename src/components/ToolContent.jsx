import { ChartSection } from "@/components/ChartSection";
import { FormPanel } from "@/components/FormPanel";

export function ToolContent({ isVisible }) {
  return (
    <div className="space-y-0">
      <ChartSection isVisible={isVisible} />
      <FormPanel />
    </div>
  );
}
