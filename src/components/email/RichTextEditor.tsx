"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Color from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import Link from "@tiptap/extension-link";
import { dataUrlToBlob, formatBytes, uploadFile } from "@/lib/files";
import ImageBase from "@tiptap/extension-image";

// Add width/height attributes so we can resize images in the editor + preserve
// the size when the email is sent.
const Image = ImageBase.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            width: {
                default: null,
                parseHTML: (el) => el.getAttribute("width"),
                renderHTML: (attrs) => {
                    if (!attrs.width) return {};
                    return { width: attrs.width, style: `width:${attrs.width}px;height:auto` };
                },
            },
            height: {
                default: null,
                parseHTML: (el) => el.getAttribute("height"),
                renderHTML: (attrs) => (attrs.height ? { height: attrs.height } : {}),
            },
        };
    },
});
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import { PlaceholderHighlight } from "@/lib/editor/placeholder-highlight";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    Bold, Italic, Underline as UnderlineIcon, Strikethrough,
    AlignLeft, AlignCenter, AlignRight,
    List, ListOrdered, Link as LinkIcon, Image as ImageIcon,
    Undo2, Redo2, Smile, Paperclip, Trash2, PenTool, Lock, MoreVertical, Type, Table as TableIcon, Maximize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
    Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** Shared classes for the editable area: placeholder text + wrap long words/URLs instead of overflowing. */
const EDITOR_CONTENT_CLASSES =
    "[&_.tiptap]:outline-none [&_.tiptap]:[overflow-wrap:anywhere] " +
    "[&_.tiptap_p.is-empty::before]:text-muted-foreground/50 [&_.tiptap_p.is-empty::before]:content-[attr(data-placeholder)] " +
    "[&_.tiptap_p.is-empty::before]:pointer-events-none [&_.tiptap_p.is-empty::before]:float-left [&_.tiptap_p.is-empty::before]:h-0";

const textColors = [
    { name: "Black", value: "#000000" },
    { name: "Dark Gray", value: "#4B5563" },
    { name: "Red", value: "#DC2626" },
    { name: "Orange", value: "#EA580C" },
    { name: "Yellow", value: "#CA8A04" },
    { name: "Green", value: "#16A34A" },
    { name: "Blue", value: "#2563EB" },
    { name: "Purple", value: "#9333EA" },
    { name: "Pink", value: "#DB2777" },
];

