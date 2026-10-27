import { QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { toastManager } from "@trumpet-pods/ui/components/toast";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

vi.mock("@trumpet-pods/ui/components/toast", () => ({
  toastManager: { add: vi.fn(), close: vi.fn(), update: vi.fn() },
}));

const api = vi.hoisted(() => ({
  createWidget: vi.fn(),
  deleteWidget: vi.fn(),
  listPages: vi.fn(),
  listWidgets: vi.fn(),
  restoreWidget: vi.fn(),
  updateBanner: vi.fn(),
  updateContent: vi.fn(),
}));

vi.mock("@/utils/client", () => ({
  client: {
    audit: { list: vi.fn() },
    pages: { create: vi.fn(), list: api.listPages },
    widgets: {
      create: api.createWidget,
      delete: api.deleteWidget,
      list: api.listWidgets,
      restore: api.restoreWidget,
      updateBanner: api.updateBanner,
      updateContent: api.updateContent,
    },
  },
}));

// jsdom has no layout, and focusing scrolls the caret into view.
Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
Range.prototype.getBoundingClientRect = () => new DOMRect();
window.scrollTo = vi.fn();
document.elementFromPoint = () => null;

const { WidgetBoard } = await import("@/components/widgets/widget-board");
const { createQueryClient } = await import("@/utils/orpc");

const PAGE_ID = "0190a000-0000-7000-8000-000000000001";
const WIDGET_ID = "0190a000-0000-7000-8000-000000000002";

interface MountedEditor {
  commands: {
    focus: (position: "end") => boolean;
    insertContent: (content: string) => boolean;
  };
}

const editor = (): MountedEditor => {
  const element: Element & { editor?: MountedEditor } =
    screen.getByLabelText("Widget text");
  if (!element.editor) {
    throw new Error("no editor mounted");
  }
  return element.editor;
};

const renderBoard = () => {
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false } });
  render(
    <QueryClientProvider client={queryClient}>
      <WidgetBoard />
    </QueryClientProvider>
  );
};

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  api.listPages.mockResolvedValue([{ id: PAGE_ID, title: "Welcome" }]);
  api.listWidgets.mockResolvedValue([]);
  api.updateContent.mockResolvedValue(null);
  api.deleteWidget.mockResolvedValue(null);
  api.restoreWidget.mockResolvedValue(null);
  api.createWidget.mockResolvedValue({
    content: { content: [{ type: "paragraph" }], type: "doc" },
    createdBy: "Kevin",
    id: WIDGET_ID,
    pageId: PAGE_ID,
    type: "text",
  });
});

afterEach(() => {
  vi.useRealTimers();
});

it("adds a widget and coalesces edits into one save", async () => {
  localStorage.setItem(
    "pod-widgets:identity",
    JSON.stringify({ id: "me", name: "Kevin" })
  );
  renderBoard();

  fireEvent.click(await screen.findByRole("button", { name: "Add widget" }));
  fireEvent.click(await screen.findByRole("menuitem", { name: "Text" }));
  await screen.findByLabelText("Widget text");
  expect(api.createWidget).toHaveBeenCalledWith(
    { pageId: PAGE_ID, type: "text" },
    expect.anything()
  );
  expect(screen.getByText("Created by Kevin")).toBeInTheDocument();

  vi.useFakeTimers();
  for (const text of ["a", "b", "c"]) {
    act(() => {
      editor().commands.insertContent(text);
    });
    await act(() => vi.advanceTimersByTimeAsync(300));
  }
  expect(api.updateContent).not.toHaveBeenCalled();

  await act(() => vi.advanceTimersByTimeAsync(500));
  expect(api.updateContent).toHaveBeenCalledTimes(1);
  expect(api.updateContent.mock.calls[0]?.[0]).toMatchObject({
    content: {
      content: [{ content: [{ text: "abc", type: "text" }] }],
      type: "doc",
    },
    id: WIDGET_ID,
  });
});

