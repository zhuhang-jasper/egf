import { useCallback, useEffect, useState } from "react";

import { create } from "zustand";

import { track } from "@/utils/analytics";

/**
 * Whether the banner is open. Owned here because two components in different trees write it (the banner
 * itself and the header pill), so a store rather than props. Not in `useAppStore`: ephemeral view state that
 * must never reach localStorage.
 */
const useInstallBannerStore = create((set) => ({
  bannerOpen: false,
  openBanner: () => set({ bannerOpen: true }),
  closeBanner: () => set({ bannerOpen: false }),
}));

/** True while the install banner is on screen. The pill reads it to hide itself. */
export function useInstallBannerOpen() {
  return useInstallBannerStore((state) => state.bannerOpen);
}

/** Open the banner. Called by the header pill on tap, and by the banner's own first-appearance effect. */
export function useOpenInstallBanner() {
  return useInstallBannerStore((state) => state.openBanner);
}

/** Close the banner. Called when it is dismissed or the install is accepted. */
export function useCloseInstallBanner() {
  return useInstallBannerStore((state) => state.closeBanner);
}

/**
 * Already running as an installed app? Deliberately not shared with analytics' `getDisplayMode`, which
 * answers the same question but returns WHICH mode as a string: a boolean derived from it would have to
 * compare against that vocabulary and would silently go wrong if a mode were renamed or added.
 */
function isStandalone() {
  if (typeof window === "undefined") {
    return false;
  }
  if (window.navigator.standalone === true) {
    return true; // iOS installed PWA — no reliable matchMedia there
  }
  if (document.referrer.startsWith("android-app://")) {
    return true; // Android TWA (Play Store wrapper)
  }
  return ["fullscreen", "standalone", "minimal-ui"].some((mode) => window.matchMedia(`(display-mode: ${mode})`).matches);
}

/**
 * iOS Safari never fires `beforeinstallprompt`, so installs there are manual and the UI must show
 * instructions rather than a button that cannot work.
 *
 * The WebKit test excludes other iOS browsers, which are WebKit underneath and report an iPad/iPhone UA but
 * have no Add to Home Screen item. `MacIntel` + `maxTouchPoints > 1` catches iPadOS, which requests desktop
 * sites and reports itself as a Mac.
 */
// Dev preview flag: forces the iOS Safari branch on every platform so the Add-to-Home-Screen copy can be
// inspected in a desktop browser. Also forces `canInstall` off, since a real iPhone can never have both.
// MUST SHIP `false`, or Android and desktop users get iOS instructions they cannot follow.
const FORCE_IOS_PREVIEW = false;

// iOS's installed-PWA experience is broken enough (no push, flaky standalone detection, silent cache
// staleness) that we no longer invite the install. Kept as a kill switch rather than deleted: flip back to
// `true` if iOS PWA support improves enough to offer again.
const IOS_INSTALL_ENABLED = false;

function isIosSafari() {
  if (!IOS_INSTALL_ENABLED) {
    return false;
  }
  if (FORCE_IOS_PREVIEW) {
    return true;
  }
  if (typeof navigator === "undefined") {
    return false;
  }
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const webkit = /WebKit/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return iOS && webkit;
}

/**
 * Shared install state for both install surfaces (the floating banner and the persistent card in the
 * tool tab). See components/InstallPrompt.
 *
 * Returns:
 *  - installed  : running as a standalone app, so every install surface should render nothing
 *  - canInstall : a native `beforeinstallprompt` was captured, so an Install button will work
 *  - iosHint    : iOS Safari, so show the manual Add-to-Home-Screen line instead of a button
 *  - install()  : fire the native prompt (no-op unless `canInstall`); resolves to the outcome string
 *
 * No service worker is involved or needed: `beforeinstallprompt` requires a manifest with icons and a
 * `start_url`, not offline support, and there is nothing to cache in a static bundle whose state lives in
 * localStorage.
 *
 * `source` only tags analytics, so the banner and the card can be told apart in GA.
 */
export function useInstallPrompt(source) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  // A pure UA read that cannot change over the hook's life, so a plain const rather than state:
  // there is nothing to store or set.
  const iosHint = isIosSafari();
  const [installed, setInstalled] = useState(() => isStandalone());

  useEffect(() => {
    if (isStandalone()) {
      return undefined;
    }

    // Chrome/Edge/Android: the event IS the prompt. Preventing its default suppresses the browser's
    // own mini-infobar and stashes it, so the prompt can be fired from our own button instead — at a
    // moment the user chose, and only once they have seen what the app is.
    const onBeforeInstall = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    // Hide the install UI the moment the app is actually added, without waiting for a reload. Also
    // catches an install done through the browser's own menu, which never touches our button.
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      // The only event meaning the app is actually installed, since it fires for an install by ANY route
      // including the browser's own menu; `install_os_*` only reports how our prompt was answered. Count
      // installs by this. `source` is the surface that was MOUNTED, not necessarily the one used, so do
      // not attribute installs with it.
      track("install_completed", { method: "appinstalled_event", source });
    };
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [source]);

  const install = useCallback(async () => {
    if (!deferredPrompt) {
      return null;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    // `install_os_*` — the BROWSER'S sheet, not ours. Distinct from `install_banner_dismissed`, which is
    // our own X and means the user never got this far. Accepting here is normally followed by
    // `install_completed` from the `appinstalled` listener above, so count installs with that one and use
    // these two for the prompt's own accept/decline rate.
    track(outcome === "accepted" ? "install_os_accepted" : "install_os_declined", { method: "native_choice", source });
    // A captured prompt is SINGLE-USE: the spec forbids calling `prompt()` twice on the same event,
    // so clearing it is what stops a second tap failing silently. The browser fires a fresh
    // `beforeinstallprompt` on the next page load if the app is still uninstalled.
    setDeferredPrompt(null);
    return outcome;
  }, [deferredPrompt, source]);

  // `canInstall` IS FORCED OFF DURING THE iOS PREVIEW. Without this the flag only added the iOS hint on top
  // of a real captured prompt, so a desktop Chrome preview showed the instructions AND the Install button —
  // a combination that cannot occur on a real iPhone, where Safari never fires `beforeinstallprompt` at all.
  return { installed, canInstall: !FORCE_IOS_PREVIEW && Boolean(deferredPrompt), iosHint, install };
}
