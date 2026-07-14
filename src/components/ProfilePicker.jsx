import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { ChevronDown, Download, Trash2, Upload, Users } from "lucide-react";

import { TrackBadge } from "@/components/TrackBadge";
import { Button } from "@/components/ui/button";

import { useAppStore } from "@/store/useAppStore";

import { cn } from "@/utils";
import { track } from "@/utils/analytics";
import { readFileAsText } from "@/utils/profile-transfer";

// Rows shown before the list scrolls; the trailing ".5" leaves the next row half-visible so users
// can tell there's more below (the standard "peek" scroll affordance).
const VISIBLE_ROWS = 9.5;

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
  const menuRef = useRef(null);
  const listRef = useRef(null);
  const footerRef = useRef(null);
  const [openUp, setOpenUp] = useState(false);
  // Max height (px) for the scrollable profile list. Capped at whichever is smaller: ~9.5 rows (so a
  // 10th row peeks to signal there's more, the standard scroll affordance) or the viewport space on
  // the side the menu opens toward. Null = no cap (short lists size to content). The footer stays
  // outside this, always fully visible.
  const [listMaxHeight, setListMaxHeight] = useState(null);

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

  // Position the menu on open (and on resize while open): pick the side with more room, flipping up
  // only when below is too tight, then cap the scrollable list to ~9.5 rows (or the viewport space,
  // whichever is smaller) so the 10th row peeks and the footer stays fully visible.
  useLayoutEffect(() => {
    if (!open) {
      setOpenUp(false);
      setListMaxHeight(null);
      return;
    }
    const decide = () => {
      const button = rootRef.current;
      const menu = menuRef.current;
      if (!button || !menu) {
        return;
      }
      const buttonRect = button.getBoundingClientRect();
      // Measure the menu's natural (uncapped) height so the flip decision isn't skewed by a cap we
      // set on a previous pass.
      const naturalHeight = menu.scrollHeight;
      const gap = 4;
      const margin = 8; // keep the menu clear of the viewport edge
      // When opening upward the menu must not rise above the sticky tab bar (it renders below the
      // header in the stacking order, so any overflow past the header just gets clipped/covered).
      // Use the header's live bottom edge as the top boundary instead of the raw viewport top.
      const tabBar = document.getElementById("app-shell-tab-bar");
      const topBoundary = tabBar ? Math.max(0, tabBar.getBoundingClientRect().bottom) : 0;
      const spaceBelow = window.innerHeight - buttonRect.bottom - gap - margin;
      const spaceAbove = buttonRect.top - topBoundary - gap - margin;
      // Prefer down; flip up only when the menu won't fit below but there's more room above.
      const up = naturalHeight > spaceBelow && spaceAbove > spaceBelow;
      const availableMenu = Math.floor(up ? spaceAbove : spaceBelow);
      setOpenUp(up);

      // Cap the scrollable list. Two limits, take the smaller: (a) ~9.5 rows so the next row peeks,
      // (b) whatever vertical space is left for the list after the footer, within `availableMenu`.
      const list = listRef.current;
      const footer = footerRef.current;
      if (!list) {
        setListMaxHeight(null);
        return;
      }
      const firstRow = list.firstElementChild;
      const rowH = firstRow ? firstRow.getBoundingClientRect().height : 0;
      const footerH = footer ? footer.getBoundingClientRect().height : 0;
      // List box padding (py-1) + its bottom border, so the peek math targets the content area.
      const listChrome = list.offsetHeight - list.clientHeight + 8;
      const nineHalf = rowH > 0 ? Math.round(VISIBLE_ROWS * rowH + listChrome) : Infinity;
      const availableForList = Math.floor(availableMenu - footerH);
      const listCap = Math.min(nineHalf, availableForList);
      // Only cap when the natural list would overflow it; otherwise let it size to content.
      const naturalListH = list.scrollHeight;
      setListMaxHeight(naturalListH <= listCap ? null : Math.max(0, listCap));
    };
    decide();
    window.addEventListener("resize", decide);
    return () => window.removeEventListener("resize", decide);
  }, [open, profiles.length]);

  // Redirect wheel events anywhere over the menu (including the non-scrollable Export/Import footer)
  // to the inner profile list, and swallow them so the page behind never scrolls. Uses a native
  // non-passive listener because React's synthetic onWheel is passive — preventDefault() there is a
  // no-op and the page would still scroll.
  useEffect(() => {
    const menu = menuRef.current;
    if (!open || !menu) {
      return undefined;
    }
    const onWheel = (e) => {
      const list = listRef.current;
      if (list) {
        list.scrollTop += e.deltaY;
      }
      e.preventDefault();
    };
    menu.addEventListener("wheel", onWheel, { passive: false });
    return () => menu.removeEventListener("wheel", onWheel);
  }, [open]);

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
          ref={menuRef}
          role="menu"
          aria-label="Saved profiles"
          className={cn(
            "absolute right-0 z-30 flex w-max max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-lg border border-border bg-card shadow-md min-[470px]:max-w-[280px]",
            openUp ? "bottom-[calc(100%+4px)]" : "top-[calc(100%+4px)]",
          )}
        >
          {profiles.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">No saved profiles yet.</p>
          ) : (
            <ul
              ref={listRef}
              className="m-0 min-h-0 flex-1 list-none overflow-auto border-b border-border p-0 py-1"
              // Cap to ~9.5 rows (or viewport space); null lets a short list size to content.
              style={{ maxHeight: listMaxHeight != null ? `${listMaxHeight}px` : undefined }}
            >
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
                        track("profile_loaded", { attached_badge: pr.attachedBadge });
                      }}
                    >
                      <TrackBadge variant={pr.attachedBadge} />
                      <span className="min-w-0">{label}</span>
                    </button>
                    <button
                      type="button"
                      className="flex w-8 shrink-0 cursor-pointer items-center justify-center text-destructive hover:bg-destructive/10"
                      aria-label={`Remove profile ${label}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeProfile(pr.id);
                        track("profile_deleted", { attached_badge: pr.attachedBadge });
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <div ref={footerRef} className="flex shrink-0 items-stretch">
            <button
              type="button"
              role="menuitem"
              disabled={profiles.length === 0}
              className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 px-3 py-2 text-xs text-muted-foreground hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
              onClick={handleExport}
            >
              <Download className="h-4 w-4 shrink-0" aria-hidden />
              Export
            </button>
            <button
              type="button"
              role="menuitem"
              className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 border-l border-border px-3 py-2 text-xs text-muted-foreground hover:bg-muted/60"
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
