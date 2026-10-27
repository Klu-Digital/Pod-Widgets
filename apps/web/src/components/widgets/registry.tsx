import { BannerWidget } from "@/components/widgets/banner-widget";
import { TextWidget } from "@/components/widgets/text-widget";
import type { RouterOutputs } from "@/utils/orpc";

export type BoardWidget = RouterOutputs["widgets"]["list"][number];

/** The latest edit and the save carrying it, for a widget that is leaving. */
export interface PendingSave {
  content: BoardWidget["content"];
  saved: Promise<void>;
}

export type DeleteHandler = (pending?: PendingSave) => void;

/** One case per widget type; types without a component render nothing yet. */
export const WidgetByType = ({
  autoFocus,
  onDelete,
  widget,
}: {
  autoFocus: boolean;
  onDelete: DeleteHandler;
  widget: BoardWidget;
}) => {
  switch (widget.type) {
    case "banner": {
      return <BannerWidget autoFocus={autoFocus} widget={widget} />;
    }
    case "text": {
      return (
        <TextWidget autoFocus={autoFocus} onDelete={onDelete} widget={widget} />
      );
    }
    default: {
      return null;
    }
  }
};
