import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge doesn't know our custom type scale from globals.css (text-body-*,
 * text-heading-*). Without this it treats them as text *colours* and drops real
 * colours like text-primary-foreground — e.g. small blue buttons lost their white text.
 */
const twMerge = extendTailwindMerge({
    extend: {
        classGroups: {
            "font-size": [{ text: ["body-xs", "body-sm", "body-base", "body-lg", "heading-1", "heading-2", "heading-3", "heading-4"] }],
        },
    },
});

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}
