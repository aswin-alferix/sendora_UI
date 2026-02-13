"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Edit2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface BulkGroup {
    id: string;
    name: string;
}

interface SortableGroupItemProps {
    group: BulkGroup;
    contactCount: number;
    isEditing: boolean;
    editName: string;
    onEditNameChange: (name: string) => void;
    onStartEdit: () => void;
    onSaveEdit: () => void;
    onCancelEdit: () => void;
    onDelete: () => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
    isFirst: boolean;
    isLast: boolean;
}

export const SortableGroupItem = ({
    group,
    contactCount,
    isEditing,
    editName,
    onEditNameChange,
    onStartEdit,
    onSaveEdit,
    onCancelEdit,
    onDelete,
    onMoveUp,
    onMoveDown,
    isFirst,
    isLast,
}: SortableGroupItemProps) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: group.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`flex items-center justify-between p-3 hover:bg-muted/30 transition-colors ${isDragging ? "opacity-50 bg-muted/50" : ""
                }`}
        >
            {isEditing ? (
                <div className="flex items-center gap-2 flex-1 mr-2">
                    <Input
                        value={editName}
                        onChange={(e) => onEditNameChange(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") onSaveEdit();
                            if (e.key === "Escape") onCancelEdit();
                        }}
                        autoFocus
                        className="h-8"
                    />
                    <Button size="sm" onClick={onSaveEdit}>
                        Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={onCancelEdit}>
                        Cancel
                    </Button>
                </div>
            ) : (
                <>
                    <div className="flex items-center gap-3">
                        <button
                            className="cursor-grab active:cursor-grabbing p-1 -ml-1 text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
                            {...attributes}
                            {...listeners}
                            onKeyDown={(e) => {
                                if (e.key === "ArrowUp" && !isFirst) {
                                    e.preventDefault();
                                    onMoveUp();
                                } else if (e.key === "ArrowDown" && !isLast) {
                                    e.preventDefault();
                                    onMoveDown();
                                }
                            }}
                            aria-label={`Reorder ${group.name}. Use up and down arrow keys to move.`}
                            aria-describedby={`group-position-${group.id}`}
                        >
                            <GripVertical className="w-4 h-4" />
                            <span id={`group-position-${group.id}`} className="sr-only">
                                {isFirst ? "First item" : isLast ? "Last item" : ""}
                            </span>
                        </button>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/20 text-primary">
                            {group.name}
                        </span>
                        <span className="text-sm text-muted-foreground">
                            {contactCount} contact{contactCount !== 1 ? "s" : ""}
                        </span>
                    </div>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={onStartEdit}
                            aria-label={`Edit ${group.name}`}
                        >
                            <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={onDelete}
                            aria-label={`Delete ${group.name}`}
                        >
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    </div>
                </>
            )}
        </div>
    );
};