const emojiCategories = [
    { name: "Smileys", emojis: ["😀","😃","😄","😁","😅","😂","🤣","😊","😇","🙂","😉","😍","🥰","😘","😋","😛","🤔","🤨","😐","😑","😶","🙄","😏","😣","😥","😮","🤐","😯","😪","😫","🥱","😴","😌","😷","🤒","🤕"] },
    { name: "Gestures", emojis: ["👋","🤚","🖐️","✋","🖖","👌","🤌","🤏","✌️","🤞","🤟","🤘","🤙","👈","👉","👆","👇","☝️","👍","👎","✊","👊","🤛","🤜","👏","🙌","👐","🤲","🤝","🙏"] },
    { name: "Hearts", emojis: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖","💘","💝","💟"] },
    { name: "Celebrations", emojis: ["🎉","🎊","🎈","🎁","🎀","🎂","🍰","🧁","🥳","🎄","🎃","🎆","🎇","✨","🎏","🎐","🎑","🎋","🎍"] },
    { name: "Objects", emojis: ["📧","✉️","📩","📨","📤","📥","📦","📫","📪","📬","📭","📮","📝","💼","📁","📂","📅","📆","📌","📍","📎","🔗","📐","📏","✂️","🔒","🔓","🔑"] },
    { name: "Symbols", emojis: ["✅","❌","⭕","❗","❓","‼️","⁉️","💯","🔴","🟠","🟡","🟢","🔵","🟣","⚫","⚪","🟤","▶️","⏸️","⏹️","⏺️","⏭️","⏮️","🔀","🔁","🔂"] },
];

export interface Attachment {
    name: string;
    size: string;
    type: string;
    isImage?: boolean;
    preview?: string;
    /** Server file id (POST /api/files); only uploaded files are sent with the email. */
    id?: string;
}

interface RichTextEditorProps {
    content?: string;
    onChange?: (html: string) => void;
    placeholder?: string;
    attachments?: Attachment[];
    onAttachmentsChange?: (attachments: Attachment[]) => void;
    minHeight?: string;
    showAttachments?: boolean;
    onInsertSignature?: () => void;
    /** Fires once the underlying Tiptap editor is ready — lets the parent call commands like insertContent. */
    onReady?: (editor: Editor) => void;
    /** Compact mode: thin single-row toolbar with only the essentials (bold/italic/lists/link). */
    compact?: boolean;
    /** Grow to fill the parent (a flex column); the writing area takes all spare height. */
    fill?: boolean;
}

/**
 * Resize an image client-side to keep the resulting base64 string compact.
 * Preserves PNG (with transparency) or JPEG depending on source MIME type.
 * Large photos drop from MBs to KBs; tiny logos pass through largely untouched.
 */
async function compressImage(file: File, maxWidth = 1200, quality = 0.85): Promise<string> {
    const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("File read failed"));
        reader.readAsDataURL(file);
    });

    return new Promise<string>((resolve, reject) => {
        const img = new window.Image();
        img.onload = () => {
            let { width, height } = img;
            if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
            }
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
                reject(new Error("Canvas context unavailable"));
                return;
            }
            ctx.drawImage(img, 0, 0, width, height);
            // PNG keeps transparency (good for logos); JPEG is smaller for photos.
            const isPng = file.type === "image/png";
            const outType = isPng ? "image/png" : "image/jpeg";
            resolve(isPng ? canvas.toDataURL(outType) : canvas.toDataURL(outType, quality));
        };
        img.onerror = () => reject(new Error("Image decode failed"));
        img.src = dataUrl;
    });
}

function ToolbarBtn({
    onClick, isActive, tooltip, children,
}: {
    onClick: () => void; isActive?: boolean; tooltip: string; children: React.ReactNode;
}) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn("h-7 w-7", isActive && "bg-accent text-accent-foreground")}
                    onClick={onClick}
                    onMouseDown={(e) => e.preventDefault()}
                >
                    {children}
                </Button>
            </TooltipTrigger>
            <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
    );
}

