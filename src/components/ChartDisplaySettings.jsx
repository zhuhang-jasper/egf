import { useEffect, useRef, useState } from "react";

import { Settings } from "lucide-react";

import { Button } from "@/components/ui/button";

import { syncLevelDatasetsVisibility } from "@/lib/chart/dataset-visibility";

import { useAppStore } from "@/store/useAppStore";

function SettingsCheckbox({ label, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-1.5 text-sm hover:bg-muted/60">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-3.5 shrink-0 rounded border border-input accent-foreground"
      />
      <span>{label}</span>
    </label>
  );
}

export function ChartDisplaySettings({ chartRef }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const chartLegendHidden = useAppStore((s) => s.chartLegendHidden);
  const setChartLegendHidden = useAppStore((s) => s.setChartLegendHidden);
  const levelsPolygonHidden = useAppStore((s) => s.levelsPolygonHidden);
  const setLevelsPolygonHidden = useAppStore((s) => s.setLevelsPolygonHidden);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    const onMouse = (e) => {
      if (open && rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onMouse);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onMouse);
    };
  }, [open]);

  const setLegendVisible = (visible) => {
    setChartLegendHidden(!visible);
  };

  const setChartDataVisible = (visible) => {
    const hidden = !visible;
    const chart = chartRef?.current;
    if (chart && syncLevelDatasetsVisibility(chart, hidden)) {
      chart.update("none");
    }
    setLevelsPolygonHidden(hidden);
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Chart display settings"
        title="Chart display settings"
        onClick={() => setOpen(!open)}
      >
        <Settings className="h-4 w-4" />
      </Button>
      {open ? (
        <div
          role="menu"
          aria-label="Chart display settings"
          className="absolute right-0 top-[calc(100%+4px)] z-50 min-w-[10.5rem] rounded-lg border border-border bg-card py-1 shadow-md"
        >
          <SettingsCheckbox label="Legend" checked={!chartLegendHidden} onChange={setLegendVisible} />
          <SettingsCheckbox label="Chart" checked={!levelsPolygonHidden} onChange={setChartDataVisible} />
        </div>
      ) : null}
    </div>
  );
}
