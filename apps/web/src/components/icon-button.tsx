import type { IconSvgElement } from "@hugeicons/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@trumpet-pods/ui/components/button";
import type { ButtonProps } from "@trumpet-pods/ui/components/button";

export const IconButton = ({
  "aria-label": ariaLabel,
  icon,
  size = "icon-sm",
  variant = "ghost",
  ...props
}: Omit<ButtonProps, "aria-label" | "children" | "size"> & {
  "aria-label": string;
  icon: IconSvgElement;
  size?: "icon" | "icon-lg" | "icon-sm" | "icon-xl" | "icon-xs";
}) => (
  <Button aria-label={ariaLabel} size={size} variant={variant} {...props}>
    <HugeiconsIcon icon={icon} strokeWidth={2} />
  </Button>
);
