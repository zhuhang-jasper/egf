import { AlertCircle, Check, X } from "lucide-react";

import { useAppStore } from "@/store/useAppStore";

import { cn } from "@/utils";

const VARIANT_META = {
  default: {
    icon: null,
    containerClass: "border-border bg-card text-card-foreground",
    dismissClass: "text-muted-foreground hover:text-foreground",
  },
  dark: {
    icon: null,
    containerClass: "border-transparent bg-slate-900 text-white",
    dismissClass: "text-white/70 hover:text-white",
  },
  success: {
    icon: Check,
    containerClass: "border-transparent bg-emerald-600 text-white",
    dismissClass: "text-white/70 hover:text-white",
  },
  error: {
    icon: AlertCircle,
    containerClass: "border-transparent bg-destructive text-white",
    dismissClass: "text-white/70 hover:text-white",
  },
};

/**
 * App-wide toast host. Mount once near the app root; it subscribes to the store's `toasts`
 * stack and renders a bottom-centered pile of transient notices (newest nearest the edge). Toasts
 * are added via the store's `showToast` action and auto-dismiss on a timer (see useAppStore).
 */
export function Toaster() {
  const toasts = useAppStore((s) => s.toasts);
  const dismissToast = useAppStore((s) => s.dismissToast);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[100] flex flex-col-reverse items-center gap-2 px-4"
    >
      {toasts.map((t) => {
        const meta = VARIANT_META[t.variant] ?? VARIANT_META.default;
        const Icon = meta.icon;
        return (
          <output
            key={t.id}
            className={cn(
              "toast-enter pointer-events-auto flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-lg border px-3 py-2 text-sm shadow-md",
              meta.containerClass,
            )}
          >
            {Icon ? <Icon className="h-4 w-4 shrink-0" aria-hidden /> : null}
            <span className="min-w-0">{t.message}</span>
            {t.action ? (
              <button
                type="button"
                className={cn("ml-1 shrink-0 rounded-sm px-1.5 py-0.5 text-sm font-semibold underline-offset-2 hover:underline", meta.dismissClass)}
                onClick={() => {
                  t.action.onAction();
                  dismissToast(t.id);
                }}
              >
                {t.action.label}
              </button>
            ) : null}
            <button
              type="button"
              aria-label="Dismiss notification"
              className={cn("ml-1 shrink-0 rounded-sm", meta.dismissClass)}
              onClick={() => dismissToast(t.id)}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </output>
        );
      })}
    </div>
  );
}
