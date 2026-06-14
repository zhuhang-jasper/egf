import { useEffect, useState } from "react";

import { Keyboard, Plus, RotateCcw, Save, X } from "lucide-react";

import { ProfilePicker } from "@/components/ProfilePicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { useTouchPrimary } from "@/hooks/useTouchPrimary";
import { cn } from "@/lib/utils";

import { useAppStore } from "@/store/useAppStore";

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
  const [saveLabel, setSaveLabel] = useState("Save");

  useEffect(() => {
    if (!saveFeedback) {
      return;
    }
    if (saveFeedback === "saved") {
      setSaveLabel("Saved");
    } else if (saveFeedback === "add-title") {
      setSaveLabel("Add title");
    }
    const t = setTimeout(() => {
      setSaveLabel("Save");
      clearSaveFeedback();
    }, 1400);
    return () => clearTimeout(t);
  }, [saveFeedback, clearSaveFeedback]);

  const showClear = title.length > 0;

  return (
    <div className="flex w-full flex-col gap-2 min-[450px]:flex-row min-[450px]:items-center min-[450px]:gap-2">
      <div className="flex w-full min-w-0 items-center gap-2 min-[450px]:contents">
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
        <div className="relative min-w-0 flex-1 min-[450px]:flex-[0_1_50%] min-[450px]:basis-[50%]">
          <Input
            id="chart-title-input"
            value={title}
            placeholder="Chart title"
            onChange={(e) => setTitle(e.target.value)}
            className="pr-9 shadow-none"
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
          size="icon"
          className="shrink-0"
          onClick={() => saveProfile()}
          aria-label={saveLabel}
          title={saveLabel}
        >
          <Save className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex w-full items-center gap-2 min-[450px]:ml-auto min-[450px]:w-auto">
        <div className="flex items-center gap-2 min-[450px]:hidden">
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
            Reset
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
        </div>
        <div className="ml-auto min-[450px]:ml-0">
          <ProfilePicker />
        </div>
        {touchPrimary ? (
          <Button
            type="button"
            variant={levelKeyboardInputEnabled ? "default" : "outline"}
            size="sm"
            className="hidden gap-1.5 min-[450px]:inline-flex"
            onClick={toggleLevelKeyboardInputEnabled}
            aria-label={levelKeyboardInputEnabled ? "Keyboard on — tap to turn off" : "Keyboard off — tap to turn on"}
            aria-pressed={levelKeyboardInputEnabled}
            title={levelKeyboardInputEnabled ? "KB on" : "KB off"}
          >
            <Keyboard className="h-4 w-4" />
            {levelKeyboardInputEnabled ? "KB on" : "KB off"}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="hidden gap-1.5 min-[450px]:ml-auto min-[450px]:inline-flex"
          onClick={resetLevels}
          aria-label="Reset pillars to default values"
          title="Reset pillars to default values"
        >
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
      </div>
    </div>
  );
}
