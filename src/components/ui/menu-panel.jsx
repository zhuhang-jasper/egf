import { forwardRef } from "react";

import { LAYER } from "@/constants";
import { cn } from "@/utils";

/**
 * The floating panel every dropdown in the app shares — surface, radius, shadow, layer, and the `top-`/`bottom-`
 * flip that {@link useMenuPosition} decides. Position only: rows come from the caller, since the three ARIA
 * shapes (menuitem, menuitemcheckbox, menuitemradio) are not interchangeable.
 *
 * `align` is which edge the panel hangs from. `padded` adds the `py-1` that row-based menus want and a menu with
 * its own header (the profile combobox's search box) does not.
 */
export const MenuPanel = forwardRef(function MenuPanel({ openUp, align = "left", padded = false, className, children, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        "absolute flex w-max max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-lg border border-border bg-card shadow-md",
        align === "right" ? "right-0" : "left-0",
        openUp ? "bottom-[calc(100%+4px)]" : "top-[calc(100%+4px)]",
        padded && "py-1",
        LAYER.dropdown,
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
});
