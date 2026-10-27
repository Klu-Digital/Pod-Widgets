import { act, fireEvent, render, screen } from "@testing-library/react";
import {
  EMPTY_DOC,
  RichTextEditor,
} from "@trumpet-pods/ui/components/rich-text-editor";
import type { RichTextDoc } from "@trumpet-pods/ui/components/rich-text-editor";
import { expect, it, vi } from "vite-plus/test";

interface MountedEditor {
  commands: {
    focus: () => boolean;
    insertContent: (content: string) => boolean;
    selectAll: () => boolean;
  };
  getJSON: () => unknown;
  getText: () => string;
}

// jsdom has no layout; ProseMirror maps a mousedown to a position with it.
document.elementFromPoint = () => null;

const paragraph = (text: string): RichTextDoc => ({
  content: [{ content: [{ text, type: "text" }], type: "paragraph" }],
  type: "doc",
});

// Tiptap exposes its instance on the contenteditable element.
const editorOf = (label: string): MountedEditor => {
  const element: Element & { editor?: MountedEditor } =
    screen.getByLabelText(label);
  if (!element.editor) {
    throw new Error(`no editor mounted on ${label}`);
  }
  return element.editor;
};

it("keeps two editors independent and emits JSON docs", async () => {
  const onFirst = vi.fn();
  const onSecond = vi.fn();
  const { rerender } = render(
    <>
      <RichTextEditor aria-label="first" onChange={onFirst} value={EMPTY_DOC} />
      <RichTextEditor
        aria-label="second"
        onChange={onSecond}
        value={paragraph("second")}
      />
    </>
  );
  await screen.findByLabelText("first");
  expect(editorOf("first").getJSON()).toEqual(EMPTY_DOC);

  act(() => {
    editorOf("first").commands.insertContent("hello");
  });

  expect(onSecond).not.toHaveBeenCalled();
  expect(editorOf("second").getText()).toBe("second");
  const [doc] = onFirst.mock.calls.at(-1) ?? [];
  expect(JSON.stringify(doc)).toBe(
    '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"hello"}]}]}'
  );

  rerender(
    <>
      <RichTextEditor
        aria-label="first"
        onChange={onFirst}
        value={paragraph("x")}
      />
      <RichTextEditor
        aria-label="second"
        onChange={onSecond}
        value={EMPTY_DOC}
      />
    </>
  );
  expect(editorOf("first").getText()).toBe("hello");
});

it("reads as text until clicked, then edits with a floating toolbar", async () => {
  render(
    <RichTextEditor
      aria-label="note"
      onChange={vi.fn()}
      value={paragraph("hello")}
    />
  );
  const textbox = await screen.findByLabelText("note");
  expect(textbox).toHaveAttribute("contenteditable", "false");
  expect(textbox).toHaveTextContent("hello");
  expect(screen.queryByRole("toolbar")).not.toBeInTheDocument();

  fireEvent.mouseDown(textbox);
  expect(textbox).toHaveAttribute("contenteditable", "true");

  act(() => {
    editorOf("note").commands.focus();
    editorOf("note").commands.selectAll();
  });
  const toolbar = await screen.findByRole("toolbar", { name: "Formatting" });
  expect(toolbar).toContainElement(
    screen.getByRole("button", { name: "Bold" })
  );

  fireEvent.keyDown(textbox, { key: "Escape" });
  expect(textbox).toHaveAttribute("contenteditable", "false");
});
