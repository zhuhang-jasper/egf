import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
      },
      size: {
        default: "h-9 px-3 py-2",
        sm: "h-8 rounded-md px-2.5 text-xs",
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
