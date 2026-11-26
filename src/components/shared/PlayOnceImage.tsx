"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface PlayOnceImageProps {
    /** Animated GIF, played once when the component mounts. */
    animatedSrc: string;
    /** Still image shown once the animation has finished (usually the GIF's last frame). */
    staticSrc: string;
    /** Length of one play-through of the GIF, in ms. */
    durationMs: number;
    width: number;
    height: number;
    alt?: string;
    className?: string;
}

/**
 * Plays an animated illustration once on mount, then swaps to a still image.
 * Users who prefer reduced motion get the still image straight away.
 */
export function PlayOnceImage({
    animatedSrc,
    staticSrc,
    durationMs,
    width,
    height,
    alt = "",
    className,
}: PlayOnceImageProps) {
    const [done, setDone] = useState(false);

    useEffect(() => {
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const timer = window.setTimeout(() => setDone(true), reducedMotion ? 0 : durationMs);
        return () => window.clearTimeout(timer);
    }, [durationMs]);

    return (
        <Image
            src={done ? staticSrc : animatedSrc}
            alt={alt}
            width={width}
            height={height}
            unoptimized
            draggable={false}
            className={cn("select-none", className)}
        />
    );
}
