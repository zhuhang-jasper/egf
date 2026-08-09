import { useRef, useState } from "react";

import { Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimpleModal } from "@/components/ui/Modal";

import { ADMIN_PASSWORD_REQUESTED, unlockAdmin } from "@/constants";
import { track } from "@/utils/analytics";

/**
 * The password question for `?admin=1`, as an in-app form rather than a `window.prompt`, which is the whole
 * point of this file: a native prompt at module-eval blocks the import path, so any context that suppresses
 * modals never boots the app at all. See the note in constants/features.js.
 *
 * Rendered alongside the app rather than instead of it, so a dismissed question leaves a working tool.
 * `unlockAdmin` reloads on success, so there is no success state here and nothing to tell the parent.
 *
 * Shell from {@link SimpleModal}, with three deviations passed as props: the panel is a `form`, the backdrop
 * does not dismiss, and it is not portalled.
 */
export function AdminUnlockPrompt() {
  // Dismissal is local and deliberately not persisted: the question is only asked when `?admin=1` is in
  // the URL, and that param is already stripped by the time this renders, so a reload cannot re-ask it.
  const [dismissed, setDismissed] = useState(false);
  const [password, setPassword] = useState("");
  const [wrong, setWrong] = useState(false);
  // Handed to SimpleModal as `initialFocusRef` rather than left to the field's own `autoFocus`: the
  // dialog focuses something on open regardless, and its fallback is the panel — which would take focus
  // straight back off the input. Naming the field makes the dialog's choice and ours the same one.
  const passwordRef = useRef(null);

  const submit = (event) => {
    event.preventDefault();
    // Two events rather than one with an `outcome` param, because a SUCCESS never gets to report itself:
    // `unlockAdmin` reloads the page, and an event queued on the way out is unlikely to leave the tab.
    // So the attempt is recorded up front (always sends) and only the failure is recorded after — the
    // success count is attempts minus failures. The password is never sent as a param.
    track("admin_unlock_attempt");
    // `unlockAdmin` returning at all means the password was wrong — on success the page reloads.
    const failed = !unlockAdmin(password);
    if (failed) {
      track("admin_unlock_failed");
    }
    setWrong(failed);
  };

  return (
    <SimpleModal
      open={ADMIN_PASSWORD_REQUESTED && !dismissed}
      title="Admin access"
      icon={Lock}
      onClose={() => setDismissed(true)}
      // NOT click-to-dismiss: this appears in response to a deliberate `?admin=1` navigation and the
      // param is already consumed, so a stray tap that threw the question away would mean re-typing the
      // URL to get it back. Cancel is explicit.
      dismissOnBackdrop={false}
      // "dialog", not the default "alertdialog": this asks for input rather than announcing something,
      // and alertdialog is for urgent messages with limited interaction.
      role="dialog"
      // Already rendered from App at the top of the tree, so there is no ancestor stacking context to
      // portal out of.
      portal={false}
      as="form"
      onSubmit={submit}
      initialFocusRef={passwordRef}
      titleId="admin-unlock-title"
      descriptionId="admin-unlock-desc"
      actions={
        <>
          {/* FILLED, WHILE CANCEL STAYS OUTLINE. Two identically-styled pills made the user read both
              labels to find the one that submits; the fill says which is the way forward before the
              text is read. `default` is the theme's near-black — see button-variants.js.

              DISABLED ON AN EMPTY FIELD, AND THAT FLIP IS A FOCUS HAZARD. The button goes from disabled
              to enabled on the first keystroke, and a control whose disabled state changes across a
              re-render is exactly when a browser can drop and re-settle focus — which used to pull the
              caret out of the password field and onto this button as soon as typing began. What made it
              bite was Modal re-running its focus-on-open effect on every render (its deps included an
              inline `onClose`); with that fixed, nothing re-focuses mid-type and the flip is inert.
              Keep `type="submit"` — Enter still submits from the field, so the disabled button never
              becomes the only way forward. */}
          <Button type="submit" variant="default" shape="pill" className="justify-center" disabled={password.trim() === ""}>
            Unlock
          </Button>
          {/* Cancel leaves the app running underneath — see the docblock. */}
          <Button type="button" variant="outline" shape="pill" className="justify-center" onClick={() => setDismissed(true)}>
            Cancel
          </Button>
        </>
      }
    >
      <p id="admin-unlock-desc" className="text-sm leading-snug text-slate-600">
        Enter the password to unlock dev options.
      </p>

      <div className="mt-1.5 flex flex-col gap-1.5">
        {/* Focused on open via `initialFocusRef` above, not `autoFocus`: this field is the only reason
            the overlay exists, and the overlay only appears because someone navigated to `?admin=1` on
            purpose — but the dialog focuses on open either way, so the two have to agree or the last one
            to run wins. */}
        <Input
          ref={passwordRef}
          type="password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setWrong(false);
          }}
          aria-label="Password"
          aria-invalid={wrong}
          autoComplete="current-password"
          className="border-slate-300"
        />
        {/* `role="alert"` so the failure is announced and not only coloured. Rendered only when
            wrong, so the panel does not reserve space for a message that is usually absent. */}
        {wrong ? (
          <p role="alert" className="text-xs text-red-600">
            Incorrect password.
          </p>
        ) : null}
      </div>
    </SimpleModal>
  );
}
