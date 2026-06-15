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

/** Remember per-tab window scroll in sessionStorage; persists across page refresh. */
export function useTabScrollMemory(activeTab) {
  const saveActiveTabScroll = () => {
    persistScroll(activeTab, getWindowScrollY());
  };

  useLayoutEffect(() => {
    persistActiveTab(activeTab);
    const y = getPersistedScroll(activeTab);
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
