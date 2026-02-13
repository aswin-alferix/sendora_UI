"use client";

import { useState } from "react";
import { FolderPlus, Users } from "lucide-react";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SortableGroupItem } from "./SortableGroupItem";

interface BulkGroup {
    id: string;
    name: string;
}

interface BulkGroupsManagementDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    groups: BulkGroup[];
    onAddGroup: (name: string) => void;
    onEditGroup: (id: string, name: string) => void;
    onDeleteGroup: (id: string) => void;
    onReorderGroups: (groups: BulkGroup[]) => void;
    getGroupContactCount: (groupName: string) => number;
}

export const BulkGroupsManagementDialog = ({
    open,
    onOpenChange,
    groups,
    onAddGroup,
    onEditGroup,
    onDeleteGroup,
    onReorderGroups,
    getGroupContactCount,
}: BulkGroupsManagementDialogProps) => {
    const [newGroupName, setNewGroupName] = useState("");
    const [editingGroup, setEditingGroup] = useState<BulkGroup | null>(null);
    const [editName, setEditName] = useState("");
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [groupToDelete, setGroupToDelete] = useState<BulkGroup | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleAddGroup = () => {
        if (newGroupName.trim()) {
            onAddGroup(newGroupName.trim());
            setNewGroupName("");
        }
    };

    const handleStartEdit = (group: BulkGroup) => {
        setEditingGroup(group);
        setEditName(group.name);
    };

    const handleSaveEdit = () => {
        if (editingGroup && editName.trim()) {
            onEditGroup(editingGroup.id, editName.trim());
            setEditingGroup(null);
            setEditName("");
        }
    };

    const handleCancelEdit = () => {
        setEditingGroup(null);
        setEditName("");
    };

    const handleDeleteClick = (group: BulkGroup) => {
        setGroupToDelete(group);
        setDeleteDialogOpen(true);
    };

    const handleConfirmDelete = () => {
        if (groupToDelete) {
            onDeleteGroup(groupToDelete.id);
            setGroupToDelete(null);
        }
        setDeleteDialogOpen(false);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = groups.findIndex((g) => g.id === active.id);
            const newIndex = groups.findIndex((g) => g.id === over.id);
            const reorderedGroups = arrayMove(groups, oldIndex, newIndex);
            onReorderGroups(reorderedGroups);
        }
    };

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
                                <Users className="h-5 w-5 text-accent-foreground" />
                            </div>
                            <div>
                                <DialogTitle>Manage Groups</DialogTitle>
                                <DialogDescription>
                                    Create groups to organize contacts for bulk emails. Drag to reorder.
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="mt-4 space-y-4">
                        {/* Add new group */}
                        <div className="flex gap-2">
                            <Input
                                placeholder="Enter group name..."
                                value={newGroupName}
                                onChange={(e) => setNewGroupName(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleAddGroup()}
                            />
                            <Button onClick={handleAddGroup} disabled={!newGroupName.trim()}>
                                <FolderPlus className="w-4 h-4 mr-2" />
                                Add
                            </Button>
                        </div>

                        {/* Groups list */}
                        <div className="border border-border rounded-lg divide-y divide-border max-h-[300px] overflow-y-auto">
                            {groups.length === 0 ? (
                                <div className="p-4 text-center text-muted-foreground text-sm">
                                    No groups yet. Create your first group above.
                                </div>
                            ) : (
                                <DndContext
                                    sensors={sensors}
                                    collisionDetection={closestCenter}
                                    onDragEnd={handleDragEnd}
                                >
                                    <SortableContext
                                        items={groups.map((g) => g.id)}
                                        strategy={verticalListSortingStrategy}
                                    >
                                        {groups.map((group, index) => (
                                            <SortableGroupItem
                                                key={group.id}
                                                group={group}
                                                contactCount={getGroupContactCount(group.name)}
                                                isEditing={editingGroup?.id === group.id}
                                                editName={editName}
                                                onEditNameChange={setEditName}
                                                onStartEdit={() => handleStartEdit(group)}
                                                onSaveEdit={handleSaveEdit}
                                                onCancelEdit={handleCancelEdit}
                                                onDelete={() => handleDeleteClick(group)}
                                                onMoveUp={() => {
                                                    if (index > 0) {
                                                        onReorderGroups(arrayMove(groups, index, index - 1));
                                                    }
                                                }}
                                                onMoveDown={() => {
                                                    if (index < groups.length - 1) {
                                                        onReorderGroups(arrayMove(groups, index, index + 1));
                                                    }
                                                }}
                                                isFirst={index === 0}
                                                isLast={index === groups.length - 1}
                                            />
                                        ))}
                                    </SortableContext>
                                </DndContext>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Group</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete the "{groupToDelete?.name}" group?
                            Contacts will be removed from this group but not deleted.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};
