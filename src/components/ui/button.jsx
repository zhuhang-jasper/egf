import { forwardRef } from "react";

import { Slot } from "@radix-ui/react-slot";

import { buttonVariants } from "@/components/ui/button-variants";

import { cn } from "@/utils";

const Button = forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});
Button.displayName = "Button";

export { Button };
