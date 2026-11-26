"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Sparkles, Upload, Wand2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { apiErrorMessage } from "@/contexts/AuthContext";
import type { UploadedFile } from "@/lib/files";
import { cn } from "@/lib/utils";

type Mode = "generate" | "edit";

const SIZES = [
    { value: "auto", label: "Auto" },
    { value: "1536x1024", label: "Landscape (banner)" },
    { value: "1024x1024", label: "Square" },
    { value: "1024x1536", label: "Portrait" },
];

const EDITABLE = ["image/png", "image/jpeg", "image/webp"];

interface AiImagePanelProps {
    /** Called with the stored image once the user chooses to use it. */
    onInsert: (image: UploadedFile) => void;
}

/**
 * Optional image for a template. Off by default — OpenAI is only called when the
 * user turns this on and clicks Generate. Two ways: a new image from a prompt,
 * or the user's own image edited with a prompt.
 */
export function AiImagePanel({ onInsert }: AiImagePanelProps) {
    const [enabled, setEnabled] = useState(false);
    const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
    const [mode, setMode] = useState<Mode>("generate");
    const [prompt, setPrompt] = useState("");
    const [size, setSize] = useState("auto");
    const [source, setSource] = useState<File | null>(null);
    const [sourcePreview, setSourcePreview] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<UploadedFile | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    // Only ask the server once the user opts in.
    useEffect(() => {
        if (!enabled || aiAvailable !== null) return;
        let cancelled = false;
        fetch("/api/ai/images/status")
            .then((r) => r.json())
            .then((d) => { if (!cancelled) setAiAvailable(!!d.enabled); })
            .catch(() => { if (!cancelled) setAiAvailable(false); });
        return () => { cancelled = true; };
    }, [enabled, aiAvailable]);

    const setSourceFile = (file: File | null) => {
        setSourcePreview((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return file ? URL.createObjectURL(file) : null;
        });
        setSource(file);
    };

    const chooseSource = (file: File | undefined) => {
        setError(null);
        if (!file) return;
        if (!EDITABLE.includes(file.type)) {
            setError("Choose a PNG, JPEG or WebP image.");
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            setError("The image must be under 10 MB.");
            return;
        }
        setSourceFile(file);
    };

    const canGenerate =
        aiAvailable === true && !busy && prompt.trim().length >= 3 && (mode === "generate" || !!source);

    const handleGenerate = async () => {
        if (!canGenerate) return;
        setBusy(true);
        setError(null);
        setResult(null);
        try {
            let res: Response;
            if (mode === "generate") {
                res = await fetch("/api/ai/images/generate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ prompt: prompt.trim(), size }),
                });
            } else {
                const form = new FormData();
                form.append("image", source!, source!.name);
                form.append("prompt", prompt.trim());
                form.append("size", size);
                res = await fetch("/api/ai/images/edit", { method: "POST", body: form });
            }
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(apiErrorMessage(data, `Image generation failed (HTTP ${res.status})`));
            setResult(data as UploadedFile);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="rounded-lg border border-border bg-muted/20">
            <div className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                    <ImagePlus className="w-4 h-4 text-primary shrink-0" />
                    <Label htmlFor="ai-image-toggle" className="text-xs font-semibold cursor-pointer">
                        Add an image
                    </Label>
                    <span className="text-[11px] text-muted-foreground truncate hidden sm:inline">
                        · generate one with AI, or edit your own
                    </span>
                </div>
                <Switch id="ai-image-toggle" checked={enabled} onCheckedChange={setEnabled} />
            </div>

            {enabled && (
                <div className="border-t border-border px-3 py-3 space-y-3">
                    {aiAvailable === false && (
                        <p className="text-xs text-amber-700 dark:text-amber-400">
                            AI images aren&apos;t set up yet. Add <code className="font-mono">OPENAI_API_KEY</code> to the API&apos;s .env and restart it.
                        </p>
                    )}

                    <div className="flex items-center gap-1 p-0.5 rounded-md bg-muted w-fit">
                        {(["generate", "edit"] as Mode[]).map((m) => (
                            <button
                                key={m}
                                type="button"
                                onClick={() => { setMode(m); setError(null); }}
                                className={cn(
                                    "px-3 py-1 text-xs rounded font-medium transition-colors flex items-center gap-1.5",
                                    mode === m ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {m === "generate" ? <Sparkles className="w-3 h-3" /> : <Wand2 className="w-3 h-3" />}
                                {m === "generate" ? "New from text" : "Edit my image"}
                            </button>
                        ))}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                        <div className="space-y-2">
                            {mode === "edit" && (
                                <div className="flex items-center gap-2">
                                    {sourcePreview && source ? (
                                        <div className="relative">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={sourcePreview} alt={source.name} className="h-14 w-14 object-cover rounded border" />
                                            <button
                                                type="button"
                                                onClick={() => setSourceFile(null)}
                                                className="absolute -top-1.5 -right-1.5 bg-background border rounded-full p-0.5"
                                                aria-label="Remove image"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ) : null}
                                    <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => fileRef.current?.click()}>
                                        <Upload className="w-3.5 h-3.5" />
                                        {source ? "Change image" : "Choose image"}
                                    </Button>
                                    <input
                                        ref={fileRef}
                                        type="file"
                                        accept={EDITABLE.join(",")}
                                        className="hidden"
                                        onChange={(e) => { chooseSource(e.target.files?.[0]); e.target.value = ""; }}
                                    />
                                </div>
                            )}
                            <Textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                rows={2}
                                maxLength={4000}
                                placeholder={
                                    mode === "generate"
                                        ? "Describe the image, e.g. “A clean blue banner welcoming new contractors, office skyline”"
                                        : "What should change? e.g. “Put this logo on a soft gradient background”"
                                }
                                className="text-sm resize-none"
                            />
                            <div className="flex items-center gap-2">
                                <Select value={size} onValueChange={setSize}>
                                    <SelectTrigger className="h-8 w-[170px] text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {SIZES.map((s) => (
                                            <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button type="button" size="sm" className="h-8 gap-1.5" disabled={!canGenerate} onClick={handleGenerate}>
                                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                                    {busy ? "Generating…" : result ? "Generate again" : "Generate"}
                                </Button>
                                {busy && <span className="text-[11px] text-muted-foreground">This can take up to a minute.</span>}
                            </div>
                            {error && <p className="text-xs text-destructive">{error}</p>}
                        </div>

                        {result && (
                            <div className="flex sm:flex-col items-center gap-2">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={result.url} alt="Generated" className="h-24 w-24 object-cover rounded border bg-background" />
                                <Button type="button" size="sm" variant="secondary" className="h-7 text-xs" onClick={() => onInsert(result)}>
                                    Insert into body
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
