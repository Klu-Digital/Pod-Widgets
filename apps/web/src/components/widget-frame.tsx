import { cn } from "@k22i/ui/lib/utils";
import type { ReactNode } from "react";

export type WidgetTone = "info" | "idea" | "warning" | "success";

// `idea` has no theme token of its own, so it borrows `primary`.
const TONE_CLASS: Record<WidgetTone, string> = {
  idea: "border-primary/32 bg-primary/4",
  info: "border-info/32 bg-info/4",
  success: "border-success/32 bg-success/4",
  warning: "border-warning/32 bg-warning/4",
};

export const WidgetFrame = ({
  actions,
  "aria-label": ariaLabel,
  children,
  tone,
}: {
  actions?: ReactNode;
  "aria-label": string;
  children: ReactNode;
  tone?: WidgetTone;
}) => (
  <section
    aria-label={ariaLabel}
    className={cn(
      "bg-card text-card-foreground flex items-start gap-2 rounded-xl border p-4",
      tone && TONE_CLASS[tone]
    )}
  >
    <div className="min-w-0 flex-1">{children}</div>
    {actions ? <div className="flex shrink-0 gap-1">{actions}</div> : null}
  </section>
);
