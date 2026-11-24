/**
 * Tiptap extension that highlights `[Anything]` patterns in text as colored
 * chips via ProseMirror decorations. Display-only — does not modify the
 * underlying document, so the saved HTML stays clean.
 */

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

const PLACEHOLDER_REGEX = /\[([^\]\n]{1,80})\]/g;

export const PlaceholderHighlight = Extension.create({
    name: "placeholderHighlight",
    addProseMirrorPlugins() {
        return [
            new Plugin({
                key: new PluginKey("placeholder-highlight"),
                props: {
                    decorations(state) {
                        const decorations: Decoration[] = [];
                        state.doc.descendants((node, pos) => {
                            if (!node.isText) return;
                            const text = node.text ?? "";
                            // Reset regex lastIndex defensively
                            PLACEHOLDER_REGEX.lastIndex = 0;
                            let match: RegExpExecArray | null;
                            while ((match = PLACEHOLDER_REGEX.exec(text)) !== null) {
                                decorations.push(
                                    Decoration.inline(
                                        pos + match.index,
                                        pos + match.index + match[0].length,
                                        { class: "sd-placeholder-chip" }
                                    )
                                );
                            }
                        });
                        return DecorationSet.create(state.doc, decorations);
                    },
                },
            }),
        ];
    },
});
