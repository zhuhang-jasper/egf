import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { Download, Trash2, Upload, Wrench } from "lucide-react";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/Tooltip";

import { UNDO_TOAST_KEY, useAppStore } from "@/store/useAppStore";

import { cn } from "@/utils";
import { track } from "@/utils/analytics";
import { readFileAsText } from "@/utils/profile-transfer";

/**
 * Overflow menu (kebab) sitting next to the Profiles picker. Holds list-level actions —
 * Export / Import / Clear all — that operate on the whole saved-profile collection.
 */
export function ProfileActionsMenu() {
  const profiles = useAppStore((s) => s.profiles);
  const exportProfiles = useAppStore((s) => s.exportProfiles);
  const importProfiles = useAppStore((s) => s.importProfiles);
  const removeProfilesByIds = useAppStore((s) => s.removeProfilesByIds);
  const clearAllProfiles = useAppStore((s) => s.clearAllProfiles);
  const showToast = useAppStore((s) => s.showToast);
  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const fileInputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  // "Delete all" opens a confirm dialog (see ConfirmDialog) rather than an inline two-step.
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  const hasProfiles = profiles.length > 0;

  const handleExport = async () => {
    const { count, outcome } = await exportProfiles();
    setOpen(false);
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
    setOpen(false);
    try {
      const text = await readFileAsText(file);
      const { added, addedIds } = importProfiles(text);
      track("profiles_imported", { count: added });
      if (added > 0) {
        showToast(`Imported ${added} profile${added === 1 ? "" : "s"}`, {
          variant: "success",
          duration: 10000,
          key: UNDO_TOAST_KEY, // only one Undo toast at a time — replaces any live delete/discard undo
          action: {
            label: "Undo",
            onAction: () => {
              removeProfilesByIds(addedIds);
              track("profiles_import_undone", { count: added });
            },
          },
        });
      } else {
        showToast("No valid profiles found in file", { variant: "error" });
      }
    } catch {
      showToast("Couldn't read that file", { variant: "error" });
    }
  };

  // Clicking "Delete all" opens the confirm dialog; the actual wipe happens on confirm.
  const handleDeleteAll = () => {
    setConfirmDeleteAll(true);
    setOpen(false);
  };

  const confirmDeleteAllProfiles = () => {
    // clearAllProfiles folds the wipe into the shared delete batch and renders the combined
    // "Deleted N profiles" Undo toast itself (so a preceding single delete + delete-all combine).
    const { removed } = clearAllProfiles();
    setConfirmDeleteAll(false);
    track("profiles_cleared", { count: removed });
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
  }, [open]);

  // Flip the menu upward only when there isn't room below but there is above (mirrors ProfilePicker).
  useLayoutEffect(() => {
    if (!open) {
      setOpenUp(false);
      return;
    }
    const button = rootRef.current;
    const menu = menuRef.current;
    if (!button || !menu) {
      return;
    }
    const buttonRect = button.getBoundingClientRect();
    const naturalHeight = menu.scrollHeight;
    const gap = 4;
    const margin = 8;
    const tabBar = document.getElementById("app-shell-tab-bar");
    const topBoundary = tabBar ? Math.max(0, tabBar.getBoundingClientRect().bottom) : 0;
    const spaceBelow = window.innerHeight - buttonRect.bottom - gap - margin;
    const spaceAbove = buttonRect.top - topBoundary - gap - margin;
    setOpenUp(naturalHeight > spaceBelow && spaceAbove > spaceBelow);
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label="Manage profiles — import, export, or delete all"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen(!open)}
        className="group relative px-2"
      >
        <Wrench className="h-4 w-4 shrink-0 -scale-x-100" aria-hidden />
        {open ? null : <Tooltip text="Manage profiles" placement="bottom" />}
      </Button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Profile actions"
          className={cn(
            "absolute right-0 z-30 flex w-max min-w-[100px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-lg border border-border bg-card shadow-md",
            openUp ? "bottom-[calc(100%+4px)]" : "top-[calc(100%+4px)]",
          )}
        >
          <button
            type="button"
            role="menuitem"
            disabled={!hasProfiles}
            className="flex cursor-pointer items-center gap-2 px-3 py-2 text-left text-xs text-foreground hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
            onClick={handleExport}
          >
            <Upload className="h-4 w-4 shrink-0" aria-hidden />
            Export profiles
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex cursor-pointer items-center gap-2 border-t border-border px-3 py-2 text-left text-xs text-foreground hover:bg-muted/60"
            onClick={() => fileInputRef.current?.click()}
          >
            <Download className="h-4 w-4 shrink-0" aria-hidden />
            Import profiles
          </button>
          {hasProfiles && (
            <button
              type="button"
              role="menuitem"
              className="flex cursor-pointer items-center gap-2 border-t border-border px-3 py-2 text-left text-xs text-foreground hover:bg-destructive/10"
              onClick={handleDeleteAll}
            >
              <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
              Delete all profiles
            </button>
          )}
          <input ref={fileInputRef} type="file" accept="application/json,.json" className="hidden" onChange={handleImportFile} />
        </div>
      )}
      <ConfirmDialog
        open={confirmDeleteAll}
        title="Delete all profiles?"
        message={`This deletes all ${profiles.length} saved profile${profiles.length === 1 ? "" : "s"}. You can undo this right after.`}
        confirmLabel="Delete all"
        destructive
        onConfirm={confirmDeleteAllProfiles}
        onCancel={() => setConfirmDeleteAll(false)}
      />
    </div>
  );
}
