import { cva } from "class-variance-authority";

import { CONTROL_TEXT } from "@/styles/control-typography";

export const buttonVariants = cva(
  // select-none: buttons get clicked (and double-clicked) as controls, never read as prose — without
  // it a double-click highlights the label text.
  // ring-offset-2: the ring is a mid grey and sits flush to the edge without it, which is legible on an
  // `outline` button (light fill, so the ring reads against the fill as much as the page) but nearly
  // invisible on `default`, whose near-black fill it would touch directly. The offset puts a band of
  // page background between fill and ring, so focus is visible on every variant rather than only the
  // pale ones. On base, not on `default`, because it is the ring that is wrong here, not that variant.
  "inline-flex cursor-pointer select-none items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        // Fades the FILL on top of the shared `disabled:opacity-50`, because opacity alone leaves a
        // near-black button reading as solid-but-lighter rather than unavailable. Tuned by eye: 25
        // dissolves it into the panel, which reads as absent instead of inert.
        default: "bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-primary/50",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
      },
      size: {
        default: "h-9 px-3 py-2",
        // Label scales on the shared control ramp, so a button sitting beside a pillar row or the
        // profile-name input reads at the same size at every width.
        sm: `h-8 rounded-md px-2.5 ${CONTROL_TEXT}`,
        icon: "h-8 w-8",
      },
      // Design rule: action buttons are fully rounded (pill / circle), dropdown triggers stay
      // squared (`square`, the default — keeps the `rounded-md` from base/size). `cn`'s twMerge
      // lets `rounded-full` here override the earlier `rounded-md`.
      shape: {
        square: "",
        pill: "rounded-full",
      },
    },
    defaultVariants: {
      variant: "outline",
      size: "sm",
      shape: "square",
    },
  },
);
