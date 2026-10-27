import { act, render, screen } from "@testing-library/react";
import {
  EMPTY_DOC,
  RichTextEditor,
} from "@trumpet-pods/ui/components/rich-text-editor";
import type { RichTextDoc } from "@trumpet-pods/ui/components/rich-text-editor";
import { expect, it, vi } from "vite-plus/test";

interface MountedEditor {
  commands: { insertContent: (content: string) => boolean };
  getJSON: () => unknown;
  getText: () => string;
}

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
