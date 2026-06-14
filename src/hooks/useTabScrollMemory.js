import { useLayoutEffect, useRef } from "react";

import { getWindowScrollY, scrollWindowTo, scrollWindowToTop } from "@/lib/scroll";

/** Remember per-tab window scroll in memory; resets on page refresh. */
export function useTabScrollMemory(activeTab) {
  const scrollPositionsRef = useRef({});
  const skipRestoreRef = useRef(true);

  const saveActiveTabScroll = () => {
    scrollPositionsRef.current[activeTab] = getWindowScrollY();
  };

  useLayoutEffect(() => {
    if (skipRestoreRef.current) {
      skipRestoreRef.current = false;
      scrollWindowToTop();
      return;
    }

    scrollWindowTo(scrollPositionsRef.current[activeTab] ?? 0);
  }, [activeTab]);

  return { saveActiveTabScroll };
}
