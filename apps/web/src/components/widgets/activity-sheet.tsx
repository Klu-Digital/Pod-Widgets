import { useQuery } from "@tanstack/react-query";
import { Button } from "@trumpet-pods/ui/components/button";
import {
  Sheet,
  SheetDescription,
  SheetHeader,
  SheetPanel,
  SheetPopup,
  SheetTitle,
  SheetTrigger,
} from "@trumpet-pods/ui/components/sheet";
import { useState } from "react";

import { useIdentity } from "@/lib/identity";
import { relativeTime } from "@/lib/relative-time";
import { orpc } from "@/utils/orpc";
import type { RouterOutputs } from "@/utils/orpc";

type AuditEntry = RouterOutputs["audit"]["list"][number];

const ActivityEntry = ({ entry }: { entry: AuditEntry }) => (
  <li className="text-sm">
    {entry.actorName} {entry.action} a {entry.widgetType} widget ·{" "}
    <span className="text-muted-foreground">{relativeTime(entry.at)}</span>
  </li>
);

export const ActivitySheet = ({ pageId }: { pageId: string }) => {
  const [open, setOpen] = useState(false);
  const hasIdentity = Boolean(useIdentity().identity);
  // staleTime 0: each open refetches, so no mutation needs to invalidate.
  const activity = useQuery({
    ...orpc.audit.list.queryOptions({ input: { pageId } }),
    enabled: open && hasIdentity,
    staleTime: 0,
  });

  return (
    <Sheet onOpenChange={setOpen} open={open}>
      <SheetTrigger render={<Button variant="outline" />}>
        Activity
      </SheetTrigger>
      <SheetPopup>
        <SheetHeader>
          <SheetTitle>Activity</SheetTitle>
          <SheetDescription>Recent changes to this page</SheetDescription>
        </SheetHeader>
        <SheetPanel>
          {activity.data?.length === 0 ? (
            <p className="text-muted-foreground text-sm">No activity yet</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {activity.data?.map((entry) => (
                <ActivityEntry entry={entry} key={entry.id} />
              ))}
            </ul>
          )}
        </SheetPanel>
      </SheetPopup>
    </Sheet>
  );
};
