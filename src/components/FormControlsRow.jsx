import { Keyboard, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

import { useTouchPrimary } from "@/hooks/useTouchPrimary";

import { useAppStore } from "@/store/useAppStore";

import { cn } from "@/utils";

// Touch-only row of level controls, rendered just above the pillar inputs they act on: the numeric
// keyboard switch and Reset. On desktop this returns null (Reset lives in TitleToolbar's Row 2 and
// the keyboard switch is touch-only), so the wrapper contributes no footprint. Both controls share
// the LatestChangesToggle mini-switch height so they read as a matched pair.
export function FormControlsRow() {
  const resetLevels = useAppStore((s) => s.resetLevels);
  const levelKeyboardInputEnabled = useAppStore((s) => s.levelKeyboardInputEnabled);
  const toggleLevelKeyboardInputEnabled = useAppStore((s) => s.toggleLevelKeyboardInputEnabled);
  const touchPrimary = useTouchPrimary();

  if (!touchPrimary) {
    return null;
  }

  return (
    <div className="mt-2 flex items-center justify-end gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={levelKeyboardInputEnabled}
        onClick={toggleLevelKeyboardInputEnabled}
        className="group inline-flex h-[26.5px] shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-slate-300 bg-white pl-2.5 pr-1.5 text-[11px] font-semibold tracking-wide text-slate-600 hover:bg-slate-50 hover:text-slate-800 sm:text-[12px]"
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
      <Button
        type="button"
        variant="outline"
        size="sm"
        shape="pill"
        className="h-[26.5px] gap-1.5 text-[11px] font-regular tracking-wide sm:text-[12px]"
        onClick={resetLevels}
        aria-label="Reset all levels to 3"
        title="Reset all levels to 3"
      >
        <RotateCcw className="h-4 w-4" />
        Reset levels
      </Button>
    </div>
  );
}
