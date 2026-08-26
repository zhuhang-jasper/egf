import { CircleCheck, Pencil, Save } from "lucide-react";

// The Save button doubles as the save-status indicator. Each status sets the button's icon, label,
// styling, and disabled state. `saved` means the draft matches a saved profile (nothing to save);
// `renaming` means the linked profile's title was changed, so saving renames it in place;
// `modified` means the linked profile's badge/levels changed but the title still matches, so saving
// overwrites it. For linked statuses the caret offers a copy action ("Save new" while renaming,
// else "Save as copy") plus "Undo rename" while renaming. `new` means saving creates a new profile.
export const SAVE_STATUS_META = {
  saved: {
    icon: CircleCheck,
    label: "Saved",
    title: "Saved — matches a saved profile",
    className: "border-green-600/40 bg-green-50 text-green-700 hover:bg-green-50 hover:text-green-700 disabled:opacity-100",
    disabled: true,
  },
  renaming: {
    icon: Pencil,
    label: "Rename",
    title: "Rename — saving renames the linked profile in place",
    className: "border-amber-500/50 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800",
    disabled: false,
  },
  modified: {
    icon: Save,
    label: "Update",
    title: "Modified — saving overwrites the linked profile",
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
  // A rename that also changed badge/levels. Not a real store status — the toolbar picks it when `renaming`
  // is accompanied by edits (see renameWithEdits), because "Rename" alone understates what the save does.
  applying: {
    icon: Save,
    label: "Apply",
    title: "Renamed and modified — saving applies both to the linked profile",
    className: "border-amber-500/50 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800",
    disabled: false,
  },
};

// SaveButton reserves the widest of these so the control (and the title input beside it) doesn't
// resize when the status changes.
export const SAVE_STATUS_LABELS = Object.values(SAVE_STATUS_META).map((meta) => meta.label);
