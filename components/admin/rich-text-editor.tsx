"use client"

import { useEffect } from "react"
import { EditorContent, useEditor, useEditorState } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { Bold, Heading2, Heading3, Italic, Link2, List, ListOrdered, Quote, Redo2, Undo2, Unlink } from "lucide-react"
import { cn } from "@/lib/utils"
import type { RichDoc } from "@/lib/cms/fields"

// Rich-text editing for blog posts and long copy. The output is TipTap JSON limited to what the
// site renders (components/cms/rich-text.tsx): headings, paragraphs, lists, quotes, bold, italic, links.

const extensions = [
  StarterKit.configure({
    heading: { levels: [2, 3] },
    code: false,
    codeBlock: false,
    strike: false,
    underline: false,
    link: { openOnClick: false, autolink: true, protocols: ["http", "https", "mailto", "tel"], HTMLAttributes: { rel: "noopener noreferrer", target: null } },
  }),
]

export function RichTextEditor({ value, onChange, urdu, disabled }: { value: RichDoc | undefined; onChange: (v: RichDoc) => void; urdu?: boolean; disabled?: boolean }) {
  const editor = useEditor({
    extensions,
    content: value ?? { type: "doc", content: [] },
    editable: !disabled,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        dir: urdu ? "rtl" : "ltr",
        lang: urdu ? "ur" : "en",
        class: cn("prose-cms min-h-40 px-4 py-3 outline-none", urdu && "font-urdu text-[15px] leading-loose"),
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getJSON() as RichDoc),
  })

  // Outside changes (restoring a version) replace the content.
  useEffect(() => {
    if (!editor || !value) return
    if (JSON.stringify(editor.getJSON()) !== JSON.stringify(value)) editor.commands.setContent(value, { emitUpdate: false })
  }, [editor, value])
  useEffect(() => {
    editor?.setEditable(!disabled)
  }, [editor, disabled])

  const s = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            h2: e.isActive("heading", { level: 2 }),
            h3: e.isActive("heading", { level: 3 }),
            bold: e.isActive("bold"),
            italic: e.isActive("italic"),
            bullet: e.isActive("bulletList"),
            ordered: e.isActive("orderedList"),
            quote: e.isActive("blockquote"),
            link: e.isActive("link"),
            undo: e.can().undo(),
            redo: e.can().redo(),
          }
        : null,
  })

  const tool = (label: string, Icon: typeof Bold, active: boolean | undefined, run: () => void, enabled = true) => (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled || !enabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={run}
      className={cn("grid h-8 w-8 place-items-center rounded-lg text-zinc-600 hover:bg-zinc-100 disabled:opacity-40", active && "bg-foreground text-background hover:bg-foreground")}
    >
      <Icon className="w-4 h-4" />
    </button>
  )

  const setLink = () => {
    if (!editor) return
    const prev = editor.getAttributes("link").href as string | undefined
    const url = window.prompt("Link to (a page like /services or a full https:// address)", prev ?? "")
    if (url === null) return
    if (!url.trim()) editor.chain().focus().extendMarkRange("link").unsetLink().run()
    else editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run()
  }

  return (
    <div className={cn("rounded-xl border border-zinc-300 bg-white focus-within:border-foreground", disabled && "bg-zinc-50")}>
      {!disabled && editor && (
        <div className="flex flex-wrap items-center gap-0.5 border-b border-zinc-200 px-1.5 py-1">
          {tool("Heading", Heading2, s?.h2, () => editor.chain().focus().toggleHeading({ level: 2 }).run())}
          {tool("Subheading", Heading3, s?.h3, () => editor.chain().focus().toggleHeading({ level: 3 }).run())}
          <span className="mx-1 h-5 w-px bg-zinc-200" />
          {tool("Bold", Bold, s?.bold, () => editor.chain().focus().toggleBold().run())}
          {tool("Italic", Italic, s?.italic, () => editor.chain().focus().toggleItalic().run())}
          {tool(s?.link ? "Edit link" : "Add link", Link2, s?.link, setLink)}
          {s?.link && tool("Remove link", Unlink, false, () => editor.chain().focus().extendMarkRange("link").unsetLink().run())}
          <span className="mx-1 h-5 w-px bg-zinc-200" />
          {tool("Bulleted list", List, s?.bullet, () => editor.chain().focus().toggleBulletList().run())}
          {tool("Numbered list", ListOrdered, s?.ordered, () => editor.chain().focus().toggleOrderedList().run())}
          {tool("Quote", Quote, s?.quote, () => editor.chain().focus().toggleBlockquote().run())}
          <span className="ml-auto" />
          {tool("Undo", Undo2, false, () => editor.chain().focus().undo().run(), s?.undo)}
          {tool("Redo", Redo2, false, () => editor.chain().focus().redo().run(), s?.redo)}
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  )
}
