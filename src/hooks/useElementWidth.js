import { useLayoutEffect, useState } from "react";

export function useElementWidth(ref) {
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) {
      return undefined;
    }

    const update = () => setWidth(el.offsetWidth);
    update();

    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [ref]);

  return width;
}
