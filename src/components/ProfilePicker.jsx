import { useEffect, useRef } from "react";

import { ChevronDown, Download, Trash2, Upload, Users } from "lucide-react";

import { TrackBadge } from "@/components/TrackBadge";
import { Button } from "@/components/ui/button";

import { useAppStore } from "@/store/useAppStore";

import { track } from "@/utils/analytics";
import { readFileAsText } from "@/utils/profile-transfer";

export function ProfilePicker() {
  const profiles = useAppStore((s) => s.profiles);
  const open = useAppStore((s) => s.profilePickerOpen);
  const setOpen = useAppStore((s) => s.setProfilePickerOpen);
  const loadProfile = useAppStore((s) => s.loadProfile);
  const removeProfile = useAppStore((s) => s.removeProfile);
  const exportProfiles = useAppStore((s) => s.exportProfiles);
  const importProfiles = useAppStore((s) => s.importProfiles);
  const showToast = useAppStore((s) => s.showToast);
  const rootRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleExport = async () => {
    const { count, outcome } = await exportProfiles();
    if (outcome === "cancelled" || outcome === "empty") {
      return; // user backed out, or nothing to export — stay silent
    }
    if (outcome === "error") {
      showToast("Couldn't save the file", { variant: "error" });
      return;
    }
    // "saved" (file confirmed written) or "started" (download fired, no completion signal).
    track("profiles_exported", { count, outcome });
    showToast(`Exported ${count} profile${count === 1 ? "" : "s"}`, { variant: "success" });
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) {
      return;
    }
    try {
      const text = await readFileAsText(file);
      const added = importProfiles(text);
      track("profiles_imported", { count: added });
      if (added > 0) {
        showToast(`Imported ${added} profile${added === 1 ? "" : "s"}`, { variant: "success" });
      } else {
        showToast("No valid profiles found in file", { variant: "error" });
      }
    } catch {
      showToast("Couldn't read that file", { variant: "error" });
    }
  };

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
  }, [open, setOpen]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen(!open)}
        className="gap-1 pr-1"
      >
        <Users className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Profiles
        <ChevronDown className="h-3.5 w-3.5 opacity-60" />
      </Button>
      {open && (
        <div
          role="menu"
          aria-label="Saved profiles"
          className="absolute right-0 top-[calc(100%+4px)] z-50 max-h-60 w-max max-w-[calc(100vw-2rem)] overflow-auto rounded-lg border border-border bg-card py-1 shadow-md min-[470px]:max-w-[280px]"
        >
          {profiles.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">No saved profiles yet.</p>
          ) : (
            <ul className="m-0 list-none p-0 border-b border-border">
              {profiles.map((pr) => {
                const label = String(pr.title).trim() || "(Untitled)";
                return (
                  <li key={pr.id} className="flex items-stretch hover:bg-muted/60">
                    <button
                      type="button"
                      role="menuitem"
                      className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/60"
                      onClick={() => {
                        loadProfile(pr.id);
                        track("profile_loaded", { track_variant: pr.trackVariant });
                      }}
                    >
                      <span className="min-w-0">{label}</span>
                      <TrackBadge variant={pr.trackVariant} />
                    </button>
                    <button
                      type="button"
                      className="flex w-8 shrink-0 cursor-pointer items-center justify-center text-destructive hover:bg-destructive/10"
                      aria-label={`Remove profile ${label}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeProfile(pr.id);
                        track("profile_deleted", { track_variant: pr.trackVariant });
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="flex items-stretch">
            <button
              type="button"
              role="menuitem"
              disabled={profiles.length === 0}
              className="flex flex-1 cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
              onClick={handleExport}
            >
              <Download className="h-4 w-4 shrink-0" aria-hidden />
              Export
            </button>
            <button
              type="button"
              role="menuitem"
              className="flex flex-1 cursor-pointer items-center gap-2 border-l border-border px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted/60"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4 shrink-0" aria-hidden />
              Import
            </button>
          </div>
          <input ref={fileInputRef} type="file" accept="application/json,.json" className="hidden" onChange={handleImportFile} />
        </div>
      )}
    </div>
  );
}
