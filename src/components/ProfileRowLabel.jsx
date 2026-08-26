import { useLayoutEffect, useRef, useState } from "react";

import { FrameworkVersionChip } from "@/components/FrameworkVersionChip";

import { useProfileStampState } from "@/hooks/useProfileStamp";

import { cn } from "@/utils";

// Marquee scroll speed (px/sec) for names too long to fit — lower is slower/calmer.
const MARQUEE_SPEED_PX_PER_SEC = 45;
// Gap between the two looping copies of a scrolling name, so it doesn't read as one run-on word.
const MARQUEE_GAP_PX = 40;

/** One row's version chip. Its own component because the resolver is a hook and rows are mapped. */
function ProfileVersionChip({ profile }) {
  const { state, version } = useProfileStampState(profile);
  return <FrameworkVersionChip state={state} version={version} className="ml-2" />;
}

/**
 * A profile name that scrolls like an LED sign when it is wider than the space available, and renders as a
 * plain span when it fits. Speed is proportional to length so long names don't whip past. `deps` lets the
 * caller force a re-measure when layout that affects width changes.
 */
function ScrollingLabel({ label, className, deps }) {
  const boxRef = useRef(null);
  const textRef = useRef(null);
  const [overflow, setOverflow] = useState(0); // scrollWidth − clientWidth, in px (0 = fits)

  useLayoutEffect(() => {
    const measure = () => {
      const box = boxRef.current;
      const text = textRef.current;
      if (!box || !text) {
        return;
      }
      // Measure the single (un-duplicated) text width against the box's inner width.
      setOverflow(Math.max(0, Math.ceil(text.scrollWidth - box.clientWidth)));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label, deps]);

  const scrolling = overflow > 0;

  if (!scrolling) {
    return (
      <span ref={boxRef} className={cn("block min-w-0 flex-1 overflow-hidden whitespace-nowrap", className)}>
        <span ref={textRef} className="inline-block">
          {label}
        </span>
      </span>
    );
  }

  // Each copy carries the gap as trailing padding, so one "unit" = textWidth + gap. Two units make
  // the track; translateX(-50%) then lands the second unit exactly where the first started → seamless.
  const textWidth = textRef.current?.scrollWidth ?? 0;
  const durationSec = Math.max(4, (textWidth + MARQUEE_GAP_PX) / MARQUEE_SPEED_PX_PER_SEC);
  const copyStyle = { paddingRight: `${MARQUEE_GAP_PX}px` };

  return (
    <span ref={boxRef} className={cn("block min-w-0 flex-1 overflow-hidden whitespace-nowrap", className)}>
      <span className="marquee-track" style={{ animationDuration: `${durationSec}s` }}>
        {/* First copy is the one we measure; the duplicate makes the loop seamless. */}
        <span ref={textRef} className="inline-block" style={copyStyle}>
          {label}
        </span>
        <span aria-hidden className="inline-block" style={copyStyle}>
          {label}
        </span>
      </span>
    </span>
  );
}

export { ProfileVersionChip, ScrollingLabel };
