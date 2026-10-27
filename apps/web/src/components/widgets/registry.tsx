import { BannerWidget } from "@/components/widgets/banner-widget";
import { TextWidget } from "@/components/widgets/text-widget";
import type { RouterOutputs } from "@/utils/orpc";

export type BoardWidget = RouterOutputs["widgets"]["list"][number];

/** One case per widget type; types without a component render nothing yet. */
export const WidgetByType = ({
  autoFocus,
  widget,
}: {
  autoFocus: boolean;
  widget: BoardWidget;
}) => {
  switch (widget.type) {
    case "banner": {
      return <BannerWidget autoFocus={autoFocus} widget={widget} />;
    }
    case "text": {
      return <TextWidget autoFocus={autoFocus} widget={widget} />;
    }
    default: {
      return null;
    }
  }
};
