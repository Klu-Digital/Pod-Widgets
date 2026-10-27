import { Outlet, createFileRoute } from "@tanstack/react-router";
import { Separator } from "@trumpet-pods/ui/components/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@trumpet-pods/ui/components/sidebar";

import AppBreadcrumbs from "@/components/app-breadcrumbs";
import AppSidebar from "@/components/app-sidebar";
import { IdentityBadge } from "@/components/identity-dialog";
import { ModeToggle } from "@/components/mode-toggle";

const AppLayout = () => (
  // `h-svh` pins the shell to the viewport so only the content pane scrolls.
  <div className="bg-sidebar h-svh overflow-hidden">
    <SidebarProvider className="mx-auto h-full max-w-400">
      <AppSidebar />
      <SidebarInset className="overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ms-1" />
          <Separator className="me-2 h-4" orientation="vertical" />
          <AppBreadcrumbs />
          <div className="ms-auto flex items-center gap-3">
            <IdentityBadge />
            <ModeToggle />
          </div>
        </header>
        {/* `min-h-0` lets `overflow-y-auto` bite; a flex child's default
            `min-height: auto` would grow past the pane instead. */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  </div>
);

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});
