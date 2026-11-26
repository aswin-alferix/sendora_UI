"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Users, MoreVertical, Mail, Edit2, Trash2, Building2, UserCircle, Send, Tags, Minus, Check, Download, Upload, X, Settings2, Share2 } from "lucide-react";

import { PageHeader } from "@/components/shared/PageHeader";
import { PlayOnceImage } from "@/components/shared/PlayOnceImage";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table/DataTable";
import { ActiveFilterChips, ClearFiltersButton, FilterMenu, type FilterCategory } from "@/components/shared/data-table/FilterMenu";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/components/ui/command";
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
import { ContactDialog } from "@/components/contacts/ContactDialog";
import { AddContactsDialog, type AddContactsResult, type NewContact } from "@/components/contacts/AddContactsDialog";
import { RolesManagementDialog } from "@/components/contacts/RolesManagementDialog";
import { BulkGroupsManagementDialog } from "@/components/contacts/BulkGroupsManagementDialog";
import { ContactDetailDrawer } from "@/components/contacts/ContactDetailDrawer";
import { ShareContactsDialog } from "@/components/contacts/ShareContactsDialog";
import { apiErrorMessage } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface ContactRole {
    id: string;
    name: string;
    isDefault?: boolean;
}

interface BulkGroup {
    id: string;
    name: string;
}

interface Contact {
    id: string;
    name: string;
    email: string;
    company: string;
    role: string;
    groups: string[];
    totalEmails: number;
}

const defaultRoles: ContactRole[] = [
    { id: "1", name: "Employee", isDefault: true },
    { id: "2", name: "Client", isDefault: true },
    { id: "3", name: "Contractor", isDefault: true },
    { id: "4", name: "Consultant", isDefault: true },
    { id: "5", name: "Others", isDefault: true },
];

const defaultBulkGroups: BulkGroup[] = [];

// Group badges — tonal pills, no borders. Light bg + dark on-tone text for guaranteed contrast.
const groupColors = [
    { bg: "bg-blue-100 dark:bg-blue-950/50", text: "text-blue-800 dark:text-blue-200" },
    { bg: "bg-emerald-100 dark:bg-emerald-950/50", text: "text-emerald-800 dark:text-emerald-200" },
    { bg: "bg-violet-100 dark:bg-violet-950/50", text: "text-violet-800 dark:text-violet-200" },
    { bg: "bg-amber-100 dark:bg-amber-950/50", text: "text-amber-900 dark:text-amber-200" },
    { bg: "bg-rose-100 dark:bg-rose-950/50", text: "text-rose-800 dark:text-rose-200" },
    { bg: "bg-cyan-100 dark:bg-cyan-950/50", text: "text-cyan-800 dark:text-cyan-200" },
    { bg: "bg-fuchsia-100 dark:bg-fuchsia-950/50", text: "text-fuchsia-800 dark:text-fuchsia-200" },
    { bg: "bg-teal-100 dark:bg-teal-950/50", text: "text-teal-800 dark:text-teal-200" },
];

