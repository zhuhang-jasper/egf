import { useCallback, useEffect, useState } from "react";

import { create } from "zustand";

import { track } from "@/utils/analytics";

/**
 * WHETHER THE BANNER IS OPEN, OWNED HERE RATHER THAN BY THE BANNER ITSELF, because two components need to
 * write it: the banner opens itself when an install path first appears (and closes on dismiss), and the
 * header pill opens it on tap.
 *
 * THE PILL OPENS THE BANNER INSTEAD OF INSTALLING DIRECTLY, on every platform. It used to fire the native
 * prompt on Android and toggle its own little popover on iOS — two different behaviours behind one control,
 * and a second explanatory surface (the popover) that duplicated the banner's copy in a narrower box. Now
 * there is ONE explanatory surface and the pill is a way to summon it. What the user sees after tapping
 * Install is the same on both platforms, which is also what lets the popover be deleted outright.
 *
 * The pill still hides while the banner is up: the offer is on screen, so a control that re-opens it is
 * noise, and two calls to action for one action is what this whole arrangement exists to avoid.
 *
 * A STORE RATHER THAN PROPS, because the two components are in different trees: the banner mounts from
 * App, the pill from inside AppShellHeaderStack. Threading a prop down would mean giving the header stack
 * a parameter it otherwise has no use for, and that component is deliberately propless (see its
 * docblock) — its whole point is that it holds no state and takes none.
 *
 * NOT IN `useAppStore`, which is the persisted profile store: this is ephemeral view state that must
 * never reach localStorage, and it has no relationship to a profile. Its own tiny store keeps the
 * blast radius to this file and the two components that read it.
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
 * Already running as an installed app? Mirrors the display-mode checks in utils/analytics.js
 * (`getDisplayMode`), which is the same question asked for a different purpose: there it labels an
 * event, here it suppresses the whole install UI.
 *
 * NOT SHARED WITH ANALYTICS, deliberately. That function returns WHICH mode, as a string, so a
 * boolean here would have to compare against its vocabulary ("twa", "ios-standalone", the three
 * display-mode names) and would silently start returning the wrong answer if a mode were ever
 * renamed or added there. Two short predicates that each answer one question beat one that answers
 * neither cleanly.
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
 * iOS Safari never fires `beforeinstallprompt`, so there is no prompt to trigger and installs there
 * are manual: Share → Add to Home Screen. Detect it so the UI can show instructions instead of a
 * button that could not work.
 *
 * The WebKit test EXCLUDES the other iOS browsers and in-app webviews. Every browser on iOS is
 * WebKit underneath and they all report an iPad/iPhone UA, but only real Safari can add to the home
 * screen — Chrome/Firefox/Edge/Opera iOS have no such menu item, so telling their users to look for
 * one would be instructions for a thing that is not there.
 *
 * The `MacIntel` clause catches iPadOS, which requests desktop sites by default and reports itself as
 * a Mac; `maxTouchPoints > 1` is what separates it from an actual desktop Mac.
 */
// TEMPORARY PREVIEW FLAG — REMOVE BEFORE COMMITTING. Flip to `true` to force the iOS Safari branch on every
// platform, so the Share → Add to Home Screen copy can be inspected in a desktop browser. It also forces
// `canInstall` off (see the hook's return), because a real iPhone can never have both — Safari does not fire
// `beforeinstallprompt`, so showing the instructions AND a working Install button is a state that only exists
// when this flag is on.
//
// LEFT AT `false` SO NOTHING SHIPS CHANGED. Shipping it on would show iOS instructions to Android and desktop
// users, who have a working Install button and no Share menu to follow them with.
const FORCE_IOS_PREVIEW = false;

function isIosSafari() {
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
 * NO SERVICE WORKER IS INVOLVED, and none is needed: `beforeinstallprompt` requires a manifest with
 * icons and a `start_url` (see public/manifest.json, linked from index.html), not offline support.
 * There is nothing to cache here anyway — the app is a static bundle whose entire state lives in
 * localStorage.
 *
 * `source` only tags analytics, so the banner and the card can be told apart in GA.
 */
export function useInstallPrompt(source) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [iosHint, setIosHint] = useState(false);
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
      track("install_accepted", { method: "appinstalled_event", source });
    };
    window.addEventListener("appinstalled", onInstalled);

    if (isIosSafari()) {
      setIosHint(true);
    }

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
    track(outcome === "accepted" ? "install_accepted" : "install_dismissed", { method: "native_choice", source });
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
