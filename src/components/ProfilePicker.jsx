import { useEffect, useRef } from "react";

import { ChevronDown, Trash2 } from "lucide-react";

import { TrackBadge } from "@/components/TrackBadge";
import { Button } from "@/components/ui/button";

import { useAppStore } from "@/store/useAppStore";

export function ProfilePicker() {
  const profiles = useAppStore((s) => s.profiles);
  const open = useAppStore((s) => s.profilePickerOpen);
  const setOpen = useAppStore((s) => s.setProfilePickerOpen);
  const loadProfile = useAppStore((s) => s.loadProfile);
  const removeProfile = useAppStore((s) => s.removeProfile);
  const rootRef = useRef(null);

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
      <Button type="button" variant="outline" size="sm" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen(!open)} className="gap-1">
        Profiles
        <ChevronDown className="h-3.5 w-3.5 opacity-60" />
      </Button>
      {open && (
        <div
          role="menu"
          aria-label="Saved profiles"
          className="absolute left-0 top-[calc(100%+4px)] z-50 max-h-60 w-max max-w-[calc(100vw-2rem)] overflow-auto rounded-lg border border-border bg-card py-1 shadow-md sm:left-auto sm:right-0 sm:max-w-[280px]"
        >
          {profiles.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">No saved profiles yet.</p>
          ) : (
            <ul className="m-0 list-none p-0">
              {profiles.map((pr) => {
                const label = String(pr.title).trim() || "(Untitled)";
                return (
                  <li key={pr.id} className="flex items-stretch hover:bg-muted/60">
                    <button
                      type="button"
                      role="menuitem"
                      className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/60"
                      onClick={() => loadProfile(pr.id)}
                    >
                      <span className="min-w-0">{label}</span>
                      <TrackBadge variant={pr.trackVariant} />
                    </button>
                    <button
                      type="button"
                      className="flex w-8 shrink-0 items-center justify-center text-destructive hover:bg-destructive/10"
                      aria-label={`Remove profile ${label}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeProfile(pr.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
