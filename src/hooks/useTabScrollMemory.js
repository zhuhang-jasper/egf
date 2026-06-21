import { useLayoutEffect } from "react";

import { getWindowScrollY, scrollWindowTo } from "@/utils/scroll";

const SESSION_TAB_KEY = "app:activeTab";
const SESSION_SCROLL_PREFIX = "app:tabScroll:";

export function getPersistedActiveTab(validTabs) {
  try {
    const saved = sessionStorage.getItem(SESSION_TAB_KEY);
    if (saved && validTabs.includes(saved)) {
      return saved;
    }
  } catch {}
  return null;
}

function persistActiveTab(tab) {
  try {
    sessionStorage.setItem(SESSION_TAB_KEY, tab);
  } catch {}
}

function getPersistedScroll(tab) {
  try {
    const raw = sessionStorage.getItem(`${SESSION_SCROLL_PREFIX}${tab}`);
    return raw !== null ? Number(raw) : 0;
  } catch {}
  return 0;
}

function persistScroll(tab, y) {
  try {
    sessionStorage.setItem(`${SESSION_SCROLL_PREFIX}${tab}`, String(y));
  } catch {}
}

/**
 * Remember per-tab window scroll in sessionStorage; persists across page refresh.
 *
 * `keepStuckAnchorRef` is a consumed-once ref carrying the tab bar's pinned-scroll anchor, captured
 * at switch time *only when the bar was stuck* (else null). When set, the new tab is raised to at
 * least that anchor so the bar stays pinned across every switch — landing at the stick point hides
 * only the header, never body content, so this is always safe. The anchor is captured by the caller
 * on the settled layout — never measured here at restore time — so the page-refresh path is unaffected.
 */
export function useTabScrollMemory(activeTab, keepStuckAnchorRef) {
  const saveActiveTabScroll = () => {
    persistScroll(activeTab, getWindowScrollY());
  };

  useLayoutEffect(() => {
    persistActiveTab(activeTab);
    let y = getPersistedScroll(activeTab);
    const anchor = keepStuckAnchorRef?.current;
    if (anchor != null) {
      y = Math.max(y, anchor); // keep the bar pinned across the switch
      keepStuckAnchorRef.current = null; // consumed once
    }
    const frame = requestAnimationFrame(() => {
      scrollWindowTo(y);
    });

    const onBeforeUnload = () => persistScroll(activeTab, getWindowScrollY());
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [activeTab]);

  return { saveActiveTabScroll };
}