it("shows saved widgets as text and edits one in place on click", async () => {
  localStorage.setItem(
    "pod-widgets:identity",
    JSON.stringify({ id: "me", name: "Kevin" })
  );
  api.listWidgets.mockResolvedValue([
    {
      content: {
        content: [
          {
            content: [{ marks: [{ type: "bold" }], text: "hi", type: "text" }],
            type: "paragraph",
          },
        ],
        type: "doc",
      },
      createdBy: "Kevin",
      id: WIDGET_ID,
      pageId: PAGE_ID,
      type: "text",
    },
  ]);
  renderBoard();

  const text = await screen.findByLabelText("Widget text");
  expect(text).toHaveAttribute("contenteditable", "false");
  expect(screen.getByText("hi").tagName).toBe("STRONG");

  fireEvent.mouseDown(text);
  expect(text).toHaveAttribute("contenteditable", "true");
  act(() => {
    editor().commands.focus("end");
    editor().commands.insertContent("!");
  });
  fireEvent.blur(text);

  expect(text).toHaveAttribute("contenteditable", "false");
  expect(text).toHaveTextContent("hi!");
  await waitFor(() => expect(api.updateContent).toHaveBeenCalledTimes(1));
  expect(api.updateContent.mock.calls[0]?.[0]).toMatchObject({ id: WIDGET_ID });
});

it("deletes a widget at once and brings it back with Undo", async () => {
  localStorage.setItem(
    "pod-widgets:identity",
    JSON.stringify({ id: "me", name: "Kevin" })
  );
  api.listWidgets.mockResolvedValue([
    {
      content: { content: [{ type: "paragraph" }], type: "doc" },
      createdBy: "Kevin",
      id: WIDGET_ID,
      pageId: PAGE_ID,
      type: "text",
    },
  ]);
  renderBoard();

  fireEvent.click(await screen.findByLabelText("Delete widget"));
  await waitFor(() => {
    expect(screen.queryByLabelText("Text widget")).not.toBeInTheDocument();
  });
  await waitFor(() => {
    expect(api.deleteWidget).toHaveBeenCalledWith({ id: WIDGET_ID });
  });

  const toast = vi
    .mocked(toastManager.add)
    .mock.calls.map(([options]) => options)
    .find((options) => options.title === "Widget deleted");
  expect(toast).toMatchObject({ timeout: 10_000, title: "Widget deleted" });
  act(() => {
    toast?.actionProps?.onClick?.({} as never);
  });

  await screen.findByLabelText("Text widget");
  expect(api.restoreWidget).toHaveBeenCalledWith({ id: WIDGET_ID });
});

it("adds a banner and switches its variant", async () => {
  localStorage.setItem(
    "pod-widgets:identity",
    JSON.stringify({ id: "me", name: "Kevin" })
  );
  api.createWidget.mockResolvedValue({
    content: { content: [{ type: "paragraph" }], type: "doc" },
    createdBy: "Kevin",
    id: WIDGET_ID,
    pageId: PAGE_ID,
    type: "banner",
    variant: "info",
  });
  api.updateBanner.mockResolvedValue(null);
  renderBoard();

  fireEvent.click(await screen.findByRole("button", { name: "Add widget" }));
  fireEvent.click(await screen.findByRole("menuitem", { name: "Banner" }));
  await screen.findByLabelText("Banner widget");
  expect(api.createWidget).toHaveBeenCalledWith(
    { pageId: PAGE_ID, type: "banner", variant: "info" },
    expect.anything()
  );

  fireEvent.click(screen.getByRole("button", { name: "Warning" }));
  await waitFor(() =>
    expect(api.updateBanner).toHaveBeenCalledWith(
      { id: WIDGET_ID, variant: "warning" },
      expect.anything()
    )
  );
  expect(screen.getByRole("button", { name: "Warning" })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
});

it("fires no request before an identity exists", async () => {
  renderBoard();

  await act(async () => {
    await Promise.resolve();
  });

  expect(api.listPages).not.toHaveBeenCalled();
  expect(api.listWidgets).not.toHaveBeenCalled();
});
