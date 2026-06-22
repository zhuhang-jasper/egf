import { useEffect } from "react";

import { CircleCheck, CircleDashed, CircleDot, Keyboard, Plus, RotateCcw, Save, X } from "lucide-react";

import { ProfilePicker } from "@/components/ProfilePicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { useTouchPrimary } from "@/hooks/useTouchPrimary";

import { selectProfileSaveStatus, useAppStore } from "@/store/useAppStore";

import { cn } from "@/utils";

// Icon + tooltip per profile save status. `modified` means a same-named profile exists with
// different values, so saving will overwrite it.
const SAVE_STATUS_META = {
  saved: { icon: CircleCheck, color: "text-green-600", label: "Saved", title: "Saved — matches a saved profile" },
  modified: { icon: CircleDot, color: "text-amber-500", label: "Modified", title: "Modified — saving will overwrite the matching profile" },
  new: { icon: CircleDashed, color: "text-muted-foreground", label: "Not saved", title: "Not saved — saving will create a new profile" },
};

export function TitleToolbar() {
  const title = useAppStore((s) => s.title);
  const setTitle = useAppStore((s) => s.setTitle);
  const saveProfile = useAppStore((s) => s.saveProfile);
  const saveFeedback = useAppStore((s) => s.saveFeedback);
  const clearSaveFeedback = useAppStore((s) => s.clearSaveFeedback);
  const resetLevels = useAppStore((s) => s.resetLevels);
  const createNew = useAppStore((s) => s.createNew);
  const levelKeyboardInputEnabled = useAppStore((s) => s.levelKeyboardInputEnabled);
  const toggleLevelKeyboardInputEnabled = useAppStore((s) => s.toggleLevelKeyboardInputEnabled);
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
      {/* Row 1 — create, title, save */}
      <div className="flex w-full min-w-0 items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0"
          onClick={() => {
            createNew();
            document.getElementById("chart-title-input")?.focus();
          }}
          aria-label="Create new chart"
          title="Create new chart"
        >
          <Plus className="h-4 w-4" />
        </Button>
        <div className="relative min-w-0 flex-1">
          <Input
            id="chart-title-input"
            value={title}
            placeholder="Enter a name"
            aria-invalid={titleError}
            onChange={(e) => setTitle(e.target.value)}
            className={cn("pr-9 shadow-none", titleError && "border-red-500 focus-visible:ring-red-500/40")}
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
        <span className={cn("flex w-[5.5rem] shrink-0 items-center gap-1.5", statusMeta.color)}>
          <StatusIcon className="h-4 w-4 shrink-0" aria-hidden />
          <span className="truncate text-xs italic text-muted-foreground">{statusMeta.label}</span>
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="-ml-1 shrink-0 gap-1.5"
          onClick={() => saveProfile()}
          aria-label="Save"
          title="Save"
        >
          <Save className="h-4 w-4 shrink-0" />
        </Button>
      </div>
      {/* Row 2 — reset, keyboard toggle, profiles */}
      <div className="flex w-full items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={resetLevels}
          aria-label="Reset pillars to default values"
          title="Reset pillars to default values"
        >
          <RotateCcw className="h-4 w-4" />
          Reset values
        </Button>
        {touchPrimary ? (
          <Button
            type="button"
            variant={levelKeyboardInputEnabled ? "default" : "outline"}
            size="sm"
            className="gap-1.5"
            onClick={toggleLevelKeyboardInputEnabled}
            aria-label={levelKeyboardInputEnabled ? "Keyboard on — tap to turn off" : "Keyboard off — tap to turn on"}
            aria-pressed={levelKeyboardInputEnabled}
            title={levelKeyboardInputEnabled ? "KB on" : "KB off"}
          >
            <Keyboard className="h-4 w-4" />
            {levelKeyboardInputEnabled ? "KB on" : "KB off"}
          </Button>
        ) : null}
        <div className="ml-auto">
          <ProfilePicker />
        </div>
      </div>
    </div>
  );
}
