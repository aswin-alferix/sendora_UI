"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
    FileText,
    Undo2,
    Redo2,
    Bold,
    Italic,
    Underline,
    AlignLeft,
    AlignCenter,
    AlignRight,
    List,
    ListOrdered,
    Link,
    Smile,
    Image,
    Lock,
    PenTool,
    MoreVertical,
    Trash2,
    Type,
    Strikethrough,
    Paperclip,
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface TemplateData {
    id?: string;
    name: string;
    subject: string;
    description: string;
    body?: string;
}

interface CreateTemplateDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (template: {
        id?: string;
        name: string;
        subject: string;
        description: string;
        body: string;
    }) => void;
    editTemplate?: TemplateData | null;
}

const fontFamilies = {
    "sans-serif": "ui-sans-serif, system-ui, sans-serif",
    "serif": "ui-serif, Georgia, serif",
    "monospace": "ui-monospace, monospace",
};

const fontSizes = {
    small: "12px",
    normal: "14px",
    large: "18px",
    huge: "24px",
};

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
    {
        name: "Smileys",
        emojis: ["😀", "😃", "😄", "😁", "😅", "😂", "🤣", "😊", "😇", "🙂", "😉", "😍", "🥰", "😘", "😋", "😛", "🤔", "🤨", "😐", "😑", "😶", "🙄", "😏", "😣", "😥", "😮", "🤐", "😯", "😪", "😫", "🥱", "😴", "😌", "😷", "🤒", "🤕"],
    },
    {
        name: "Gestures",
        emojis: ["👋", "🤚", "🖐️", "✋", "🖖", "👌", "🤌", "🤏", "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆", "👇", "☝️", "👍", "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌", "👐", "🤲", "🤝", "🙏"],
    },
    {
        name: "Hearts",
        emojis: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟"],
    },
    {
        name: "Celebrations",
        emojis: ["🎉", "🎊", "🎈", "🎁", "🎀", "🎂", "🍰", "🧁", "🥳", "🎄", "🎃", "🎆", "🎇", "✨", "🎏", "🎐", "🎑", "🎋", "🎍"],
    },
    {
        name: "Objects",
        emojis: ["📧", "✉️", "📩", "📨", "📤", "📥", "📦", "📫", "📪", "📬", "📭", "📮", "📝", "💼", "📁", "📂", "📅", "📆", "📌", "📍", "📎", "🔗", "📐", "📏", "✂️", "🔒", "🔓", "🔑"],
    },
    {
        name: "Symbols",
        emojis: ["✅", "❌", "⭕", "❗", "❓", "‼️", "⁉️", "💯", "🔴", "🟠", "🟡", "🟢", "🔵", "🟣", "⚫", "⚪", "🟤", "▶️", "⏸️", "⏹️", "⏺️", "⏭️", "⏮️", "🔀", "🔁", "🔂"],
    },
];

