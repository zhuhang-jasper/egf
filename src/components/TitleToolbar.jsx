import { useEffect } from "react";

import { CircleCheck, Keyboard, RotateCcw, Save, X } from "lucide-react";

import { BadgePicker } from "@/components/BadgePicker";
import { ProfilePicker } from "@/components/ProfilePicker";
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

// Status-aware Save button, sitting on Row 1 next to the title input. Extracted so the invisible
// widest-label sizer (which keeps the row from shifting as the status label changes) lives in one
// place. `className` is a passthrough for optional layout tweaks.
function SaveButton({ statusMeta, onSave, className }) {
  const StatusIcon = statusMeta.icon;
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      shape="pill"
      disabled={statusMeta.disabled}
      className={cn("shrink-0 gap-1.5", statusMeta.className, className)}
      onClick={onSave}
      aria-label={statusMeta.title}
      title={statusMeta.title}
    >
      <StatusIcon className="h-4 w-4 shrink-0" aria-hidden />
      {/* Label sized to the widest status via an invisible sizer so the row layout never
          shifts as the status changes between "Save"/"Saved". */}
      <span className="relative inline-grid">
        <span aria-hidden className="invisible col-start-1 row-start-1 whitespace-nowrap">
          {WIDEST_STATUS_LABEL}
        </span>
        <span className="col-start-1 row-start-1 text-left">{statusMeta.label}</span>
      </span>
    </Button>
  );
}

export function TitleToolbar() {
  const title = useAppStore((s) => s.title);
  const setTitle = useAppStore((s) => s.setTitle);
  const saveProfile = useAppStore((s) => s.saveProfile);
  const saveFeedback = useAppStore((s) => s.saveFeedback);
  const clearSaveFeedback = useAppStore((s) => s.clearSaveFeedback);
  const createNew = useAppStore((s) => s.createNew);
  const levelKeyboardInputEnabled = useAppStore((s) => s.levelKeyboardInputEnabled);
  const toggleLevelKeyboardInputEnabled = useAppStore((s) => s.toggleLevelKeyboardInputEnabled);
  const touchPrimary = useTouchPrimary();
  const saveStatus = useAppStore(selectProfileSaveStatus); // "saved" | "modified" | "new"
  const statusMeta = SAVE_STATUS_META[saveStatus];

  const handleSave = () => {
    if (saveProfile() !== false) {
      track("profile_saved", { attached_badge: useAppStore.getState().attachedBadge });
    }
  };

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
      {/* Row 1 — title + Save (Save lives here permanently now that New/Reset merged into Row 2). */}
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
        <SaveButton statusMeta={statusMeta} onSave={handleSave} />
      </div>
      {/* Row 2 — reset + keypad toggle (touch only) on the left, Profiles on the right. Reset
          doubles as "start over": it clears the title and resets every pillar to the default
          (badge is kept). */}
      <div className="flex w-full items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          shape="pill"
          className="shrink-0 gap-1.5"
          onClick={() => {
            createNew();
            document.getElementById("chart-title-input")?.focus();
          }}
          aria-label="Reset — clear the title and reset all levels"
          title="Reset — clear the title and reset all levels"
        >
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
        {/* Keypad toggle is touch-only — the numeric keyboard switch is meaningless with a
            physical keyboard, so it renders only when touch is the primary input. */}
        {touchPrimary ? (
          <button
            type="button"
            role="switch"
            aria-checked={levelKeyboardInputEnabled}
            onClick={toggleLevelKeyboardInputEnabled}
            className="group inline-flex h-[26.5px] shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-slate-300 bg-white pl-2.5 pr-1.5 text-xs font-semibold tracking-wide text-slate-600 hover:bg-slate-50 hover:text-slate-800"
          >
            <Keyboard className="size-3.5 shrink-0" aria-hidden />
            Keypad
            {/* Mini switch: black track when on, slate when off; knob slides right when on. */}
            <span
              aria-hidden
              className={cn(
                "relative ml-0.5 inline-flex h-4 w-7 shrink-0 rounded-full transition-colors",
                levelKeyboardInputEnabled ? "bg-slate-900" : "bg-slate-300 group-hover:bg-slate-400/70",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 left-0.5 size-3 rounded-full bg-white shadow-sm transition-transform duration-150 ease-out",
                  levelKeyboardInputEnabled && "translate-x-3",
                )}
              />
            </span>
          </button>
        ) : null}
        <div className="ml-auto">
          <ProfilePicker />
        </div>
      </div>
    </div>
  );
}
