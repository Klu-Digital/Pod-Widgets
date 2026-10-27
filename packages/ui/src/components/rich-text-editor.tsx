"use client";

import {
  Heading02Icon,
  LeftToRightListBulletIcon,
  TextBoldIcon,
  TextItalicIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { JSONContent } from "@tiptap/core";
import { Placeholder } from "@tiptap/extension-placeholder";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { Toggle } from "@trumpet-pods/ui/components/toggle";
import { cn } from "@trumpet-pods/ui/lib/utils";
import type React from "react";

/** Plain ProseMirror JSON, so consumers need no Tiptap import to store it. */
export interface RichTextDoc {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: readonly RichTextDoc[];
  marks?: readonly { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
}

/** The DB default for rich text columns; keep in sync with ticket #10. */
export const EMPTY_DOC = {
  content: [{ type: "paragraph" }],
  type: "doc",
} as const satisfies RichTextDoc;

const HEADING_LEVEL = 2;

export interface RichTextEditorProps {
  value: RichTextDoc;
  onChange: (doc: RichTextDoc) => void;
  onBlur?: () => void;
  placeholder?: string;
  "aria-label"?: string;
  className?: string;
}

const Toolbar = ({ editor }: { editor: Editor }): React.ReactElement => {
  const active = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current.isActive("bold"),
      bulletList: current.isActive("bulletList"),
      heading: current.isActive("heading", { level: HEADING_LEVEL }),
      italic: current.isActive("italic"),
    }),
  });

  return (
    <div
      aria-label="Formatting"
      className="flex gap-1 border-b p-1"
      role="toolbar"
    >
      <Toggle
        aria-label="Bold"
        onPressedChange={() => editor.chain().focus().toggleBold().run()}
        pressed={active.bold}
        size="sm"
      >
        <HugeiconsIcon icon={TextBoldIcon} />
      </Toggle>
      <Toggle
        aria-label="Italic"
        onPressedChange={() => editor.chain().focus().toggleItalic().run()}
        pressed={active.italic}
        size="sm"
      >
        <HugeiconsIcon icon={TextItalicIcon} />
      </Toggle>
      <Toggle
        aria-label="Bullet list"
        onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
        pressed={active.bulletList}
        size="sm"
      >
        <HugeiconsIcon icon={LeftToRightListBulletIcon} />
      </Toggle>
      <Toggle
        aria-label="Heading"
        onPressedChange={() =>
          editor.chain().focus().toggleHeading({ level: HEADING_LEVEL }).run()
        }
        pressed={active.heading}
        size="sm"
      >
        <HugeiconsIcon icon={Heading02Icon} />
      </Toggle>
    </div>
  );
};

export const RichTextEditor = ({
  value,
  onChange,
  onBlur,
  placeholder,
  "aria-label": ariaLabel,
  className,
}: RichTextEditorProps): React.ReactElement => {
  const editor = useEditor({
    // Seed only at creation: re-seeding on prop change would move the caret.
    // The assertion drops `readonly`; Tiptap never mutates the clone's types.
    content: structuredClone(value) as JSONContent,
    editorProps: {
      attributes: {
        ...(ariaLabel ? { "aria-label": ariaLabel } : {}),
        class:
          "prose-sm min-h-24 px-3 py-2 outline-none [&_h2]:text-lg [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_p.is-editor-empty:first-child::before]:text-muted-foreground/72 [&_p.is-editor-empty:first-child::before]:pointer-events-none [&_p.is-editor-empty:first-child::before]:float-left [&_p.is-editor-empty:first-child::before]:h-0 [&_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
        role: "textbox",
      },
    },
    extensions: [
      StarterKit.configure({ heading: { levels: [HEADING_LEVEL] } }),
      Placeholder.configure({ placeholder }),
    ],
    immediatelyRender: false,
    onBlur: () => onBlur?.(),
    onUpdate: ({ editor: current }) => onChange(current.getJSON()),
    shouldRerenderOnTransaction: false,
  });

  return (
    <div
      className={cn(
        "border-input bg-background text-foreground focus-within:border-ring focus-within:ring-ring/24 rounded-lg border focus-within:ring-[3px]",
        className
      )}
      data-slot="rich-text-editor"
    >
      {editor ? <Toolbar editor={editor} /> : null}
      <EditorContent editor={editor} />
    </div>
  );
};
