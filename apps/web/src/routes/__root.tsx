import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import {
  HeadContent,
  Outlet,
  createRootRouteWithContext,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { Button } from "@trumpet-pods/ui/components/button";
import { ToastProvider } from "@trumpet-pods/ui/components/toast";

import { ThemeProvider } from "@/components/theme-provider";
import type { orpc } from "@/utils/orpc";

import "../index.css";

export interface RouterAppContext {
  orpc: typeof orpc;
  queryClient: QueryClient;
}

const RootComponent = () => (
  <>
    <HeadContent />
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      disableTransitionOnChange
      storageKey="vite-ui-theme"
    >
      <ToastProvider>
        <Outlet />
      </ToastProvider>
    </ThemeProvider>
    <TanStackRouterDevtools position="bottom-left" />
    <ReactQueryDevtools buttonPosition="bottom-right" position="bottom" />
  </>
);

const RootErrorComponent = ({ reset }: { reset: () => void }) => (
  <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
    <div>
      <h1 className="font-heading text-xl font-semibold">
        Something went wrong
      </h1>
      <p className="text-muted-foreground mt-1 text-sm">
        We could not reach the server. Check your connection and try again.
      </p>
    </div>
    <Button onClick={reset}>Try again</Button>
  </div>
);

export const Route = createRootRouteWithContext<RouterAppContext>()({
  component: RootComponent,
  errorComponent: RootErrorComponent,
  head: () => ({
    links: [
      {
        href: "/favicon.ico",
        rel: "icon",
      },
    ],
    meta: [
      {
        title: "trumpet-pods",
      },
      {
        content: "trumpet-pods is a web application",
        name: "description",
      },
    ],
  }),
});
