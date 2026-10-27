import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RichTextEditor } from "@trumpet-pods/ui/components/rich-text-editor";
import type { RichTextDoc } from "@trumpet-pods/ui/components/rich-text-editor";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@trumpet-pods/ui/components/toggle-group";
import { useState } from "react";

import { WidgetFrame } from "@/components/widget-frame";
import { useAutosave } from "@/hooks/use-autosave";
import type { SaveStatus } from "@/hooks/use-autosave";
import { orpc } from "@/utils/orpc";
import type { RouterOutputs } from "@/utils/orpc";

type BoardList = RouterOutputs["widgets"]["list"];
type BannerWidgetData = Extract<BoardList[number], { type: "banner" }>;
type BannerVariant = BannerWidgetData["variant"];
type Snapshot = [readonly unknown[], BoardList | undefined][];

const VARIANTS: Record<BannerVariant, { emoji: string; label: string }> = {
  idea: { emoji: "💡", label: "Idea" },
  info: { emoji: "ℹ️", label: "Info" },
  success: { emoji: "✅", label: "Success" },
  warning: { emoji: "⚠️", label: "Warning" },
};

const VARIANT_ORDER: BannerVariant[] = ["info", "idea", "warning", "success"];

const STATUS_LABEL: Record<SaveStatus, string> = {
  error: "Save failed",
  idle: "",
  saved: "Saved",
  saving: "Saving…",
};

export const BannerWidget = ({
  autoFocus,
  widget,
}: {
  autoFocus: boolean;
  widget: BannerWidgetData;
}) => {
  const queryClient = useQueryClient();
  // The API checks only the doc root; the editor owns the rest of the shape.
  const seed = widget.content as RichTextDoc;
  const [content, setContent] = useState(seed);
  const { flush, status } = useAutosave(widget.id, content);

  const setVariant = useMutation({
    ...orpc.widgets.updateBanner.mutationOptions(),
    onError: (_error, _input, context: { previous: Snapshot } | undefined) => {
      for (const [key, list] of context?.previous ?? []) {
        queryClient.setQueryData(key, list);
      }
    },
    // The server's copy could carry content older than an unsent local edit.
    onMutate: ({ id, variant }) => {
      const previous = queryClient.getQueriesData<BoardList>({
        queryKey: orpc.widgets.list.key(),
      });
      queryClient.setQueriesData<BoardList>(
        { queryKey: orpc.widgets.list.key() },
        (list) =>
          list?.map((item) =>
            item.id === id && item.type === "banner"
              ? { ...item, variant }
              : item
          )
      );
      return { previous };
    },
  });

  const { emoji } = VARIANTS[widget.variant];

  return (
    <WidgetFrame aria-label="Banner widget" tone={widget.variant}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span aria-hidden className="text-xl">
          {emoji}
        </span>
        <ToggleGroup
          aria-label="Banner variant"
          onValueChange={([picked]) => {
            const next = VARIANT_ORDER.find((variant) => variant === picked);
            if (next && next !== widget.variant) {
              setVariant.mutate({ id: widget.id, variant: next });
            }
          }}
          size="sm"
          value={[widget.variant]}
        >
          {VARIANT_ORDER.map((variant) => (
            <ToggleGroupItem
              aria-label={VARIANTS[variant].label}
              key={variant}
              value={variant}
            >
              {VARIANTS[variant].emoji}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
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
