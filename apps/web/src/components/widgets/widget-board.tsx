import {
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { AddWidgetButton } from "@/components/add-widget-button";
import { WidgetByType } from "@/components/widgets/registry";
import type { BoardWidget } from "@/components/widgets/registry";
import { useDeleteWidget } from "@/components/widgets/use-delete-widget";
import { useIdentity } from "@/lib/identity";
import { orpc } from "@/utils/orpc";

const DEFAULT_PAGE_TITLE = "Welcome";

export const WidgetBoard = () => {
  const queryClient = useQueryClient();
  // Queries wait for a name: the API rejects calls without identity headers.
  const enabled = Boolean(useIdentity().identity);
  const [focusId, setFocusId] = useState<string>();

  const pages = useQuery({ ...orpc.pages.list.queryOptions(), enabled });
  const createPage = useMutation(orpc.pages.create.mutationOptions());
  const needsPage = pages.isSuccess && pages.data.length === 0;
  const requestedPage = useRef(false);
  useEffect(() => {
    // A ref, not mutation state: StrictMode re-runs this before state updates.
    if (needsPage && !requestedPage.current) {
      requestedPage.current = true;
      createPage.mutate({ title: DEFAULT_PAGE_TITLE });
    }
  }, [createPage, needsPage]);
  const pageId = pages.data?.[0]?.id ?? createPage.data?.id;

  const listInput = pageId ? { pageId } : skipToken;
  const widgets = useQuery({
    ...orpc.widgets.list.queryOptions({ input: listInput }),
    enabled,
  });
  const createWidget = useMutation(orpc.widgets.create.mutationOptions());
  const deleteWidget = useDeleteWidget();

  const add = (type: string) => {
    if (!pageId || (type !== "text" && type !== "banner")) {
      return;
    }
    createWidget.mutate(
      type === "banner" ? { pageId, type, variant: "info" } : { pageId, type },
      {
        onSuccess: (created) => {
          queryClient.setQueryData(
            orpc.widgets.list.queryKey({ input: { pageId } }),
            (list: BoardWidget[] | undefined) => [...(list ?? []), created]
          );
          setFocusId(created.id);
        },
      }
    );
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-semibold">Pod Widgets</h1>
        {pageId ? (
          <AddWidgetButton
            onAdd={add}
            types={[
              { label: "Text", type: "text" },
              { label: "Banner", type: "banner" },
            ]}
          />
        ) : null}
      </div>
      {widgets.data?.map((widget) => (
        <WidgetByType
          autoFocus={widget.id === focusId}
          key={widget.id}
          onDelete={(pending) => deleteWidget(widget, pending)}
          widget={widget}
        />
      ))}
    </div>
  );
};
