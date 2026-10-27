import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toastManager } from "@trumpet-pods/ui/components/toast";

import type { BoardWidget, PendingSave } from "@/components/widgets/registry";
import { orpc } from "@/utils/orpc";

const UNDO_WINDOW_MS = 10_000;
// One scope serializes delete and restore, so an early Undo cannot overtake.
const TRASH_SCOPE = { id: "widget-trash" };

interface Removal {
  item: BoardWidget;
  saved?: Promise<void>;
}

interface RemovalContext {
  index: number;
  toastId: string;
}

interface Restoration {
  index: number;
  item: BoardWidget;
}

const listKey = (item: BoardWidget) =>
  orpc.widgets.list.queryKey({ input: { pageId: item.pageId } });

/** Optimistic soft delete: the widget goes at once, Undo lasts 10 s. */
export const useDeleteWidget = () => {
  const queryClient = useQueryClient();
  const settleList = async (item: BoardWidget) => {
    await queryClient.cancelQueries({ queryKey: listKey(item) });
  };
  const insertAt = ({ index, item }: Restoration) => {
    queryClient.setQueryData(listKey(item), (list?: BoardWidget[]) =>
      list?.some((widget) => widget.id === item.id)
        ? list
        : [...(list ?? []).slice(0, index), item, ...(list ?? []).slice(index)]
    );
  };
  const take = (item: BoardWidget) => {
    queryClient.setQueryData(listKey(item), (list?: BoardWidget[]) =>
      list?.filter((widget) => widget.id !== item.id)
    );
  };

  const restore = useMutation({
    mutationFn: ({ item }: Restoration) =>
      orpc.widgets.restore.call({ id: item.id }),
    onError: (_error, { item }) => take(item),
    onMutate: async (restoration) => {
      await settleList(restoration.item);
      insertAt(restoration);
    },
    onSettled: (_data, _error, { item }) =>
      queryClient.invalidateQueries({ queryKey: listKey(item) }),
    scope: TRASH_SCOPE,
  });

  const remove = useMutation<unknown, Error, Removal, RemovalContext>({
    // The row must not be deleted before its last edit has been saved.
    mutationFn: async ({ item, saved }: Removal) => {
      await saved;
      await orpc.widgets.delete.call({ id: item.id });
    },
    onError: (_error, { item }, context) => {
      if (context) {
        insertAt({ index: context.index, item });
        toastManager.close(context.toastId);
      }
    },
    onMutate: async ({ item }) => {
      await settleList(item);
      const list = queryClient.getQueryData<BoardWidget[]>(listKey(item));
      const index = Math.max(
        list?.findIndex((widget) => widget.id === item.id) ?? 0,
        0
      );
      take(item);
      const toastId = toastManager.add({
        actionProps: {
          children: "Undo",
          onClick: () => {
            toastManager.close(toastId);
            restore.mutate({ index, item });
          },
        },
        timeout: UNDO_WINDOW_MS,
        title: "Widget deleted",
      });
      return { index, toastId };
    },
    scope: TRASH_SCOPE,
  });

  return (widget: BoardWidget, pending?: PendingSave) => {
    // The cache copy predates the flushed edit, and Undo re-seeds from it.
    const item = pending
      ? ({ ...widget, content: pending.content } as BoardWidget)
      : widget;
    remove.mutate({ item, saved: pending?.saved });
  };
};