export function RichTextEditor({
    content = "",
    onChange,
    placeholder = 'Write your email content here. Use {{variable}} for placeholders...',
    attachments = [],
    onAttachmentsChange,
    minHeight = "200px",
    showAttachments = true,
    onInsertSignature,
    onReady,
    compact = false,
    fill = false,
}: RichTextEditorProps) {
    const imageInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(0);

    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit,
            Underline,
            TextAlign.configure({ types: ["heading", "paragraph"] }),
            TextStyle,
            Color,
            Link.configure({
                openOnClick: false,
                HTMLAttributes: { class: "sd-editor-link", title: "Ctrl+Click to open" },
            }),
            Image.configure({ inline: true }),
            Table.configure({ resizable: true, HTMLAttributes: { class: "sd-editor-table" } }),
            TableRow,
            TableHeader,
            TableCell,
            PlaceholderHighlight,
        ],
        content,
        editorProps: {
            attributes: {
                class: "outline-none px-4 py-3 text-sm prose prose-sm dark:prose-invert max-w-none",
                "data-placeholder": placeholder,
            },
            handleDOMEvents: {
                // Ctrl+Click (or Cmd+Click on Mac) on a link opens it in a new tab.
                // Regular click stays in the editor for cursor placement.
                click(_view, event) {
                    if (!(event.ctrlKey || event.metaKey)) return false;
                    const target = event.target as HTMLElement | null;
                    const anchor = target?.closest("a") as HTMLAnchorElement | null;
                    if (!anchor?.href) return false;
                    window.open(anchor.href, "_blank", "noopener,noreferrer");
                    event.preventDefault();
                    return true;
                },
            },
        },
        onUpdate: ({ editor }) => {
            onChange?.(editor.getHTML());
        },
    });

    // Notify the parent when the editor instance is ready
    useEffect(() => {
        if (editor && onReady) onReady(editor);
    }, [editor, onReady]);

    const handleInsertLink = useCallback(() => {
        const url = window.prompt("Enter URL:");
        if (url && editor) {
            editor.chain().focus().setLink({ href: url }).run();
        }
    }, [editor]);

    const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file || !editor) return;
        if (!file.type.startsWith("image/")) return;
        if (file.size > 5 * 1024 * 1024) { alert("Image must be under 5MB."); return; }

        setUploading((n) => n + 1);
        try {
            // Resize + compress, then store it on the server. The body keeps a short
            // /api/files URL; at send time it's attached inline so recipients see it.
            // A 4000×3000 phone photo (~3MB) becomes ~120KB after this pass.
            const compressedSrc = await compressImage(file, 1200, 0.85);
            const blob = await dataUrlToBlob(compressedSrc);
            const uploaded = await uploadFile(blob, file.name);
            editor.chain().focus().setImage({ src: uploaded.url, width: 200 } as { src: string }).run();
        } catch (err) {
            console.error("Image upload failed", err);
            alert(err instanceof Error ? `Couldn't add that image: ${err.message}` : "Couldn't add that image. Try a different file.");
        } finally {
            setUploading((n) => n - 1);
        }
    }, [editor]);

    const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files ? Array.from(e.target.files) : [];
        e.target.value = "";
        if (!files.length || !onAttachmentsChange) return;

        const added: Attachment[] = [];
        setUploading((n) => n + 1);
        try {
            for (const file of files) {
                if (file.size > 10 * 1024 * 1024) { alert(`"${file.name}" exceeds 10MB.`); continue; }
                try {
                    const uploaded = await uploadFile(file, file.name);
                    added.push({
                        id: uploaded.id,
                        name: uploaded.filename,
                        size: formatBytes(uploaded.size),
                        type: uploaded.contentType,
                        isImage: uploaded.contentType.startsWith("image/"),
                        preview: uploaded.contentType.startsWith("image/") ? uploaded.url : undefined,
                    });
                } catch (err) {
                    alert(`Couldn't attach "${file.name}": ${err instanceof Error ? err.message : String(err)}`);
                }
            }
        } finally {
            setUploading((n) => n - 1);
        }
        if (added.length) onAttachmentsChange([...attachments, ...added]);
    }, [attachments, onAttachmentsChange]);

    const removeAttachment = useCallback((index: number) => {
        onAttachmentsChange?.(attachments.filter((_, i) => i !== index));
    }, [attachments, onAttachmentsChange]);

    if (!editor) return null;

    // ─── Compact toolbar (for template editor) ────────────────────────────
    if (compact) {
        return (
            <TooltipProvider delayDuration={300}>
                <div className="h-full min-h-0 rounded-lg border border-border bg-card flex flex-col overflow-hidden">
                    <div className="flex shrink-0 items-center gap-0.5 px-2 py-1 border-b border-border bg-muted/40">
                        <ToolbarBtn onClick={() => editor.chain().focus().undo().run()} tooltip="Undo">
                            <Undo2 className="h-3.5 w-3.5" />
                        </ToolbarBtn>
                        <ToolbarBtn onClick={() => editor.chain().focus().redo().run()} tooltip="Redo">
                            <Redo2 className="h-3.5 w-3.5" />
                        </ToolbarBtn>
                        <span className="w-px h-4 bg-border mx-1" aria-hidden="true" />
                        <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive("bold")} tooltip="Bold (Ctrl+B)">
                            <Bold className="h-3.5 w-3.5" />
                        </ToolbarBtn>
                        <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive("italic")} tooltip="Italic (Ctrl+I)">
                            <Italic className="h-3.5 w-3.5" />
                        </ToolbarBtn>
                        <ToolbarBtn onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive("underline")} tooltip="Underline (Ctrl+U)">
                            <UnderlineIcon className="h-3.5 w-3.5" />
                        </ToolbarBtn>
                        <span className="w-px h-4 bg-border mx-1" aria-hidden="true" />
                        <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive("bulletList")} tooltip="Bullet list">
                            <List className="h-3.5 w-3.5" />
                        </ToolbarBtn>
                        <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive("orderedList")} tooltip="Numbered list">
                            <ListOrdered className="h-3.5 w-3.5" />
                        </ToolbarBtn>
                        <span className="w-px h-4 bg-border mx-1" aria-hidden="true" />
                        <ToolbarBtn onClick={handleInsertLink} tooltip="Insert link (Ctrl+K)">
                            <LinkIcon className="h-3.5 w-3.5" />
                        </ToolbarBtn>
                        <ToolbarBtn onClick={() => editor.chain().focus().unsetAllMarks().run()} tooltip="Clear formatting">
                            <span className="font-serif text-[10px] font-medium">Aa</span>
                        </ToolbarBtn>
                    </div>
                    {/* Native scroll (not Radix ScrollArea): its display:table wrapper stops long words from wrapping */}
                    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
                        <EditorContent
                            editor={editor}
                            className={cn(EDITOR_CONTENT_CLASSES, "h-full [&_.tiptap]:min-h-full")}
                        />
                    </div>
                </div>
            </TooltipProvider>
        );
    }

    return (
        <TooltipProvider delayDuration={300}>
            <div className={cn("rounded-lg border border-border bg-card flex flex-col overflow-hidden", fill && "flex-1")}>

                {/* ─── Single-row toolbar (grouped: history · text · alignment · lists · insert · clear) */}
                <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border bg-muted/40 flex-wrap">
                    {/* History */}
                    <ToolbarBtn onClick={() => editor.chain().focus().undo().run()} tooltip="Undo (Ctrl+Z)">
                        <Undo2 className="h-4 w-4" />
                    </ToolbarBtn>
                    <ToolbarBtn onClick={() => editor.chain().focus().redo().run()} tooltip="Redo (Ctrl+Shift+Z)">
                        <Redo2 className="h-4 w-4" />
                    </ToolbarBtn>

                    <Separator orientation="vertical" className="h-5 mx-1" />

                    {/* Text style */}
                    <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive("bold")} tooltip="Bold (Ctrl+B)">
                        <Bold className="h-4 w-4" />
                    </ToolbarBtn>
                    <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive("italic")} tooltip="Italic (Ctrl+I)">
                        <Italic className="h-4 w-4" />
                    </ToolbarBtn>
                    <ToolbarBtn onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive("underline")} tooltip="Underline (Ctrl+U)">
                        <UnderlineIcon className="h-4 w-4" />
                    </ToolbarBtn>

                    {/* Text color */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onMouseDown={(e) => e.preventDefault()}>
                                        <span className="text-sm font-bold underline decoration-red-500 decoration-2 leading-none">A</span>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Text color</TooltipContent>
                            </Tooltip>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-2" align="start">
                            <div className="grid grid-cols-5 gap-1">
                                {textColors.map((c) => (
                                    <button
                                        key={c.value}
                                        type="button"
                                        className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform"
                                        style={{ backgroundColor: c.value }}
                                        onClick={() => editor.chain().focus().setColor(c.value).run()}
                                        title={c.name}
                                    />
                                ))}
                            </div>
                        </PopoverContent>
                    </Popover>

                    <Separator orientation="vertical" className="h-5 mx-1" />

                    {/* Alignment */}
                    <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign("left").run()} isActive={editor.isActive({ textAlign: "left" })} tooltip="Align left">
                        <AlignLeft className="h-4 w-4" />
                    </ToolbarBtn>
                    <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign("center").run()} isActive={editor.isActive({ textAlign: "center" })} tooltip="Align center">
                        <AlignCenter className="h-4 w-4" />
                    </ToolbarBtn>
                    <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign("right").run()} isActive={editor.isActive({ textAlign: "right" })} tooltip="Align right">
                        <AlignRight className="h-4 w-4" />
                    </ToolbarBtn>

                    <Separator orientation="vertical" className="h-5 mx-1" />

                    {/* Lists */}
                    <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive("bulletList")} tooltip="Bullet list">
                        <List className="h-4 w-4" />
                    </ToolbarBtn>
                    <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive("orderedList")} tooltip="Numbered list">
                        <ListOrdered className="h-4 w-4" />
                    </ToolbarBtn>

                    <Separator orientation="vertical" className="h-5 mx-1" />

                    {/* Insert: link, image, image-resize, table */}
                    <ToolbarBtn onClick={handleInsertLink} tooltip="Insert link (Ctrl+K)">
                        <LinkIcon className="h-4 w-4" />
                    </ToolbarBtn>

                    <ToolbarBtn onClick={() => imageInputRef.current?.click()} tooltip="Insert image">
                        <ImageIcon className="h-4 w-4" />
                    </ToolbarBtn>

                    {/* Image resize — contextual: enabled only when an image is selected */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onMouseDown={(e) => e.preventDefault()}
                                        disabled={!editor.isActive("image")}
                                    >
                                        <Maximize2 className="h-3.5 w-3.5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>{editor.isActive("image") ? "Resize image" : "Click an image first"}</TooltipContent>
                            </Tooltip>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-1.5" align="start">
                            <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground px-2 pt-1 pb-1.5">Image size</p>
                            <div className="grid grid-cols-4 gap-1 px-1.5">
                                {[100, 150, 200, 300].map((px) => (
                                    <button
                                        key={px}
                                        type="button"
                                        onClick={() => editor.chain().focus().updateAttributes("image", { width: px }).run()}
                                        className="text-[11px] py-1.5 rounded-md border border-border hover:bg-accent hover:border-primary/40 transition-colors tabular-nums"
                                    >
                                        {px}px
                                    </button>
                                ))}
                            </div>
                            <button
                                type="button"
                                onClick={() => editor.chain().focus().updateAttributes("image", { width: null }).run()}
                                className="w-full text-[11px] py-1.5 mt-1 rounded-md hover:bg-accent transition-colors"
                            >
                                Reset to original
                            </button>
                            <div className="my-1 border-t border-border" />
                            <div className="flex items-center gap-2 px-2 py-1.5">
                                <span className="text-[11px] text-muted-foreground">Custom</span>
                                <input
                                    type="number"
                                    min={20}
                                    max={1000}
                                    placeholder="px"
                                    defaultValue={editor.getAttributes("image").width ?? ""}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            const v = parseInt((e.target as HTMLInputElement).value, 10);
                                            if (!isNaN(v) && v > 0) editor.chain().focus().updateAttributes("image", { width: v }).run();
                                        }
                                    }}
                                    className="flex-1 h-7 px-2 text-xs border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring tabular-nums"
                                />
                                <span className="text-[11px] text-muted-foreground">px</span>
                            </div>
                        </PopoverContent>
                    </Popover>

                    {/* Table — insert + when in table, manage rows/cols */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onMouseDown={(e) => e.preventDefault()}>
                                        <TableIcon className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Insert / edit table</TooltipContent>
                            </Tooltip>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-1.5" align="start">
                            <button type="button" className="w-full text-left px-2 py-1.5 text-xs hover:bg-accent rounded-sm transition-colors flex items-center gap-2"
                                onClick={() => editor.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: false }).run()}>
                                <span className="inline-block w-4 h-4 grid grid-cols-2 gap-px bg-border rounded-sm overflow-hidden">
                                    <span className="bg-card" /><span className="bg-card" /><span className="bg-card" /><span className="bg-card" />
                                </span>
                                Insert 2 × 2 table
                            </button>
                            <button type="button" className="w-full text-left px-2 py-1.5 text-xs hover:bg-accent rounded-sm transition-colors flex items-center gap-2"
                                onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
                                <span className="inline-block w-4 h-4 grid grid-cols-3 grid-rows-3 gap-px bg-border rounded-sm overflow-hidden">
                                    {Array.from({ length: 9 }).map((_, i) => <span key={i} className="bg-card" />)}
                                </span>
                                Insert 3 × 3 with header
                            </button>
                            <div className="my-1 border-t border-border" />
                            <button type="button" disabled={!editor.can().addColumnAfter()} className="w-full text-left px-2 py-1.5 text-xs hover:bg-accent rounded-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                onClick={() => editor.chain().focus().addColumnAfter().run()}>+ Column after</button>
                            <button type="button" disabled={!editor.can().addRowAfter()} className="w-full text-left px-2 py-1.5 text-xs hover:bg-accent rounded-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                onClick={() => editor.chain().focus().addRowAfter().run()}>+ Row after</button>
                            <button type="button" disabled={!editor.can().deleteRow()} className="w-full text-left px-2 py-1.5 text-xs hover:bg-accent rounded-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-destructive hover:text-destructive"
                                onClick={() => editor.chain().focus().deleteRow().run()}>− Delete row</button>
                            <button type="button" disabled={!editor.can().deleteColumn()} className="w-full text-left px-2 py-1.5 text-xs hover:bg-accent rounded-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-destructive hover:text-destructive"
                                onClick={() => editor.chain().focus().deleteColumn().run()}>− Delete column</button>
                            <button type="button" disabled={!editor.can().deleteTable()} className="w-full text-left px-2 py-1.5 text-xs hover:bg-accent rounded-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-destructive hover:text-destructive"
                                onClick={() => editor.chain().focus().deleteTable().run()}>Delete table</button>
                        </PopoverContent>
                    </Popover>

                    {/* Attach file (compose only) */}
                    {showAttachments && (
                        <ToolbarBtn onClick={() => fileInputRef.current?.click()} tooltip="Attach file">
                            <Paperclip className="h-4 w-4" />
                        </ToolbarBtn>
                    )}

                    {/* Insert signature (compose only — appears when callback wired up) */}
                    {onInsertSignature && (
                        <ToolbarBtn onClick={onInsertSignature} tooltip="Insert signature">
                            <PenTool className="h-3.5 w-3.5" />
                        </ToolbarBtn>
                    )}

                    <Separator orientation="vertical" className="h-5 mx-1" />

                    {/* Clear formatting */}
                    <ToolbarBtn onClick={() => editor.chain().focus().unsetAllMarks().run()} tooltip="Clear formatting">
                        <span className="font-serif font-medium text-xs">Aa</span>
                    </ToolbarBtn>

                    {/* Hidden file inputs */}
                    <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    {showAttachments && (
                        <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,image/*" className="hidden" onChange={handleFileUpload} multiple />
                    )}
                </div>

                {/* Editor area */}
                <div className={cn("flex-1 overflow-x-hidden", fill && "flex flex-col")} style={{ minHeight }}>
                    <EditorContent
                        editor={editor}
                        className={cn(
                            EDITOR_CONTENT_CLASSES,
                            "min-h-[inherit] [&_.tiptap]:min-h-[inherit]",
                            // the whole box is clickable/typeable, not just the first 240px
                            fill && "flex flex-1 flex-col [&_.tiptap]:flex-1"
                        )}
                    />
                </div>

                {uploading > 0 && (
                    <div className="border-t px-3 py-1.5 text-xs text-muted-foreground bg-muted/20">Uploading…</div>
                )}

                {/* Attachments */}
                {showAttachments && attachments.length > 0 && (
                    <div className="border-t p-2 bg-muted/20">
                        <p className="text-xs text-muted-foreground mb-2">Attachments ({attachments.length})</p>
                        <div className="flex flex-wrap gap-2">
                            {attachments.map((att, i) => (
                                <div key={i} className="flex items-center gap-2 bg-background border rounded-md px-2 py-1 text-xs">
                                    {att.isImage && att.preview
                                        ? <img src={att.preview} alt={att.name} className="h-8 w-8 object-cover rounded" />
                                        : <Paperclip className="h-3 w-3 text-muted-foreground" />}
                                    <span className="max-w-[120px] truncate" title={att.name}>{att.name}</span>
                                    <span className="text-muted-foreground">({att.size})</span>
                                    <button type="button" onClick={() => removeAttachment(i)} className="text-muted-foreground hover:text-destructive transition-colors">
                                        <Trash2 className="h-3 w-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </TooltipProvider>
    );
}