const getGroupColor = (groupName: string) => {
    let hash = 0;
    for (let i = 0; i < groupName.length; i++) {
        hash = groupName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % groupColors.length;
    return groupColors[index];
};


// Avatar palette — restrained 4-tone cool family. Each name maps deterministically
// to one of these so contacts feel related, not like a rainbow.
const avatarColors = [
    { bg: "bg-blue-100 dark:bg-blue-900/40", text: "text-blue-700 dark:text-blue-200" },
    { bg: "bg-slate-200 dark:bg-slate-700/50", text: "text-slate-700 dark:text-slate-100" },
    { bg: "bg-indigo-100 dark:bg-indigo-900/40", text: "text-indigo-700 dark:text-indigo-200" },
    { bg: "bg-sky-100 dark:bg-sky-900/40", text: "text-sky-700 dark:text-sky-200" },
];

export default function ContactsPage() {
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [contactsLoading, setContactsLoading] = useState(true);
    const [roles, setRoles] = useState<ContactRole[]>(defaultRoles);
    const [bulkGroups, setBulkGroups] = useState<BulkGroup[]>(defaultBulkGroups);
    const [reloadKey, setReloadKey] = useState(0);

    // Load contacts + derive groups from server
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch("/api/contacts");
                const data = await res.json();
                if (cancelled) return;
                const items: Contact[] = (data.items ?? []).map((c: Contact) => ({
                    id: c.id,
                    name: c.name,
                    email: c.email,
                    company: c.company,
                    role: c.role,
                    groups: c.groups ?? [],
                    totalEmails: c.totalEmails ?? 0,
                }));
                setContacts(items);
                // Derive bulk groups from existing contacts so the filter works
                const groupSet = new Set<string>();
                items.forEach((c) => c.groups.forEach((g) => groupSet.add(g)));
                setBulkGroups(Array.from(groupSet).map((name, i) => ({ id: String(i + 1), name })));
            } catch (err) {
                console.error("Failed to load contacts", err);
            } finally {
                if (!cancelled) setContactsLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [reloadKey]);
    const [searchQuery, setSearchQuery] = useState("");
    // Multi-select filters (empty set = no filter)
    const [companyFilter, setCompanyFilter] = useState<Set<string>>(new Set());
    const [roleFilter, setRoleFilter] = useState<Set<string>>(new Set());
    const [groupFilter, setGroupFilter] = useState<Set<string>>(new Set());
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editContact, setEditContact] = useState<Contact | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [contactToDelete, setContactToDelete] = useState<Contact | null>(null);
    const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
    const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
    const [rolesDialogOpen, setRolesDialogOpen] = useState(false);
    const [groupsDialogOpen, setGroupsDialogOpen] = useState(false);
    const [drawerContact, setDrawerContact] = useState<Contact | null>(null);
    const [groupFilterOpen, setGroupFilterOpen] = useState(false);
    const [newGroupName, setNewGroupName] = useState("");
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);
    const [deleteGroupDialogOpen, setDeleteGroupDialogOpen] = useState(false);
    const [groupToDelete, setGroupToDelete] = useState<string | null>(null);
    const [editingGroupInFilter, setEditingGroupInFilter] = useState<string | null>(null);
    const [editGroupName, setEditGroupName] = useState("");
    const [shareDialogOpen, setShareDialogOpen] = useState(false);
    const [importing, setImporting] = useState(false);
    const importInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();
    const router = useRouter();

    const activeFilterCount = companyFilter.size + roleFilter.size + groupFilter.size;

    const clearAllFilters = () => {
        setCompanyFilter(new Set());
        setRoleFilter(new Set());
        setGroupFilter(new Set());
        setSearchQuery("");
    };

    // Hash-based avatar tint from the dedicated cool-tone palette
    const getAvatarColor = (name: string) => {
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        return avatarColors[Math.abs(hash) % avatarColors.length];
    };


    const roleOptions = useMemo(() => roles.map((r) => r.name), [roles]);
    const groupOptions = useMemo(() => bulkGroups.map((g) => g.name), [bulkGroups]);

    const handleExport = async (format: "xlsx" | "csv") => {
        try {
            const res = await fetch(`/api/contacts/export?format=${format}`);
            if (!res.ok) throw new Error(apiErrorMessage(await res.json().catch(() => ({})), "Export failed"));
            const blob = await res.blob();
            const disposition = res.headers.get("Content-Disposition") ?? "";
            const filename = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? `contacts.${format}`;
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
            toast({ title: "Contacts exported", description: `${contacts.length} contacts exported to ${format === "xlsx" ? "Excel" : "CSV"}.` });
        } catch (err) {
            toast({ title: "Export failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
        }
    };

    // Import runs on the server (CSV or Excel). Existing emails are skipped, not overwritten.
    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        setImporting(true);
        try {
            const form = new FormData();
            form.append("file", file);
            const res = await fetch("/api/contacts/import?mode=skip", { method: "POST", body: form });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(apiErrorMessage(data, "Could not import the file."));
            const invalid: { row: number; reason: string }[] = data.invalid ?? [];
            const parts = [`${data.created} added`];
            if (data.skipped) parts.push(`${data.skipped} already existed`);
            if (invalid.length) {
                const sample = invalid.slice(0, 3).map((r) => `row ${r.row}: ${r.reason}`).join("; ");
                parts.push(`${invalid.length} skipped as invalid (${sample}${invalid.length > 3 ? "; …" : ""})`);
            }
            toast({ title: "Contacts imported", description: parts.join(", ") + ".", variant: invalid.length ? undefined : "success" });
            setReloadKey((k) => k + 1);
        } catch (err) {
            toast({ title: "Import failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
        } finally {
            setImporting(false);
        }
    };

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't trigger shortcuts when typing in input fields
            const target = e.target as HTMLElement;
            if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
                return;
            }

            const key = e.key.toLowerCase();
            const hasModifier = e.ctrlKey || e.metaKey;

            if (hasModifier) {
                switch (key) {
                    case "g":
                        e.preventDefault();
                        setGroupsDialogOpen(true);
                        break;
                    case "r":
                        e.preventDefault();
                        setRolesDialogOpen(true);
                        break;
                    case "n":
                        e.preventDefault();
                        setEditContact(null);
                        setDialogOpen(true);
                        break;
                }
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, []);

    const companies = useMemo(() => {
        const uniqueCompanies = [...new Set(contacts.map((c) => c.company))];
        return uniqueCompanies.sort();
    }, [contacts]);

    const filteredContacts = contacts.filter((contact) => {
        const matchesSearch =
            contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            contact.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
            contact.company.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCompany = companyFilter.size === 0 || companyFilter.has(contact.company);
        const matchesRole = roleFilter.size === 0 || roleFilter.has(contact.role);
        const matchesGroup = groupFilter.size === 0 || contact.groups.some((g) => groupFilter.has(g));
        return matchesSearch && matchesCompany && matchesRole && matchesGroup;
    });

    // ── Filter menu categories (value counts come from all contacts) ─────────
    const countBy = (values: string[]) => {
        const m = new Map<string, number>();
        values.forEach((v) => v && m.set(v, (m.get(v) ?? 0) + 1));
        return m;
    };
    const companyCounts = countBy(contacts.map((c) => c.company));
    const roleCounts = countBy(contacts.map((c) => c.role));
    const groupCounts = countBy(contacts.flatMap((c) => c.groups));
    const filterCategories: FilterCategory[] = [
        {
            id: "company",
            label: "Company",
            icon: Building2,
            options: companies.filter(Boolean).map((v) => ({ value: v, count: companyCounts.get(v) ?? 0 })),
            selected: companyFilter,
            onChange: setCompanyFilter,
        },
        {
            id: "role",
            label: "Role",
            icon: UserCircle,
            options: roleOptions.map((v) => ({ value: v, count: roleCounts.get(v) ?? 0 })),
            selected: roleFilter,
            onChange: setRoleFilter,
        },
        {
            id: "group",
            label: "Group",
            icon: Tags,
            options: groupOptions.map((v) => ({ value: v, count: groupCounts.get(v) ?? 0 })),
            selected: groupFilter,
            onChange: setGroupFilter,
        },
    ];



    const getInitials = (name: string) => {
        return name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase();
    };

    const handleAddContact = () => {
        setEditContact(null);
        setDialogOpen(true);
    };

    const handleEditContact = (contact: Contact) => {
        setEditContact(contact);
        setDialogOpen(true);
    };

    const handleDeleteClick = (contact: Contact) => {
        setContactToDelete(contact);
        setDeleteDialogOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (contactToDelete) {
            try {
                const res = await fetch(`/api/contacts/${contactToDelete.id}`, { method: "DELETE" });
                if (!res.ok) throw new Error("Delete failed");
                setContacts((prev) => prev.filter((c) => c.id !== contactToDelete.id));
                setSelectedContacts((prev) => {
                    const next = new Set(prev);
                    next.delete(contactToDelete.id);
                    return next;
                });
                toast({
                    title: "Contact deleted",
                    description: "The contact has been removed successfully.",
                    variant: "success",
                });
            } catch (err) {
                toast({ title: "Failed to delete", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
            }
            setContactToDelete(null);
        }
        setDeleteDialogOpen(false);
    };

    // Row selection is handled by the shared DataTable (selectedIds / onSelectedIdsChange).

    const handleBulkDeleteClick = () => {
        setBulkDeleteDialogOpen(true);
    };

    const handleConfirmBulkDelete = async () => {
        try {
            await Promise.all(
                Array.from(selectedContacts).map((id) => fetch(`/api/contacts/${id}`, { method: "DELETE" }))
            );
            setContacts((prev) => prev.filter((c) => !selectedContacts.has(c.id)));
            toast({
                title: "Contacts deleted",
                description: `${selectedContacts.size} contact(s) have been removed successfully.`,
                variant: "success",
            });
            setSelectedContacts(new Set());
        } catch (err) {
            toast({ title: "Bulk delete failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
        }
        setBulkDeleteDialogOpen(false);
    };

    const handleBulkEmail = () => {
        const selectedEmails = contacts
            .filter((c) => selectedContacts.has(c.id))
            .map((c) => c.email)
            .join(",");
        router.push(`/compose?to=${encodeURIComponent(selectedEmails)}`);
    };

    const handleSingleEmail = (contact: Contact) => {
        router.push(`/compose?to=${encodeURIComponent(contact.email)}`);
    };

    const handleEmailGroup = (groupName: string) => {
        const groupEmails = contacts
            .filter((c) => c.groups.includes(groupName))
            .map((c) => c.email)
            .join(",");
        if (groupEmails) {
            router.push(`/compose?to=${encodeURIComponent(groupEmails)}`);
        }
    };

    const handleBulkAssignGroup = (groupName: string) => {
        setContacts((prev) =>
            prev.map((c) =>
                selectedContacts.has(c.id) && !c.groups.includes(groupName)
                    ? { ...c, groups: [...c.groups, groupName] }
                    : c
            )
        );
        toast({
            title: "Group assigned",
            description: `${selectedContacts.size} contact(s) added to "${groupName}".`,
            variant: "success",
        });
        setSelectedContacts(new Set());
    };

    const handleBulkRemoveGroup = (groupName: string) => {
        const affectedCount = contacts.filter(
            (c) => selectedContacts.has(c.id) && c.groups.includes(groupName)
        ).length;

        if (affectedCount === 0) {
            toast({
                title: "No changes made",
                description: `None of the selected contacts belong to "${groupName}".`,
                variant: "info",
            });
            return;
        }

        setContacts((prev) =>
            prev.map((c) =>
                selectedContacts.has(c.id)
                    ? { ...c, groups: c.groups.filter((g) => g !== groupName) }
                    : c
            )
        );
        toast({
            title: "Group removed",
            description: `${affectedCount} contact(s) removed from "${groupName}".`,
            variant: "success",
        });
        setSelectedContacts(new Set());
    };

    const handleSubmitContact = async (contactData: {
        id?: string;
        name: string;
        email: string;
        company: string;
        role: string;
        groups: string[];
    }) => {
        try {
            if (contactData.id) {
                const res = await fetch(`/api/contacts/${contactData.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(contactData),
                });
                if (!res.ok) throw new Error("Update failed");
                const updated = await res.json();
                setContacts((prev) => prev.map((c) => (c.id === contactData.id ? { ...c, ...updated } : c)));
                toast({ title: "Contact updated", description: "The contact has been updated successfully.", variant: "success" });
            } else {
                const res = await fetch("/api/contacts", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(contactData),
                });
                if (!res.ok) throw new Error("Create failed");
                const created = await res.json();
                setContacts((prev) => [created, ...prev]);
                toast({ title: "Contact added", description: "The new contact has been added successfully.", variant: "success" });
            }
        } catch (err) {
            toast({ title: "Save failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
        }
    };

    /** Multi-row "Add contacts": saves each row, reports which ones failed. */
    const handleAddContacts = async (list: NewContact[]): Promise<AddContactsResult> => {
        const results = await Promise.allSettled(
            list.map(async (c) => {
                const res = await fetch("/api/contacts", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(c),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(apiErrorMessage(data, "Couldn't save this contact"));
                return data as Contact;
            })
        );
        const created: Contact[] = [];
        const failed: AddContactsResult["failed"] = [];
        results.forEach((r, i) => {
            if (r.status === "fulfilled") created.push(r.value);
            else failed.push({ email: list[i].email, message: r.reason instanceof Error ? r.reason.message : String(r.reason) });
        });
        if (created.length) {
            setContacts((prev) => [...created, ...prev]);
            toast({
                title: created.length === 1 ? "Contact added" : `${created.length} contacts added`,
                description: failed.length ? `${failed.length} couldn't be saved. They're still open to fix.` : undefined,
                variant: "success",
            });
        } else if (failed.length) {
            toast({ title: "Nothing was saved", description: "Check the highlighted rows and try again.", variant: "destructive" });
        }
        return { failed };
    };

    // Role management
    const handleAddRole = (name: string) => {
        const exists = roles.some((r) => r.name.toLowerCase() === name.toLowerCase());
        if (exists) {
            toast({
                title: "Role exists",
                description: "A role with this name already exists.",
                variant: "destructive",
            });
            return;
        }
        const newRole: ContactRole = {
            id: String(Date.now()),
            name,
        };
        setRoles((prev) => [...prev, newRole]);
        toast({
            title: "Role created",
            description: `"${name}" role has been created.`,
            variant: "success",
        });
    };

    const handleEditRole = (id: string, name: string) => {
        const oldRole = roles.find((r) => r.id === id);
        if (!oldRole) return;

        const exists = roles.some((r) => r.id !== id && r.name.toLowerCase() === name.toLowerCase());
        if (exists) {
            toast({
                title: "Role exists",
                description: "A role with this name already exists.",
                variant: "destructive",
            });
            return;
        }

        setRoles((prev) =>
            prev.map((r) => (r.id === id ? { ...r, name } : r))
        );

        setContacts((prev) =>
            prev.map((c) => (c.role === oldRole.name ? { ...c, role: name } : c))
        );

        toast({
            title: "Role updated",
            description: `Role renamed to "${name}".`,
            variant: "success",
        });
    };

    const handleDeleteRole = (id: string) => {
        const roleToDelete = roles.find((r) => r.id === id);
        if (!roleToDelete) return;

        setRoles((prev) => prev.filter((r) => r.id !== id));

        const remainingRoles = roles.filter((r) => r.id !== id);
        if (remainingRoles.length > 0) {
            setContacts((prev) =>
                prev.map((c) =>
                    c.role === roleToDelete.name ? { ...c, role: remainingRoles[0].name } : c
                )
            );
        }

        toast({
            title: "Role deleted",
            description: `"${roleToDelete.name}" role has been deleted.`,
            variant: "success",
        });
    };

    const getRoleContactCount = (roleName: string) => {
        return contacts.filter((c) => c.role === roleName).length;
    };

    // Bulk group management
    const handleAddBulkGroup = (name: string) => {
        const exists = bulkGroups.some((g) => g.name.toLowerCase() === name.toLowerCase());
        if (exists) {
            toast({
                title: "Group exists",
                description: "A group with this name already exists.",
                variant: "destructive",
            });
            return;
        }
        const newGroup: BulkGroup = {
            id: String(Date.now()),
            name,
        };
        setBulkGroups((prev) => [...prev, newGroup]);
        toast({
            title: "Group created",
            description: `"${name}" group has been created.`,
            variant: "success",
        });
    };

    const handleEditBulkGroup = (id: string, name: string) => {
        const oldGroup = bulkGroups.find((g) => g.id === id);
        if (!oldGroup) return;

        const exists = bulkGroups.some((g) => g.id !== id && g.name.toLowerCase() === name.toLowerCase());
        if (exists) {
            toast({
                title: "Group exists",
                description: "A group with this name already exists.",
                variant: "destructive",
            });
            return;
        }

        setBulkGroups((prev) =>
            prev.map((g) => (g.id === id ? { ...g, name } : g))
        );

        // Update contacts with the old group name
        setContacts((prev) =>
            prev.map((c) => ({
                ...c,
                groups: c.groups.map((g) => (g === oldGroup.name ? name : g)),
            }))
        );

        toast({
            title: "Group updated",
            description: `Group renamed to "${name}".`,
            variant: "success",
        });
    };

    const handleDeleteBulkGroup = (id: string) => {
        const groupToDelete = bulkGroups.find((g) => g.id === id);
        if (!groupToDelete) return;

        setBulkGroups((prev) => prev.filter((g) => g.id !== id));

        // Remove group from all contacts
        setContacts((prev) =>
            prev.map((c) => ({
                ...c,
                groups: c.groups.filter((g) => g !== groupToDelete.name),
            }))
        );

        toast({
            title: "Group deleted",
            description: `"${groupToDelete.name}" group has been deleted.`,
            variant: "success",
        });
    };

    const getBulkGroupContactCount = (groupName: string) => {
        return contacts.filter((c) => c.groups.includes(groupName)).length;
    };

    const handleReorderBulkGroups = (reorderedGroups: BulkGroup[]) => {
        setBulkGroups(reorderedGroups);
    };

    const handleQuickCreateGroup = () => {
        if (!newGroupName.trim()) return;
        handleAddBulkGroup(newGroupName.trim());
        setNewGroupName("");
        setIsCreatingGroup(false);
    };

    const handleDeleteGroupClick = (groupName: string) => {
        setGroupToDelete(groupName);
        setDeleteGroupDialogOpen(true);
        setGroupFilterOpen(false);
    };

    const handleStartEditGroupInFilter = (groupName: string) => {
        setEditingGroupInFilter(groupName);
        setEditGroupName(groupName);
    };

    const handleSaveEditGroupInFilter = () => {
        if (!editingGroupInFilter || !editGroupName.trim()) return;

        const group = bulkGroups.find((g) => g.name === editingGroupInFilter);
        if (group) {
            const oldName = editingGroupInFilter;
            handleEditBulkGroup(group.id, editGroupName.trim());
            // Update the filter if the current filter was renamed
            if (groupFilter.has(oldName)) {
                const next = new Set(groupFilter);
                next.delete(oldName);
                next.add(editGroupName.trim());
                setGroupFilter(next);
            }
        }
        setEditingGroupInFilter(null);
        setEditGroupName("");
    };

    const handleCancelEditGroupInFilter = () => {
        setEditingGroupInFilter(null);
        setEditGroupName("");
    };

    const handleConfirmDeleteGroup = () => {
        if (groupToDelete) {
            const group = bulkGroups.find((g) => g.name === groupToDelete);
            if (group) {
                handleDeleteBulkGroup(group.id);
                if (groupFilter.has(groupToDelete)) {
                    const next = new Set(groupFilter);
                    next.delete(groupToDelete);
                    setGroupFilter(next);
                }
            }
        }
        setGroupToDelete(null);
        setDeleteGroupDialogOpen(false);
    };

    const contactColumns: DataTableColumn<Contact>[] = [
        {
            id: "name",
            header: "Contact",
            hideable: false,
            sortValue: (c) => c.name,
            className: "min-w-[260px]",
            cell: (contact) => {
                const avatarColor = getAvatarColor(contact.name);
                return (
                    <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="h-8 w-8">
                            <AvatarFallback className={`text-xs font-semibold ${avatarColor.bg} ${avatarColor.text}`}>
                                {getInitials(contact.name)}
                            </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                            <p className="truncate font-semibold text-foreground">{contact.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{contact.email}</p>
                        </div>
                    </div>
                );
            },
        },
        {
            id: "company",
            header: "Company",
            sortValue: (c) => c.company,
            className: "min-w-[160px]",
            cell: (c) => <span className="text-foreground">{c.company || "—"}</span>,
        },
        {
            id: "role",
            header: "Role",
            sortValue: (c) => c.role,
            cell: (c) =>
                c.role ? (
                    <span className="inline-flex items-center rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        {c.role}
                    </span>
                ) : (
                    <span className="text-muted-foreground/50">—</span>
                ),
        },
        {
            id: "groups",
            header: "Groups",
            sortValue: (c) => c.groups.length,
            className: "min-w-[180px]",
            cell: (c) =>
                c.groups.length > 0 ? (
                    <div className="flex max-w-[260px] flex-wrap gap-1">
                        {c.groups.map((group) => {
                            const color = getGroupColor(group);
                            return (
                                <span key={group} className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${color.bg} ${color.text}`}>
                                    {group}
                                </span>
                            );
                        })}
                    </div>
                ) : (
                    <span className="text-muted-foreground/50">—</span>
                ),
        },
        {
            id: "emails",
            header: "Emails",
            sortValue: (c) => c.totalEmails,
            className: "whitespace-nowrap",
            cell: (c) => <span className="font-semibold tabular-nums">{c.totalEmails.toLocaleString()}</span>,
        },
    ];

    return (
        <>
            <div className={cn("flex h-[calc(100dvh-4rem)] min-h-[600px] flex-col px-4 py-6 md:px-8", selectedContacts.size > 0 && "pb-24")}>
                <PageHeader
                    icon={Users}
                    title="Contacts"
                    count={contacts.length}
                    description={`${bulkGroups.length} groups · ${contacts.reduce((s, c) => s + c.totalEmails, 0).toLocaleString()} emails sent`}
                    action={
                        <>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" className="h-9 rounded-lg bg-card shadow-sm">
                                                <Settings2 className="w-4 h-4" />
                                                <span className="hidden sm:inline">Manage</span>
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-52">
                                            <DropdownMenuItem onClick={() => setRolesDialogOpen(true)}>
                                                <UserCircle className="w-4 h-4 mr-2" />
                                                Roles
                                                <span className="ml-auto text-xs text-muted-foreground tabular-nums">{roles.length}</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => setGroupsDialogOpen(true)}>
                                                <Tags className="w-4 h-4 mr-2" />
                                                Groups
                                                <span className="ml-auto text-xs text-muted-foreground tabular-nums">{bulkGroups.length}</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem onClick={() => handleExport("xlsx")}>
                                                <Download className="w-4 h-4 mr-2" />
                                                Export Excel
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleExport("csv")}>
                                                <Download className="w-4 h-4 mr-2" />
                                                Export CSV
                                            </DropdownMenuItem>
                                            <DropdownMenuItem disabled={importing} onClick={() => importInputRef.current?.click()}>
                                                <Upload className="w-4 h-4 mr-2" />
                                                {importing ? "Importing…" : "Import CSV / Excel"}
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                    <input ref={importInputRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={handleImport} />
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button onClick={handleAddContact} className="h-9 rounded-lg">
                                                    <Plus className="w-4 h-4" />
                                                    Add Contact
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent side="bottom">
                                                <p className="text-xs">Add new contact <kbd className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-muted rounded border">Ctrl+N</kbd></p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                        </>
                    }
                />

                <DataTable
                    data={filteredContacts}
                    columns={contactColumns}
                    getRowId={(c) => c.id}
                    itemLabel="contacts"
                    loading={contactsLoading}
                    search={searchQuery}
                    onSearchChange={setSearchQuery}
                    searchPlaceholder="Search by name, email, or company…"
                    selectable
                    selectedIds={selectedContacts}
                    onSelectedIdsChange={setSelectedContacts}
                    showSelectionCount={false}
                    onRowClick={(c) => setDrawerContact(c)}
                    filters={
                            <FilterMenu categories={filterCategories} onClearAll={clearAllFilters} />
                    }
                    afterColumns={activeFilterCount > 0 ? <ClearFiltersButton onClick={clearAllFilters} /> : undefined}
                    subToolbar={
                        <ActiveFilterChips categories={filterCategories}>
                            {groupFilter.size === 1 && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 gap-1.5 text-xs text-primary hover:bg-accent hover:text-primary"
                                    onClick={() => handleEmailGroup([...groupFilter][0])}
                                >
                                    <Mail className="w-3 h-3" />
                                    Email this group
                                </Button>
                            )}
                        </ActiveFilterChips>
                    }
                    rowActions={(contact) => (
                        <div className="flex items-center justify-end gap-0.5 text-muted-foreground">
                            <TooltipProvider delayDuration={300}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon-sm" aria-label="Send email" onClick={() => handleSingleEmail(contact)} className="hover:text-primary">
                                            <Mail className="w-4 h-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top"><p className="text-xs">Send email</p></TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon-sm" aria-label="Edit contact" onClick={() => handleEditContact(contact)} className="hover:text-foreground">
                                            <Edit2 className="w-4 h-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top"><p className="text-xs">Edit</p></TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon-sm" aria-label="Delete contact" onClick={() => handleDeleteClick(contact)} className="hover:text-destructive">
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top"><p className="text-xs">Delete</p></TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    )}
                    emptyState={() =>
                        activeFilterCount > 0 || searchQuery ? (
                            <>
                                <PlayOnceImage
                                    animatedSrc="/illustrations/no-contacts.webp"
                                    staticSrc="/illustrations/no-contacts.png"
                                    durationMs={2200}
                                    width={128}
                                    height={128}
                                    className="h-32 w-32"
                                />
                                <p className="text-sm text-muted-foreground">No contacts match your search or filters.</p>
                                <Button variant="outline" size="sm" onClick={clearAllFilters}>
                                    Clear filters
                                </Button>
                            </>
                        ) : (
                            <>
                                <PlayOnceImage
                                    animatedSrc="/illustrations/no-contacts.webp"
                                    staticSrc="/illustrations/no-contacts.png"
                                    durationMs={2200}
                                    width={128}
                                    height={128}
                                    className="h-32 w-32"
                                />
                                <p className="text-sm text-muted-foreground">No contacts yet. Hit Add Contact to create your first one.</p>
                            </>
                        )
                    }
                />
            </div>

            {/* ── Floating Bulk Action Toolbar ─────────────────────────────── */}
            <AnimatePresence>
                {selectedContacts.size > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 24, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 24, scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 320, damping: 28 }}
                        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40"
                    >
                        <div className="flex items-center gap-1 px-2 py-1.5 rounded-full bg-foreground text-background shadow-2xl border border-foreground/10">
                            <div className="flex items-center gap-2 pl-3 pr-2 py-1.5 border-r border-background/15">
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold tabular-nums">
                                    {selectedContacts.size}
                                </span>
                                <span className="text-xs font-medium hidden sm:inline">selected</span>
                            </div>

                            <TooltipProvider delayDuration={200}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-8 px-3 text-xs hover:bg-background/10 text-background hover:text-background gap-1.5" onClick={handleBulkEmail}>
                                            <Send className="w-3.5 h-3.5" />
                                            <span className="hidden sm:inline">Email</span>
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top"><p className="text-xs">Compose email to selected</p></TooltipContent>
                                </Tooltip>

                                {groupOptions.length > 0 && (
                                    <>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="sm" className="h-8 px-3 text-xs hover:bg-background/10 text-background hover:text-background gap-1.5">
                                                    <Tags className="w-3.5 h-3.5" />
                                                    <span className="hidden sm:inline">Add to</span>
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="center" side="top">
                                                {groupOptions.map((group) => (
                                                    <DropdownMenuItem key={group} onClick={() => handleBulkAssignGroup(group)}>
                                                        <Tags className="w-3.5 h-3.5 mr-2" />
                                                        {group}
                                                    </DropdownMenuItem>
                                                ))}
                                            </DropdownMenuContent>
                                        </DropdownMenu>

                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="sm" className="h-8 px-3 text-xs hover:bg-background/10 text-background hover:text-background gap-1.5">
                                                    <Minus className="w-3.5 h-3.5" />
                                                    <span className="hidden sm:inline">Remove</span>
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="center" side="top">
                                                {groupOptions.map((group) => (
                                                    <DropdownMenuItem key={group} onClick={() => handleBulkRemoveGroup(group)}>
                                                        <Tags className="w-3.5 h-3.5 mr-2" />
                                                        {group}
                                                    </DropdownMenuItem>
                                                ))}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </>
                                )}

                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-8 px-3 text-xs hover:bg-background/10 text-background hover:text-background gap-1.5" onClick={() => setShareDialogOpen(true)}>
                                            <Share2 className="w-3.5 h-3.5" />
                                            <span className="hidden sm:inline">Share</span>
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top"><p className="text-xs">Send a copy to another admin</p></TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-8 px-3 text-xs hover:bg-destructive/20 text-background hover:text-destructive-foreground gap-1.5" onClick={handleBulkDeleteClick}>
                                            <Trash2 className="w-3.5 h-3.5" />
                                            <span className="hidden sm:inline">Delete</span>
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top"><p className="text-xs">Delete selected contacts</p></TooltipContent>
                                </Tooltip>

                                <div className="w-px h-5 bg-background/15 mx-0.5" />

                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon-sm" className="h-8 w-8 hover:bg-background/10 text-background hover:text-background" onClick={() => setSelectedContacts(new Set())} aria-label="Clear selection">
                                            <X className="w-4 h-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top"><p className="text-xs">Clear selection</p></TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AddContactsDialog
                open={dialogOpen && !editContact}
                onOpenChange={setDialogOpen}
                onSubmit={handleAddContacts}
                roleOptions={roleOptions}
                groupOptions={groupOptions}
                existingEmails={contacts.map((c) => c.email)}
            />

            <ContactDialog
                open={dialogOpen && !!editContact}
                onOpenChange={setDialogOpen}
                onSubmit={handleSubmitContact}
                editContact={editContact}
                roleOptions={roleOptions}
                groupOptions={groupOptions}
            />

            <RolesManagementDialog
                open={rolesDialogOpen}
                onOpenChange={setRolesDialogOpen}
                roles={roles}
                onAddRole={handleAddRole}
                onEditRole={handleEditRole}
                onDeleteRole={handleDeleteRole}
                getRoleContactCount={getRoleContactCount}
            />

            {shareDialogOpen && (
                <ShareContactsDialog
                    open={shareDialogOpen}
                    onOpenChange={setShareDialogOpen}
                    contactIds={Array.from(selectedContacts)}
                    onShared={() => setSelectedContacts(new Set())}
                />
            )}

            <BulkGroupsManagementDialog
                open={groupsDialogOpen}
                onOpenChange={setGroupsDialogOpen}
                groups={bulkGroups}
                onAddGroup={handleAddBulkGroup}
                onEditGroup={handleEditBulkGroup}
                onDeleteGroup={handleDeleteBulkGroup}
                onReorderGroups={handleReorderBulkGroups}
                getGroupContactCount={getBulkGroupContactCount}
            />

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Contact</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete "{contactToDelete?.name}"? This action cannot be undone.
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

            <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Selected Contacts</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete {selectedContacts.size} selected contact{selectedContacts.size > 1 ? "s" : ""}? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmBulkDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete {selectedContacts.size} Contact{selectedContacts.size > 1 ? "s" : ""}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={deleteGroupDialogOpen} onOpenChange={setDeleteGroupDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Group</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete "{groupToDelete}"? This will remove the group from all contacts.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmDeleteGroup}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <ContactDetailDrawer
                contact={drawerContact}
                onClose={() => setDrawerContact(null)}
                onEdit={(contact) => {
                    setEditContact(contact);
                    setDialogOpen(true);
                }}
            />
        </>
    );
}
