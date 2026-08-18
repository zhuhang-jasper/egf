import { useRef, useState } from "react";

import { Download, Trash2, Upload, Wrench } from "lucide-react";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { MenuItem } from "@/components/ui/menu-item";
import { MenuPanel } from "@/components/ui/menu-panel";
import { Tooltip } from "@/components/ui/Tooltip";

import { useMenuPosition } from "@/hooks/useMenuPosition";

import { PROFILE_IO_TOAST_KEY, UNDO_TOAST_KEY, useAppStore } from "@/store/useAppStore";

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
  // "Delete all" opens a confirm dialog (see ConfirmDialog) rather than an inline two-step.
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  const hasProfiles = profiles.length > 0;
  // `hasProfiles` gates the Delete-all row, so it changes the panel's height and must re-measure.
  const { openUp } = useMenuPosition({ open, onClose: () => setOpen(false), rootRef, menuRef, remeasureKey: hasProfiles });

  const handleExport = async () => {
    const { count, outcome } = await exportProfiles();
    setOpen(false);
    if (outcome === "cancelled" || outcome === "empty") {
      return; // user backed out, or nothing to export — stay silent
    }
    if (outcome === "error") {
      showToast("Couldn't save the file", { variant: "error", key: PROFILE_IO_TOAST_KEY });
      return;
    }
    track("profiles_exported", { count, outcome });
    // ONLY "saved" IS TOASTED. "started" means the anchor-download fallback fired (no
    // `showSaveFilePicker` — iOS Safari is the case that matters), and that returns before the platform
    // has even shown its save sheet: we cannot tell a save from a dismissal, and the toast claimed one
    // either way. Where the outcome is unobservable the platform is already reporting it correctly, so
    // say nothing rather than guess. The picker path ("saved") awaits the real write, so it still speaks.
    if (outcome === "saved") {
      showToast(`Exported ${count} profile${count === 1 ? "" : "s"}`, { variant: "success", key: PROFILE_IO_TOAST_KEY });
    }
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
        // A failed import has no Undo, so it takes the file-IO key rather than the undo slot.
        showToast("No valid profiles found in file", { variant: "error", key: PROFILE_IO_TOAST_KEY });
      }
    } catch {
      showToast("Couldn't read that file", { variant: "error", key: PROFILE_IO_TOAST_KEY });
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
        <MenuPanel ref={menuRef} openUp={openUp} align="right" role="menu" aria-label="Profile actions" className="min-w-[100px]">
          <MenuItem icon={Upload} disabled={!hasProfiles} onClick={handleExport}>
            Export profiles
          </MenuItem>
          <MenuItem icon={Download} divided onClick={() => fileInputRef.current?.click()}>
            Import profiles
          </MenuItem>
          {hasProfiles && (
            <MenuItem icon={Trash2} divided destructive onClick={handleDeleteAll}>
              Delete all profiles
            </MenuItem>
          )}
          <input ref={fileInputRef} type="file" accept="application/json,.json" className="hidden" onChange={handleImportFile} />
        </MenuPanel>
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