export const CreateTemplateDialog = ({
    open,
    onOpenChange,
    onSubmit,
    editTemplate,
}: CreateTemplateDialogProps) => {
    const isEditMode = !!editTemplate;
    const [name, setName] = useState("");
    const [subject, setSubject] = useState("");
    const [description, setDescription] = useState("");
    const [body, setBody] = useState("");
    const editorRef = useRef<HTMLDivElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());
    const [attachments, setAttachments] = useState<Array<{ name: string; size: string; type: string; isImage?: boolean; preview?: string }>>([]);

    // Check active formats when selection changes
    const checkActiveFormats = useCallback(() => {
        const formats = new Set<string>();
        if (document.queryCommandState("bold")) formats.add("bold");
        if (document.queryCommandState("italic")) formats.add("italic");
        if (document.queryCommandState("underline")) formats.add("underline");
        if (document.queryCommandState("strikeThrough")) formats.add("strikethrough");
        if (document.queryCommandState("insertOrderedList")) formats.add("orderedList");
        if (document.queryCommandState("insertUnorderedList")) formats.add("unorderedList");
        setActiveFormats(formats);
    }, []);

    // Format command helper
    const execCommand = useCallback((command: string, value?: string) => {
        editorRef.current?.focus();
        document.execCommand(command, false, value);
        checkActiveFormats();
        // Update body state
        if (editorRef.current) {
            setBody(editorRef.current.innerHTML);
        }
    }, [checkActiveFormats]);

    // Toolbar button component
    const ToolbarButton = ({
        onClick,
        isActive,
        tooltip,
        children,
    }: {
        onClick: () => void;
        isActive?: boolean;
        tooltip: string;
        children: React.ReactNode;
    }) => (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn("h-7 w-7", isActive && "bg-accent text-accent-foreground")}
                    onClick={onClick}
                    onMouseDown={(e) => e.preventDefault()} // Prevent focus loss
                >
                    {children}
                </Button>
            </TooltipTrigger>
            <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
    );

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({ id: editTemplate?.id, name, subject, description, body });
        onOpenChange(false);
    };

    const handleClear = () => {
        setBody("");
        if (editorRef.current) {
            editorRef.current.innerHTML = "";
        }
    };

    const handleFontFamily = (font: string) => {
        execCommand("fontName", fontFamilies[font as keyof typeof fontFamilies]);
    };

    const handleFontSize = (size: string) => {
        // Using fontSize command with values 1-7
        const sizeMap: Record<string, string> = {
            small: "2",
            normal: "3",
            large: "5",
            huge: "7",
        };
        execCommand("fontSize", sizeMap[size]);
    };

    const handleTextColor = (color: string) => {
        execCommand("foreColor", color);
    };

    const handleInsertLink = () => {
        const url = prompt("Enter URL:");
        if (url) {
            execCommand("createLink", url);
        }
    };

    const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith("image/")) {
            alert("Please select an image file.");
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert("Image size must be less than 5MB.");
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const result = event.target?.result as string;
            if (result && editorRef.current) {
                editorRef.current.focus();
                document.execCommand("insertImage", false, result);
                setBody(editorRef.current.innerHTML);
            }
        };
        reader.readAsDataURL(file);

        // Reset input so the same file can be selected again
        e.target.value = "";
    }, []);

    const triggerImageUpload = () => {
        imageInputRef.current?.click();
    };

    const triggerFileUpload = () => {
        fileInputRef.current?.click();
    };

    const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const newAttachments: Array<{ name: string; size: string; type: string }> = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];

            // Validate file size (max 10MB)
            if (file.size > 10 * 1024 * 1024) {
                alert(`File "${file.name}" is too large. Maximum size is 10MB.`);
                continue;
            }

            const sizeInKB = file.size / 1024;
            const sizeStr = sizeInKB >= 1024
                ? `${(sizeInKB / 1024).toFixed(1)} MB`
                : `${sizeInKB.toFixed(1)} KB`;

            newAttachments.push({
                name: file.name,
                size: sizeStr,
                type: file.type || 'application/octet-stream'
            });
        }

        setAttachments(prev => [...prev, ...newAttachments]);

        // Reset input
        e.target.value = "";
    }, []);

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    // Handle keyboard shortcuts
    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.ctrlKey || e.metaKey) {
            switch (e.key.toLowerCase()) {
                case "b":
                    e.preventDefault();
                    execCommand("bold");
                    break;
                case "i":
                    e.preventDefault();
                    execCommand("italic");
                    break;
                case "u":
                    e.preventDefault();
                    execCommand("underline");
                    break;
                case "z":
                    e.preventDefault();
                    if (e.shiftKey) {
                        execCommand("redo");
                    } else {
                        execCommand("undo");
                    }
                    break;
                case "y":
                    e.preventDefault();
                    execCommand("redo");
                    break;
            }
        }
    }, [execCommand]);

    // Allowed document extensions
    const allowedDocumentTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain',
        'text/csv',
        'application/zip',
        'application/x-rar-compressed',
    ];

    const isDocumentFile = (file: File) => {
        return allowedDocumentTypes.includes(file.type) ||
            /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|zip|rar)$/i.test(file.name);
    };

    // Handle drag and drop for images and documents
    const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();

        const files = e.dataTransfer.files;
        if (files.length === 0) return;

        const newAttachments: Array<{ name: string; size: string; type: string; isImage?: boolean; preview?: string }> = [];
        let imageCount = 0;

        // Count images in files
        for (let i = 0; i < files.length; i++) {
            if (files[i].type.startsWith("image/")) {
                imageCount++;
            }
        }

        for (let i = 0; i < files.length; i++) {
            const file = files[i];

            // Handle images
            if (file.type.startsWith("image/")) {
                // Validate file size (max 5MB for images)
                if (file.size > 5 * 1024 * 1024) {
                    alert(`Image "${file.name}" is too large. Maximum size is 5MB.`);
                    continue;
                }

                const sizeInKB = file.size / 1024;
                const sizeStr = sizeInKB >= 1024
                    ? `${(sizeInKB / 1024).toFixed(1)} MB`
                    : `${sizeInKB.toFixed(1)} KB`;

                // If only one image, insert into editor; otherwise add to attachments
                if (imageCount === 1) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const result = event.target?.result as string;
                        if (result && editorRef.current) {
                            editorRef.current.focus();
                            document.execCommand("insertImage", false, result);
                            setBody(editorRef.current.innerHTML);
                        }
                    };
                    reader.readAsDataURL(file);
                } else {
                    // Multiple images - add as attachments with preview
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const result = event.target?.result as string;
                        setAttachments(prev => [...prev, {
                            name: file.name,
                            size: sizeStr,
                            type: file.type,
                            isImage: true,
                            preview: result
                        }]);
                    };
                    reader.readAsDataURL(file);
                }
            }
            // Handle documents - add to attachments
            else if (isDocumentFile(file)) {
                // Validate file size (max 10MB for documents)
                if (file.size > 10 * 1024 * 1024) {
                    alert(`File "${file.name}" is too large. Maximum size is 10MB.`);
                    continue;
                }

                const sizeInKB = file.size / 1024;
                const sizeStr = sizeInKB >= 1024
                    ? `${(sizeInKB / 1024).toFixed(1)} MB`
                    : `${sizeInKB.toFixed(1)} KB`;

                newAttachments.push({
                    name: file.name,
                    size: sizeStr,
                    type: file.type || 'application/octet-stream'
                });
            } else {
                alert(`File type not supported: "${file.name}". Please drop images or documents (PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, CSV, ZIP, RAR).`);
            }
        }

        if (newAttachments.length > 0) {
            setAttachments(prev => [...prev, ...newAttachments]);
        }
    }, []);

    const [isDragOver, setIsDragOver] = useState(false);

    const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    }, []);

    const isValid = name.trim() && subject.trim();

    // Populate form when editing or reset when dialog closes
    useEffect(() => {
        if (open && editTemplate) {
            setName(editTemplate.name);
            setSubject(editTemplate.subject);
            setDescription(editTemplate.description);
            setBody(editTemplate.body || "");
            if (editorRef.current) {
                editorRef.current.innerHTML = editTemplate.body || "";
            }
        } else if (!open) {
            setName("");
            setSubject("");
            setDescription("");
            setBody("");
            setAttachments([]);
            if (editorRef.current) {
                editorRef.current.innerHTML = "";
            }
        }
    }, [open, editTemplate]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent">
                            <FileText className="w-5 h-5 text-accent-foreground" />
                        </div>
                        <div>
                            <DialogTitle>{isEditMode ? "Edit Email Template" : "Create Email Template"}</DialogTitle>
                            <DialogDescription>
                                {isEditMode ? "Update your email template." : "Create a reusable email template."} Use {"{{variable}}"} for dynamic content.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="mt-4 flex-1 overflow-hidden flex flex-col">
                    <ScrollArea className="flex-1 pr-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Left column - Form fields */}
                            <div className="space-y-4 border-2 border-primary/30 rounded-lg p-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Template Name *</Label>
                                    <Input
                                        id="name"
                                        placeholder="e.g., Welcome Email"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="description">Description</Label>
                                    <Input
                                        id="description"
                                        placeholder="Brief description of this template"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="subject">Email Subject *</Label>
                                    <Input
                                        id="subject"
                                        placeholder="e.g., Welcome to {{company}}!"
                                        value={subject}
                                        onChange={(e) => setSubject(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Right column - Email Body */}
                            <div className="space-y-2 flex flex-col">
                                <Label>Email Body</Label>
                                <div className="border rounded-md flex flex-col flex-1">
                                    {/* Toolbar Row 1 */}
                                    <div className="flex items-center gap-1 px-2 py-1.5 border-b bg-muted/30 flex-wrap">
                                        <TooltipProvider delayDuration={300}>
                                            <ToolbarButton onClick={() => execCommand("undo")} tooltip="Undo">
                                                <Undo2 className="h-4 w-4" />
                                            </ToolbarButton>

                                            <ToolbarButton onClick={() => execCommand("redo")} tooltip="Redo">
                                                <Redo2 className="h-4 w-4" />
                                            </ToolbarButton>

                                            <Separator orientation="vertical" className="h-5 mx-1" />

                                            <Select defaultValue="sans-serif" onValueChange={handleFontFamily}>
                                                <SelectTrigger className="h-7 w-24 text-xs" onMouseDown={(e) => e.stopPropagation()}>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="sans-serif">Sans Serif</SelectItem>
                                                    <SelectItem value="serif">Serif</SelectItem>
                                                    <SelectItem value="monospace">Monospace</SelectItem>
                                                </SelectContent>
                                            </Select>

                                            <Separator orientation="vertical" className="h-5 mx-1" />

                                            <Select defaultValue="normal" onValueChange={handleFontSize}>
                                                <SelectTrigger className="h-7 w-8 px-1.5" onMouseDown={(e) => e.stopPropagation()}>
                                                    <Type className="h-3.5 w-3.5" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="small">Small</SelectItem>
                                                    <SelectItem value="normal">Normal</SelectItem>
                                                    <SelectItem value="large">Large</SelectItem>
                                                    <SelectItem value="huge">Huge</SelectItem>
                                                </SelectContent>
                                            </Select>

                                            <Separator orientation="vertical" className="h-5 mx-1" />

                                            <ToolbarButton
                                                onClick={() => execCommand("bold")}
                                                isActive={activeFormats.has("bold")}
                                                tooltip="Bold (Ctrl+B)"
                                            >
                                                <Bold className="h-4 w-4" />
                                            </ToolbarButton>

                                            <ToolbarButton
                                                onClick={() => execCommand("italic")}
                                                isActive={activeFormats.has("italic")}
                                                tooltip="Italic (Ctrl+I)"
                                            >
                                                <Italic className="h-4 w-4" />
                                            </ToolbarButton>

                                            <ToolbarButton
                                                onClick={() => execCommand("underline")}
                                                isActive={activeFormats.has("underline")}
                                                tooltip="Underline (Ctrl+U)"
                                            >
                                                <Underline className="h-4 w-4" />
                                            </ToolbarButton>

                                            <ToolbarButton
                                                onClick={() => execCommand("strikeThrough")}
                                                isActive={activeFormats.has("strikethrough")}
                                                tooltip="Strikethrough"
                                            >
                                                <Strikethrough className="h-4 w-4" />
                                            </ToolbarButton>

                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7"
                                                        onMouseDown={(e) => e.preventDefault()}
                                                    >
                                                        <span className="text-sm font-bold underline decoration-red-500 decoration-2">A</span>
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-2" align="start">
                                                    <div className="grid grid-cols-5 gap-1">
                                                        {textColors.map((color) => (
                                                            <button
                                                                key={color.value}
                                                                type="button"
                                                                className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform"
                                                                style={{ backgroundColor: color.value }}
                                                                onClick={() => handleTextColor(color.value)}
                                                                title={color.name}
                                                            />
                                                        ))}
                                                    </div>
                                                </PopoverContent>
                                            </Popover>

                                            <Separator orientation="vertical" className="h-5 mx-1" />

                                            <ToolbarButton onClick={() => execCommand("justifyLeft")} tooltip="Align left">
                                                <AlignLeft className="h-4 w-4" />
                                            </ToolbarButton>

                                            <ToolbarButton onClick={() => execCommand("justifyCenter")} tooltip="Align center">
                                                <AlignCenter className="h-4 w-4" />
                                            </ToolbarButton>

                                            <ToolbarButton onClick={() => execCommand("justifyRight")} tooltip="Align right">
                                                <AlignRight className="h-4 w-4" />
                                            </ToolbarButton>

                                            <Separator orientation="vertical" className="h-5 mx-1" />

                                            <ToolbarButton
                                                onClick={() => execCommand("insertOrderedList")}
                                                isActive={activeFormats.has("orderedList")}
                                                tooltip="Numbered list"
                                            >
                                                <ListOrdered className="h-4 w-4" />
                                            </ToolbarButton>

                                            <ToolbarButton
                                                onClick={() => execCommand("insertUnorderedList")}
                                                isActive={activeFormats.has("unorderedList")}
                                                tooltip="Bulleted list"
                                            >
                                                <List className="h-4 w-4" />
                                            </ToolbarButton>
                                        </TooltipProvider>
                                    </div>

                                    {/* Toolbar Row 2 */}
                                    <div className="flex items-center justify-between px-2 py-1.5 border-b bg-muted/30">
                                        <div className="flex items-center gap-1">
                                            <TooltipProvider delayDuration={300}>
                                                {/* Clear Formatting Button */}
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 px-2 text-xs gap-1"
                                                            onClick={() => execCommand("removeFormat")}
                                                            onMouseDown={(e) => e.preventDefault()}
                                                        >
                                                            <span className="font-serif font-medium">Aa</span>
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>Clear formatting</TooltipContent>
                                                </Tooltip>

                                                {/* Signature Button */}
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 px-2 text-xs gap-1"
                                                            onClick={() => { }}
                                                            onMouseDown={(e) => e.preventDefault()}
                                                        >
                                                            <PenTool className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>Insert signature</TooltipContent>
                                                </Tooltip>

                                                <ToolbarButton onClick={handleInsertLink} tooltip="Insert link (Ctrl+K)">
                                                    <Link className="h-4 w-4" />
                                                </ToolbarButton>

                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7"
                                                            onMouseDown={(e) => e.preventDefault()}
                                                        >
                                                            <Smile className="h-4 w-4" />
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-80 p-0 max-h-[300px] overflow-hidden" align="start">
                                                        <div className="p-2 border-b bg-background sticky top-0 z-10">
                                                            <p className="text-sm font-medium">Insert Emoji</p>
                                                        </div>
                                                        <ScrollArea className="h-[250px]">
                                                            <div className="p-2 space-y-3">
                                                                {emojiCategories.map((category) => (
                                                                    <div key={category.name}>
                                                                        <p className="text-xs text-muted-foreground mb-1.5 px-1">{category.name}</p>
                                                                        <div className="grid grid-cols-9 gap-0.5">
                                                                            {category.emojis.map((emoji, index) => (
                                                                                <button
                                                                                    key={`${category.name}-${index}`}
                                                                                    type="button"
                                                                                    className="w-7 h-7 flex items-center justify-center text-lg hover:bg-accent rounded transition-colors"
                                                                                    onClick={() => {
                                                                                        execCommand("insertText", emoji);
                                                                                    }}
                                                                                >
                                                                                    {emoji}
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </ScrollArea>
                                                    </PopoverContent>
                                                </Popover>

                                                <ToolbarButton onClick={triggerImageUpload} tooltip="Insert photo">
                                                    <Image className="h-4 w-4" />
                                                </ToolbarButton>

                                                <ToolbarButton onClick={triggerFileUpload} tooltip="Attach document">
                                                    <Paperclip className="h-4 w-4" />
                                                </ToolbarButton>

                                                {/* Hidden file input for image upload */}
                                                <input
                                                    ref={imageInputRef}
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={handleImageUpload}
                                                />

                                                {/* Hidden file input for document upload */}
                                                <input
                                                    ref={fileInputRef}
                                                    type="file"
                                                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar"
                                                    className="hidden"
                                                    onChange={handleFileUpload}
                                                    multiple
                                                />

                                                {/* Confidential Mode Button */}
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 px-2 text-xs gap-1"
                                                            onClick={() => { }}
                                                            onMouseDown={(e) => e.preventDefault()}
                                                        >
                                                            <Lock className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>Enable confidential mode</TooltipContent>
                                                </Tooltip>

                                                {/* More Options Button */}
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 px-2 text-xs gap-1"
                                                            onMouseDown={(e) => e.preventDefault()}
                                                        >
                                                            <MoreVertical className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-48 p-1" align="start">
                                                        <div className="flex flex-col">
                                                            <button
                                                                type="button"
                                                                className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent rounded-sm transition-colors text-left"
                                                                onClick={() => execCommand("removeFormat")}
                                                            >
                                                                Clear formatting
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent rounded-sm transition-colors text-left"
                                                                onClick={() => { }}
                                                            >
                                                                Print preview
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent rounded-sm transition-colors text-left"
                                                                onClick={() => { }}
                                                            >
                                                                Full screen
                                                            </button>
                                                        </div>
                                                    </PopoverContent>
                                                </Popover>
                                            </TooltipProvider>
                                        </div>

                                        <TooltipProvider delayDuration={300}>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-destructive"
                                                        onClick={handleClear}
                                                        onMouseDown={(e) => e.preventDefault()}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>Clear all content</TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </div>

                                    {/* Rich Text Editor */}
                                    <ScrollArea className="h-[200px] max-h-[200px]">
                                        <div
                                            ref={editorRef}
                                            contentEditable
                                            className={`min-h-[200px] p-3 text-sm outline-none transition-colors ${isDragOver ? "bg-accent/50 ring-2 ring-primary ring-inset" : ""
                                                }`}
                                            style={{ lineHeight: 1.6 }}
                                            onInput={(e) => setBody(e.currentTarget.innerHTML)}
                                            onSelect={checkActiveFormats}
                                            onKeyUp={checkActiveFormats}
                                            onKeyDown={handleKeyDown}
                                            onDragOver={handleDragOver}
                                            onDragEnter={handleDragEnter}
                                            onDragLeave={handleDragLeave}
                                            onDrop={(e) => {
                                                handleDrop(e);
                                                setIsDragOver(false);
                                            }}
                                            data-placeholder="Write your email content here. Use {{variable}} for placeholders... (Ctrl+B: Bold, Ctrl+I: Italic, Ctrl+U: Underline)"
                                            suppressContentEditableWarning
                                        />
                                    </ScrollArea>

                                    {/* Attachments List */}
                                    {attachments.length > 0 && (
                                        <div className="border-t p-2 bg-muted/20">
                                            <p className="text-xs text-muted-foreground mb-2">Attachments ({attachments.length})</p>
                                            <div className="flex flex-wrap gap-2">
                                                {attachments.map((attachment, index) => (
                                                    <div
                                                        key={index}
                                                        className="flex items-center gap-2 bg-background border rounded-md px-2 py-1 text-xs"
                                                    >
                                                        {attachment.isImage && attachment.preview ? (
                                                            <img
                                                                src={attachment.preview}
                                                                alt={attachment.name}
                                                                className="h-8 w-8 object-cover rounded"
                                                            />
                                                        ) : (
                                                            <Paperclip className="h-3 w-3 text-muted-foreground" />
                                                        )}
                                                        <span className="max-w-[120px] truncate" title={attachment.name}>
                                                            {attachment.name}
                                                        </span>
                                                        <span className="text-muted-foreground">({attachment.size})</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => removeAttachment(index)}
                                                            className="text-muted-foreground hover:text-destructive transition-colors"
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </ScrollArea>

                    <DialogFooter className="pt-4 flex-shrink-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={!isValid}>
                            {isEditMode ? "Save Changes" : "Create Template"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
