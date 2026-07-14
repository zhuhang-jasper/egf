import { useEffect } from "react";

import { CircleCheck, Plus, RotateCcw, Save, X } from "lucide-react";

import { BadgePicker } from "@/components/BadgePicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { useTouchPrimary } from "@/hooks/useTouchPrimary";

import { selectProfileSaveStatus, useAppStore } from "@/store/useAppStore";

import { cn } from "@/utils";
import { track } from "@/utils/analytics";

// The Save button doubles as the save-status indicator. Each status sets the button's icon, label,
// styling, and disabled state. `saved` means the draft matches a saved profile (nothing to save);
// `modified` means a same-named profile exists with different values, so saving will overwrite it;
// `new` means saving will create a new profile.
const SAVE_STATUS_META = {
  saved: {
    icon: CircleCheck,
    label: "Saved",
    title: "Saved — matches a saved profile",
    className: "border-green-600/40 bg-green-50 text-green-700 hover:bg-green-50 hover:text-green-700 disabled:opacity-100",
    disabled: true,
  },
  modified: {
    icon: Save,
    label: "Update",
    title: "Modified — saving will overwrite the matching profile",
    className: "border-amber-500/50 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800",
    disabled: false,
  },
  new: {
    icon: Save,
    label: "Save",
    title: "Unsaved — saving will create a new profile",
    className: "",
    disabled: false,
  },
};

// Longest button label — used as an invisible sizer so the Save button reserves a stable width and
// the title input never shifts as the status changes. Derived so it stays correct if edited.
const WIDEST_STATUS_LABEL = Object.values(SAVE_STATUS_META).reduce((a, b) => (b.label.length > a.length ? b.label : a), "");

export function TitleToolbar() {
  const title = useAppStore((s) => s.title);
  const setTitle = useAppStore((s) => s.setTitle);
  const saveProfile = useAppStore((s) => s.saveProfile);
  const saveFeedback = useAppStore((s) => s.saveFeedback);
  const clearSaveFeedback = useAppStore((s) => s.clearSaveFeedback);
  const createNew = useAppStore((s) => s.createNew);
  const resetLevels = useAppStore((s) => s.resetLevels);
  const touchPrimary = useTouchPrimary();
  const saveStatus = useAppStore(selectProfileSaveStatus); // "saved" | "modified" | "new"
  const statusMeta = SAVE_STATUS_META[saveStatus];
  const StatusIcon = statusMeta.icon;

  // Auto-clear transient save feedback (e.g. the empty-title error border) after a short delay.
  useEffect(() => {
    if (!saveFeedback) {
      return undefined;
    }
    const t = setTimeout(clearSaveFeedback, 1400);
    return () => clearTimeout(t);
  }, [saveFeedback, clearSaveFeedback]);

  // A save attempt with no title flags the input with a red error border (auto-cleared above).
  const titleError = saveFeedback === "add-title";
  const showClear = title.length > 0;

  return (
    <div className="flex w-full flex-col gap-2">
      {/* Row 1 — title, status-aware save */}
      <div className="flex w-full min-w-0 items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <BadgePicker />
          <Input
            id="chart-title-input"
            value={title}
            placeholder="Enter a name"
            aria-invalid={titleError}
            onChange={(e) => setTitle(e.target.value)}
            className={cn("pl-16 pr-9 shadow-none", titleError && "border-red-500 focus-visible:ring-red-500/40")}
          />
          <button
            type="button"
            aria-label="Clear chart title"
            title="Clear title"
            hidden={!showClear}
            onClick={() => {
              setTitle("");
              document.getElementById("chart-title-input")?.focus();
            }}
            className={cn(
              "absolute right-0 top-0 flex h-full w-7 items-center justify-center text-muted-foreground hover:text-foreground",
              !showClear && "pointer-events-none opacity-0",
            )}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          shape="pill"
          disabled={statusMeta.disabled}
          className={cn("shrink-0 gap-1.5", statusMeta.className)}
          onClick={() => {
            if (saveProfile() !== false) {
              track("profile_saved", { attached_badge: useAppStore.getState().attachedBadge });
            }
          }}
          aria-label={statusMeta.title}
          title={statusMeta.title}
        >
          <StatusIcon className="h-4 w-4 shrink-0" aria-hidden />
          {/* Label sized to the widest status via an invisible sizer so the title input never
              shifts as the status changes between "Save"/"Saved". */}
          <span className="relative inline-grid">
            <span aria-hidden className="invisible col-start-1 row-start-1 whitespace-nowrap">
              {WIDEST_STATUS_LABEL}
            </span>
            <span className="col-start-1 row-start-1 text-left">{statusMeta.label}</span>
          </span>
        </Button>
      </div>
      {/* Row 2 — create, reset (Profiles now lives in the chart toolbar row above the chart) */}
      <div className="flex w-full items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          shape="pill"
          className="gap-1.5"
          onClick={() => {
            createNew();
            document.getElementById("chart-title-input")?.focus();
          }}
          aria-label="Create new chart"
          title="Create new chart"
        >
          <Plus className="h-4 w-4" />
          New
        </Button>
        {/* Reset lives here on desktop (right of New). On touch it moves down next to the
            keyboard switch — see FormControlsRow — so it sits by the inputs it acts on. */}
        {touchPrimary ? null : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            shape="pill"
            className="gap-1.5"
            onClick={resetLevels}
            aria-label="Reset all levels to 3"
            title="Reset all levels to 3"
          >
            <RotateCcw className="h-4 w-4" />
            Reset levels
          </Button>
        )}
      </div>
    </div>
  );
}
