import { useEffect, useState } from "react";

import { RotateCcw, Save, X } from "lucide-react";

import { ProfilePicker } from "@/components/ProfilePicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { cn } from "@/lib/utils";

import { useAppStore } from "@/store/useAppStore";

export function TitleToolbar() {
  const title = useAppStore((s) => s.title);
  const setTitle = useAppStore((s) => s.setTitle);
  const saveProfile = useAppStore((s) => s.saveProfile);
  const saveFeedback = useAppStore((s) => s.saveFeedback);
  const clearSaveFeedback = useAppStore((s) => s.clearSaveFeedback);
  const resetLevels = useAppStore((s) => s.resetLevels);
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
    <div className="flex w-full flex-wrap items-center gap-2">
      <div className="relative min-w-0 flex-[0_1_50%] basis-[50%]">
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
      <Button type="button" variant="outline" size="icon" onClick={() => saveProfile()} aria-label={saveLabel} title={saveLabel}>
        <Save className="h-4 w-4" />
      </Button>
      <ProfilePicker />
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="ml-auto"
        onClick={resetLevels}
        aria-label="Reset pillars to default values"
        title="Reset pillars to default values"
      >
        <RotateCcw className="h-4 w-4" />
      </Button>
    </div>
  );
}
