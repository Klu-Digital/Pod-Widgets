import { Home01Icon } from "@hugeicons/core-free-icons";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
} from "@trumpet-pods/ui/components/sidebar";

import NavMain from "@/components/nav-main";
import type { NavItem } from "@/components/nav-main";

const navMain: NavItem[] = [{ icon: Home01Icon, title: "Home", to: "/" }];

const AppSidebar = () => (
  <Sidebar collapsible="icon" variant="inset">
    <SidebarHeader>
      <span className="px-2 py-1.5 text-sm font-semibold">Pod Widgets</span>
    </SidebarHeader>
    <SidebarContent>
      <NavMain items={navMain} label="Platform" />
    </SidebarContent>
    <SidebarRail />
  </Sidebar>
);

export default AppSidebar;
