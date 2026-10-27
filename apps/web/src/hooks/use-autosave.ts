import { useMutation, useQueryClient } from "@tanstack/react-query";
import { env } from "@trumpet-pods/env/web";
import type { RichTextDoc } from "@trumpet-pods/ui/components/rich-text-editor";
import { useCallback, useEffect, useRef } from "react";

import { identityHeaders } from "@/lib/identity";
import { getServerUrl } from "@/lib/server-url";
import { orpc } from "@/utils/orpc";
import type { RouterInputs, RouterOutputs } from "@/utils/orpc";

const DEBOUNCE_MS = 800;

type ContentInput = RouterInputs["widgets"]["updateContent"]["content"];

export type SaveStatus = "error" | "idle" | "saved" | "saving";

// sendBeacon cannot set the identity or CSRF headers, so it would be refused.
const saveOnExit = async (id: string, content: ContentInput) => {
  try {
    await fetch(
      `${getServerUrl(env.VITE_SERVER_URL)}/rpc/widgets/updateContent`,
      {
        body: JSON.stringify({ json: { content, id } }),
        credentials: "include",
        headers: {
          ...identityHeaders(),
          "content-type": "application/json",
          // The value SimpleCsrfProtectionLinkPlugin sends by default.
          "x-csrf-token": "orpc",
        },
        keepalive: true,
        method: "POST",
      }
    );
  } catch {
    // Best effort: the page is already going away.
  }
};

/** Saves `content` 800 ms after the last change and whenever the page leaves. */
export const useAutosave = (widgetId: string, content: RichTextDoc) => {
  const queryClient = useQueryClient();
  const { isError, isPending, isSuccess, mutateAsync } = useMutation({
    ...orpc.widgets.updateContent.mutationOptions(),
    meta: { suppressErrorToast: true },
    // A remounted editor seeds from this cache, so it must not serve old text.
    onSuccess: (_, { content: saved, id }) => {
      queryClient.setQueriesData<RouterOutputs["widgets"]["list"]>(
        { queryKey: orpc.widgets.list.key() },
        (list) =>
          list?.map((item) =>
            item.id === id ? { ...item, content: saved } : item
          )
      );
    },
  });

  const latest = useRef(content);
  const saved = useRef(content);
  const timer = useRef(0);

  // Resolves once every save started so far has settled; never rejects.
  const settled = useRef<Promise<unknown>>(Promise.resolve());

  const flush = useCallback(async (): Promise<void> => {
    clearTimeout(timer.current);
    const doc = latest.current;
    const previous = saved.current;
    if (doc !== previous) {
      saved.current = doc;
      const save = (async () => {
        try {
          await mutateAsync({ content: doc as ContentInput, id: widgetId });
        } catch {
          // Lets the next blur or edit retry instead of treating it as saved.
          if (saved.current === doc) {
            saved.current = previous;
          }
        }
      })();
      settled.current = Promise.all([settled.current, save]);
    }
    await settled.current;
  }, [mutateAsync, widgetId]);

  useEffect(() => {
    latest.current = content;
    if (content === saved.current) {
      return;
    }
    timer.current = window.setTimeout(flush, DEBOUNCE_MS);
    return () => clearTimeout(timer.current);
  }, [content, flush]);

  useEffect(() => {
    const flushOnExit = () => {
      clearTimeout(timer.current);
      if (latest.current === saved.current) {
        return;
      }
      saved.current = latest.current;
      void saveOnExit(widgetId, latest.current as ContentInput);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushOnExit();
      }
    };
    window.addEventListener("pagehide", flushOnExit);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", flushOnExit);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [widgetId]);

  // Unmounting must save the pending edit, not drop it.
  useEffect(
    () => () => {
      void flush();
    },
    [flush]
  );

  let status: SaveStatus = "idle";
  if (isPending) {
    status = "saving";
  } else if (isError) {
    status = "error";
  } else if (isSuccess) {
    status = "saved";
  }
  return { flush, status };
};
