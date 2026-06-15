import { useEffect, useState } from "react";

/** True when the primary input is touch (no hover), e.g. phones and tablets. */
export function useTouchPrimary() {
  const [touchPrimary, setTouchPrimary] = useState(() => typeof window !== "undefined" && window.matchMedia("(hover: none)").matches);

  useEffect(() => {
    const mq = window.matchMedia("(hover: none)");
    const onChange = () => setTouchPrimary(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return touchPrimary;
}
