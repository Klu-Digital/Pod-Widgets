"use client";

import {
  Heading02Icon,
  LeftToRightListBulletIcon,
  TextBoldIcon,
  TextItalicIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { JSONContent, TiptapEditorHTMLElement } from "@tiptap/core";
import { Placeholder } from "@tiptap/extension-placeholder";
import type { EditorView } from "@tiptap/pm/view";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { StarterKit } from "@tiptap/starter-kit";
import { Toggle } from "@trumpet-pods/ui/components/toggle";
import { cn } from "@trumpet-pods/ui/lib/utils";
import { useEffect, useState } from "react";
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
  autoFocus?: boolean;
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
      className="bg-popover text-popover-foreground flex gap-1 rounded-lg border p-1 shadow-md"
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

/**
 * Reads as plain formatted text until clicked or focused, then edits in place.
 * Formatting lives in a menu that floats over the selection.
 */
export const RichTextEditor = ({
  autoFocus,
  value,
  onChange,
  onBlur,
  placeholder = "Add text…",
  "aria-label": ariaLabel,
  className,
}: RichTextEditorProps): React.ReactElement => {
  const [editing, setEditing] = useState(Boolean(autoFocus));
  const startEditing = (view: EditorView) => {
    const { editor: current } = view.dom as TiptapEditorHTMLElement;
    if (current && !current.isEditable) {
      // `false` skips the update event, which would read as an edit to save.
      current.setEditable(true, false);
      setEditing(true);
    }
    return false;
  };
  const editor = useEditor({
    // Seed only at creation: re-seeding on prop change would move the caret.
    // The assertion drops `readonly`; Tiptap never mutates the clone's types.
    content: structuredClone(value) as JSONContent,
    editable: Boolean(autoFocus),
    editorProps: {
      attributes: {
        ...(ariaLabel ? { "aria-label": ariaLabel } : {}),
        class:
          "prose-sm px-3 py-2 outline-none [&_h2]:text-lg [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_p.is-editor-empty:first-child::before]:text-muted-foreground/72 [&_p.is-editor-empty:first-child::before]:pointer-events-none [&_p.is-editor-empty:first-child::before]:float-left [&_p.is-editor-empty:first-child::before]:h-0 [&_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
        role: "textbox",
        // A read-only editor is not focusable on its own; keyboard users tab in.
        tabindex: "0",
      },
      // These run before ProseMirror's own handlers, so the click that
      // switches modes also places the caret where it landed.
      handleDOMEvents: {
        focus: startEditing,
        keydown: (view, event) => {
          if (event.key === "Escape" && view.editable) {
            view.dom.blur();
            return true;
          }
          return false;
        },
        mousedown: startEditing,
      },
    },
    extensions: [
      StarterKit.configure({ heading: { levels: [HEADING_LEVEL] } }),
      Placeholder.configure({ placeholder, showOnlyWhenEditable: false }),
    ],
    immediatelyRender: false,
    onBlur: ({ editor: current }) => {
      current.setEditable(false, false);
      setEditing(false);
      onBlur?.();
    },
    onUpdate: ({ editor: current }) => onChange(current.getJSON()),
    shouldRerenderOnTransaction: false,
  });

  useEffect(() => {
    if (autoFocus && editor) {
      editor.commands.focus();
    }
  }, [autoFocus, editor]);

  return (
    <div
      className={cn(
        "relative rounded-lg border",
        editing
          ? "border-input bg-background text-foreground focus-within:border-ring focus-within:ring-ring/24 focus-within:ring-[3px]"
          : "hover:bg-accent/48 cursor-text border-transparent",
        className
      )}
      data-editing={editing || undefined}
      data-slot="rich-text-editor"
    >
      {editor ? (
        <BubbleMenu
          editor={editor}
          // Keeps focus, and so the selection, in the editor while formatting.
          onMouseDown={(event) => event.preventDefault()}
        >
          <Toolbar editor={editor} />
        </BubbleMenu>
      ) : null}
      <EditorContent editor={editor} />
    </div>
  );
};
