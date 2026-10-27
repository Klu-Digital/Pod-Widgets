import { QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

vi.mock("@trumpet-pods/ui/components/toast", () => ({
  toastManager: { add: vi.fn(), close: vi.fn(), update: vi.fn() },
}));

const api = vi.hoisted(() => ({
  createWidget: vi.fn(),
  listPages: vi.fn(),
  listWidgets: vi.fn(),
  updateContent: vi.fn(),
}));

vi.mock("@/utils/client", () => ({
  client: {
    audit: { list: vi.fn() },
    pages: { create: vi.fn(), list: api.listPages },
    widgets: {
      create: api.createWidget,
      list: api.listWidgets,
      updateContent: api.updateContent,
    },
  },
}));

// jsdom has no layout, and focusing scrolls the caret into view.
Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
Range.prototype.getBoundingClientRect = () => new DOMRect();
window.scrollTo = vi.fn();

const { WidgetBoard } = await import("@/components/widgets/widget-board");
const { createQueryClient } = await import("@/utils/orpc");

const PAGE_ID = "0190a000-0000-7000-8000-000000000001";
const WIDGET_ID = "0190a000-0000-7000-8000-000000000002";

interface MountedEditor {
  commands: { insertContent: (content: string) => boolean };
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

  fireEvent.click(await screen.findByText("Add text widget"));
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

it("fires no request before an identity exists", async () => {
  renderBoard();

  await act(async () => {
    await Promise.resolve();
  });

  expect(api.listPages).not.toHaveBeenCalled();
  expect(api.listWidgets).not.toHaveBeenCalled();
});
