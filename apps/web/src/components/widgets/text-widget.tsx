import { Delete02Icon } from "@hugeicons/core-free-icons";
import { RichTextEditor } from "@trumpet-pods/ui/components/rich-text-editor";
import type { RichTextDoc } from "@trumpet-pods/ui/components/rich-text-editor";
import { useState } from "react";

import { IconButton } from "@/components/icon-button";
import { WidgetFrame } from "@/components/widget-frame";
import type { DeleteHandler, PendingSave } from "@/components/widgets/registry";
import { useAutosave } from "@/hooks/use-autosave";
import type { SaveStatus } from "@/hooks/use-autosave";
import type { RouterOutputs } from "@/utils/orpc";

export type TextWidgetData = Extract<
  RouterOutputs["widgets"]["list"][number],
  { type: "text" }
>;

const STATUS_LABEL: Record<SaveStatus, string> = {
  error: "Save failed",
  idle: "",
  saved: "Saved",
  saving: "Saving…",
};

export const TextWidget = ({
  autoFocus,
  onDelete,
  widget,
}: {
  autoFocus: boolean;
  onDelete: DeleteHandler;
  widget: TextWidgetData;
}) => {
  // The API checks only the doc root; the editor owns the rest of the shape.
  const seed = widget.content as RichTextDoc;
  const [content, setContent] = useState(seed);
  const { flush, status } = useAutosave(widget.id, content);

  return (
    <WidgetFrame
      actions={
        <IconButton
          aria-label="Delete widget"
          icon={Delete02Icon}
          onClick={() =>
            onDelete({
              content: content as PendingSave["content"],
              saved: flush(),
            })
          }
        />
      }
      aria-label="Text widget"
    >
      <RichTextEditor
        aria-label="Widget text"
        autoFocus={autoFocus}
        onBlur={flush}
        onChange={setContent}
        value={seed}
      />
      <div className="text-muted-foreground mt-2 flex justify-between text-xs">
        <span>Created by {widget.createdBy}</span>
        <span aria-live="polite">{STATUS_LABEL[status]}</span>
      </div>
    </WidgetFrame>
  );
};
