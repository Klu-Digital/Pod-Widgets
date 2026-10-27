import { createFileRoute } from "@tanstack/react-router";

const RouteComponent = () => (
  <div className="mx-auto w-full space-y-2 p-6">
    <h1 className="font-heading text-2xl font-semibold">Pod Widgets</h1>
    <p className="text-muted-foreground text-sm">
      Your widget board will appear here.
    </p>
  </div>
);

export const Route = createFileRoute("/_app/")({
  component: RouteComponent,
  head: () => ({ meta: [{ title: "Home" }] }),
});
