"use client";

import { useState } from "react";
import { FolderPlus, Edit2, Trash2, UserCircle } from "lucide-react";
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

interface ContactRole {
    id: string;
    name: string;
    isDefault?: boolean;
}

interface RolesManagementDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    roles: ContactRole[];
    onAddRole: (name: string) => void;
    onEditRole: (id: string, name: string) => void;
    onDeleteRole: (id: string) => void;
    getRoleContactCount: (roleName: string) => number;
}

export const RolesManagementDialog = ({
    open,
    onOpenChange,
    roles,
    onAddRole,
    onEditRole,
    onDeleteRole,
    getRoleContactCount,
}: RolesManagementDialogProps) => {
    const [newRoleName, setNewRoleName] = useState("");
    const [editingRole, setEditingRole] = useState<ContactRole | null>(null);
    const [editName, setEditName] = useState("");
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [roleToDelete, setRoleToDelete] = useState<ContactRole | null>(null);

    const handleAddRole = () => {
        if (newRoleName.trim()) {
            onAddRole(newRoleName.trim());
            setNewRoleName("");
        }
    };

    const handleStartEdit = (role: ContactRole) => {
        setEditingRole(role);
        setEditName(role.name);
    };

    const handleSaveEdit = () => {
        if (editingRole && editName.trim()) {
            onEditRole(editingRole.id, editName.trim());
            setEditingRole(null);
            setEditName("");
        }
    };

    const handleCancelEdit = () => {
        setEditingRole(null);
        setEditName("");
    };

    const handleDeleteClick = (role: ContactRole) => {
        setRoleToDelete(role);
        setDeleteDialogOpen(true);
    };

    const handleConfirmDelete = () => {
        if (roleToDelete) {
            onDeleteRole(roleToDelete.id);
            setRoleToDelete(null);
        }
        setDeleteDialogOpen(false);
    };

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
                                <UserCircle className="h-5 w-5 text-accent-foreground" />
                            </div>
                            <div>
                                <DialogTitle>Manage Roles</DialogTitle>
                                <DialogDescription>
                                    Create and manage contact roles (e.g., Employee, Client, Contractor).
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="mt-4 space-y-4">
                        {/* Add new role */}
                        <div className="flex gap-2">
                            <Input
                                placeholder="Enter role name..."
                                value={newRoleName}
                                onChange={(e) => setNewRoleName(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleAddRole()}
                            />
                            <Button onClick={handleAddRole} disabled={!newRoleName.trim()}>
                                <FolderPlus className="w-4 h-4 mr-2" />
                                Add
                            </Button>
                        </div>

                        {/* Roles list */}
                        <div className="border border-border rounded-lg divide-y divide-border max-h-[300px] overflow-y-auto">
                            {roles.length === 0 ? (
                                <div className="p-4 text-center text-muted-foreground text-sm">
                                    No roles yet. Create your first role above.
                                </div>
                            ) : (
                                roles.map((role) => {
                                    const contactCount = getRoleContactCount(role.name);
                                    const isEditing = editingRole?.id === role.id;

                                    return (
                                        <div
                                            key={role.id}
                                            className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors"
                                        >
                                            {isEditing ? (
                                                <div className="flex items-center gap-2 flex-1 mr-2">
                                                    <Input
                                                        value={editName}
                                                        onChange={(e) => setEditName(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === "Enter") handleSaveEdit();
                                                            if (e.key === "Escape") handleCancelEdit();
                                                        }}
                                                        autoFocus
                                                        className="h-8"
                                                    />
                                                    <Button size="sm" onClick={handleSaveEdit}>
                                                        Save
                                                    </Button>
                                                    <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                                                        Cancel
                                                    </Button>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="flex items-center gap-3">
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent text-accent-foreground">
                                                            {role.name}
                                                        </span>
                                                        <span className="text-sm text-muted-foreground">
                                                            {contactCount} contact{contactCount !== 1 ? "s" : ""}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon-sm"
                                                            onClick={() => handleStartEdit(role)}
                                                            aria-label={`Edit ${role.name}`}
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon-sm"
                                                            onClick={() => handleDeleteClick(role)}
                                                            aria-label={`Delete ${role.name}`}
                                                            disabled={role.isDefault}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Role</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete the "{roleToDelete?.name}" role?
                            {getRoleContactCount(roleToDelete?.name || "") > 0 && (
                                <> Contacts with this role will need to be reassigned.</>
                            )}
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
