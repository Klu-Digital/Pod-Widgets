import { createFileRoute } from "@tanstack/react-router";

import { WidgetBoard } from "@/components/widgets/widget-board";

export const Route = createFileRoute("/_app/")({
  component: WidgetBoard,
  head: () => ({ meta: [{ title: "Home" }] }),
});
