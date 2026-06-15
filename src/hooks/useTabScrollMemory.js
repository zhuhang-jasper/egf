import { useLayoutEffect, useRef } from "react";

import { getWindowScrollY, scrollWindowTo } from "@/utils/scroll";

/** Remember per-tab window scroll in memory; resets on page refresh. */
export function useTabScrollMemory(activeTab) {
  const scrollPositionsRef = useRef({});
  const skipRestoreRef = useRef(true);

  const saveActiveTabScroll = () => {
    scrollPositionsRef.current[activeTab] = getWindowScrollY();
  };

  useLayoutEffect(() => {
    let y = scrollPositionsRef.current[activeTab] ?? 0;
    if (skipRestoreRef.current) {
      skipRestoreRef.current = false;
      y = 0;
    }

    const frame = requestAnimationFrame(() => {
      scrollWindowTo(y);
    });

    return () => cancelAnimationFrame(frame);
  }, [activeTab]);

  return { saveActiveTabScroll };
}
