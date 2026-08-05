import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { ADMIN_PASSWORD_REQUESTED, unlockAdmin } from "@/constants";

/**
 * The password question for `?admin=1`, as an in-app form.
 *
 * IT IS NOT A `window.prompt`, AND THAT IS THE WHOLE POINT OF THIS FILE. The unlock was a native prompt
 * called from constants/features.js at module-eval, which blocks the import path — so in any context that
 * suppresses modal dialogs (VS Code's Simple Browser, a sandboxed iframe without `allow-modals`, some
 * in-app webviews) the dialog was never shown, never dismissed, and the app never finished booting: a
 * blank white page. Ordinary UI has no such failure mode; it is just markup that renders after mount.
 *
 * Rendered ALONGSIDE the app rather than instead of it (see App.jsx), so a suppressed or dismissed
 * question leaves a working tool underneath rather than a dead end.
 *
 * `unlockAdmin` RELOADS on success, so there is no success state to render here and nothing to tell the
 * parent — everything gated on IS_ADMIN is computed at module-eval, and the reload is what applies it.
 * See its docblock.
 */
export function AdminUnlockPrompt() {
  // Dismissal is local and deliberately not persisted: the question is only asked when `?admin=1` is in
  // the URL, and that param is already stripped by the time this renders, so a reload cannot re-ask it.
  const [dismissed, setDismissed] = useState(false);
  const [password, setPassword] = useState("");
  const [wrong, setWrong] = useState(false);

  if (!ADMIN_PASSWORD_REQUESTED || dismissed) {
    return null;
  }

  const submit = (event) => {
    event.preventDefault();
    // `unlockAdmin` returning at all means the password was wrong — on success the page reloads.
    setWrong(!unlockAdmin(password));
  };

  /* Structure, scrim, radius, button shape and stacked actions all follow ConfirmDialog — this is the
     app's third dialog, not a new species of one. `z-[100]` matches it too, which clears the `z-40`
     header/nav and the `z-50` popovers. Not portalled, because unlike ConfirmDialog this is rendered
     from App at the top of the tree already, so there is no ancestor to escape. */
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 print:hidden"
      // A real `<dialog>` would have to be opened imperatively with `showModal()` to get its semantics,
      // which means a ref and an effect to render what is already conditional on ADMIN_PASSWORD_REQUESTED.
      // The same call the app's other three dialogs make — see ConfirmDialog, SaveCollisionDialog.
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-unlock-title"
    >
      {/* Backdrop. NOT click-to-dismiss, unlike ConfirmDialog's: this appears in response to a
          deliberate `?admin=1` navigation and the param is already consumed, so a stray tap that threw
          the question away would mean re-typing the URL to get it back. Cancel is explicit. */}
      <div className="absolute inset-0 bg-slate-900/50" />

      <form onSubmit={submit} className="relative flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="flex flex-col gap-1.5">
          <h2 id="admin-unlock-title" className="text-base font-bold text-slate-900">
            Admin access
          </h2>
          <p className="text-sm leading-snug text-slate-600">Enter the password to unlock dev options.</p>
        </div>

        <div className="flex flex-col gap-1.5">
          {/* `autoFocus` earns it here: this field is the only reason the overlay exists, and the
              overlay only appears because someone navigated to `?admin=1` on purpose. */}
          <Input
            // oxlint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
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

        <div className="flex flex-col gap-2">
          <Button type="submit" variant="outline" shape="pill" className="justify-center" disabled={password.trim() === ""}>
            Unlock
          </Button>
          {/* Cancel leaves the app running underneath — see the docblock. */}
          <Button type="button" variant="outline" shape="pill" className="justify-center" onClick={() => setDismissed(true)}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
