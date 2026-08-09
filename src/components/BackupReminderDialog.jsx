import { useRef } from "react";

import { GlobeX, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SimpleModal } from "@/components/ui/Modal";

/**
 * "Your profiles live in this browser" notice, shown at the milestones in constants/storage.js. The only
 * place the app says there is no server, at the moment the user first has something to lose.
 *
 * Informational with NO export button on purpose: naming the path (Manage → Export) teaches where backup
 * lives every future time, where a shortcut would do it once and leave the user still not knowing.
 *
 * The crossed-out globe means "not on the network", which is the subject; a disk glyph would picture the
 * remedy instead of the thing being announced. Shell from {@link SimpleModal}.
 */
export function BackupReminderDialog({ open, onClose }) {
  const closeButtonRef = useRef(null);

  return (
    <SimpleModal
      open={open}
      title="Saved on this device only"
      icon={GlobeX}
      onClose={onClose}
      initialFocusRef={closeButtonRef}
      titleId="backup-reminder-title"
      descriptionId="backup-reminder-desc"
      actions={
        /* Filled (`default` = the theme's near-black), being the dialog's only action and the one the
           focus ring already sits on. */
        <Button ref={closeButtonRef} type="button" variant="default" shape="pill" className="justify-center" onClick={onClose}>
          Got it
        </Button>
      }
    >
      {/* "WILL NOT FOLLOW YOU", NOT "WILL LOSE THEM", and the distinction is the whole sentence.
          Opening the app on another device destroys nothing — the profiles sit here untouched and
          are back the moment this browser is — so loss language there is false, and false in the
          direction that panics. Only the last sentence describes actual deletion, which is why it
          is the only one allowed to say "delete". */}
      <p id="backup-reminder-desc" className="text-sm leading-snug text-slate-600">
        Your profiles are stored in this browser, not on a server. They will not follow you to another browser or device. Clearing your browser data
        will delete them.
      </p>
      {/* The Manage control is an unlabelled wrench icon button, so naming it is not enough to find
          it — the same icon is drawn inline here (mirrored to match) so the sentence points at
          something the user can recognise on the toolbar. */}
      <p className="text-sm leading-snug text-slate-600">
        To keep a backup, open{" "}
        <span className="inline-flex translate-y-0.5 items-center gap-1 font-semibold text-slate-900">
          <Wrench className="size-3.5 -scale-x-100" aria-hidden />
          Manage
        </span>{" "}
        below the chart form and choose <span className="font-semibold text-slate-900">Export profiles</span> to save them all to a file. You can
        import that file again any time.
      </p>
    </SimpleModal>
  );
}
