"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, Users, MoreVertical, Mail, Edit2, Trash2, Building2, UserCircle, Send, Tags, Minus, Check, Download, Upload, ChevronLeft, ChevronRight, X, SlidersHorizontal, Settings2, FilterX } from "lucide-react";

import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
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
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
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
import { RolesManagementDialog } from "@/components/contacts/RolesManagementDialog";
import { BulkGroupsManagementDialog } from "@/components/contacts/BulkGroupsManagementDialog";
import { ContactDetailDrawer } from "@/components/contacts/ContactDetailDrawer";
import { TopBarActions } from "@/components/layout/TopBarActions";
import { useToast } from "@/hooks/use-toast";
import { usePagination } from "@/hooks/usePagination";

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

function FilterChip({
    icon: Icon,
    label,
    onRemove,
}: {
    icon: (props: { className?: string }) => React.ReactNode;
    label: string;
    onRemove: () => void;
}) {
    return (
        <span className="inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-full bg-accent text-accent-foreground text-xs font-medium border border-border">
            <Icon className="w-3 h-3 opacity-70" />
            <span className="max-w-[140px] truncate">{label}</span>
            <button
                onClick={onRemove}
                className="rounded-full p-0.5 hover:bg-foreground/10 transition-colors"
                aria-label={`Remove ${label} filter`}
            >
                <X className="w-3 h-3" />
            </button>
        </span>
    );
}

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
    }, []);
    const [searchQuery, setSearchQuery] = useState("");
    const [companyFilter, setCompanyFilter] = useState<string>("all");
    const [roleFilter, setRoleFilter] = useState<string>("all");
    const [groupFilter, setGroupFilter] = useState<string>("all");
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
    const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
    const importInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();
    const router = useRouter();

    const activeFilterCount =
        (companyFilter !== "all" ? 1 : 0) +
        (roleFilter !== "all" ? 1 : 0) +
        (groupFilter !== "all" ? 1 : 0);

    const clearAllFilters = () => {
        setCompanyFilter("all");
        setRoleFilter("all");
        setGroupFilter("all");
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

    const handleExportCsv = () => {
        const headers = ["Name", "Email", "Company", "Role", "Groups", "Total Emails"];
        const rows = contacts.map((c) => [
            c.name, c.email, c.company, c.role, c.groups.join(";"), String(c.totalEmails),
        ]);
        const csv = [headers, ...rows]
            .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
            .join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "contacts.csv";
        a.click();
        URL.revokeObjectURL(url);
        toast({ title: "Contacts exported", description: `${contacts.length} contacts exported to CSV.` });
    };

    const handleImportCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const text = ev.target?.result as string;
                const lines = text.split("\n").filter(Boolean);
                const imported: Contact[] = lines.slice(1).map((line, i) => {
                    const cols = line.split(",").map((c) => c.replace(/^"|"$/g, "").replace(/""/g, '"'));
                    return {
                        id: `imported-${Date.now()}-${i}`,
                        name: cols[0] ?? "",
                        email: cols[1] ?? "",
                        company: cols[2] ?? "",
                        role: cols[3] ?? roleOptions[0] ?? "",
                        groups: cols[4] ? cols[4].split(";").filter(Boolean) : [],
                        totalEmails: parseInt(cols[5] ?? "0", 10) || 0,
                    };
                }).filter((c) => c.name && c.email);
                setContacts((prev) => {
                    const existingEmails = new Set(prev.map((c) => c.email));
                    const newOnes = imported.filter((c) => !existingEmails.has(c.email));
                    return [...prev, ...newOnes];
                });
                toast({ title: "Contacts imported", description: `${imported.length} contacts imported successfully.` });
            } catch {
                toast({ title: "Import failed", description: "Could not parse the CSV file." });
            }
        };
        reader.readAsText(file);
        e.target.value = "";
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
        const matchesCompany = companyFilter === "all" || contact.company === companyFilter;
        const matchesRole = roleFilter === "all" || contact.role === roleFilter;
        const matchesGroup = groupFilter === "all" || contact.groups.includes(groupFilter);
        return matchesSearch && matchesCompany && matchesRole && matchesGroup;
    });

    const { page: contactPage, totalPages: contactTotalPages, paginatedItems: pagedContacts,
        goNext: goContactNext, goPrev: goContactPrev, hasNext: hasContactNext, hasPrev: hasContactPrev,
        from: contactFrom, to: contactTo, reset: resetContactPage } =
        usePagination(filteredContacts, 10);

    // Reset pagination when filters change
    useEffect(() => { resetContactPage(); }, [searchQuery, companyFilter, roleFilter, groupFilter]); // eslint-disable-line react-hooks/exhaustive-deps

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

    const handleSelectContact = (contactId: string, checked: boolean) => {
        setSelectedContacts((prev) => {
            const next = new Set(prev);
            if (checked) {
                next.add(contactId);
            } else {
                next.delete(contactId);
            }
            return next;
        });
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedContacts(new Set(filteredContacts.map((c) => c.id)));
        } else {
            setSelectedContacts(new Set());
        }
    };

    const isAllSelected = filteredContacts.length > 0 && filteredContacts.every((c) => selectedContacts.has(c.id));
    const isSomeSelected = filteredContacts.some((c) => selectedContacts.has(c.id));

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
            if (groupFilter === oldName) {
                setGroupFilter(editGroupName.trim());
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
                if (groupFilter === groupToDelete) {
                    setGroupFilter("all");
                }
            }
        }
        setGroupToDelete(null);
        setDeleteGroupDialogOpen(false);
    };

    return (
        <>
            <div className="p-4 md:p-8 max-w-7xl mx-auto pb-32">
                {/* ── Header ───────────────────────────────────────────────── */}
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-heading-2 font-heading text-foreground tracking-tight">Contacts</h1>
                        <p className="text-body-sm text-muted-foreground mt-1">
                            <span className="font-medium text-foreground">{contacts.length}</span> people
                            <span className="mx-2 text-muted-foreground/40">·</span>
                            <span className="font-medium text-foreground">{bulkGroups.length}</span> groups
                            <span className="mx-2 text-muted-foreground/40">·</span>
                            <span className="font-medium text-foreground">{contacts.reduce((s, c) => s + c.totalEmails, 0).toLocaleString()}</span> emails sent
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="default" className="h-10">
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
                                <DropdownMenuItem onClick={handleExportCsv}>
                                    <Download className="w-4 h-4 mr-2" />
                                    Export CSV
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => importInputRef.current?.click()}>
                                    <Upload className="w-4 h-4 mr-2" />
                                    Import CSV
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <input ref={importInputRef} type="file" accept=".csv" className="hidden" onChange={handleImportCsv} />
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button onClick={handleAddContact} className="h-10 shadow-primary">
                                        <Plus className="w-4 h-4" />
                                        Add Contact
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">
                                    <p className="text-xs">Add new contact <kbd className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-muted rounded border">Ctrl+N</kbd></p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        <TopBarActions />
                    </div>
                </div>

                {/* ── Hero search + Filter pivot ───────────────────────────── */}
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 mb-3"
                >
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        <Input
                            placeholder="Search by name, email, or company…"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-11 pr-10 h-11 bg-card border-border shadow-card focus-visible:ring-1"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery("")}
                                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                                aria-label="Clear search"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    <Popover open={filterPopoverOpen} onOpenChange={setFilterPopoverOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="h-11 gap-2 relative whitespace-nowrap">
                                <SlidersHorizontal className="w-4 h-4" />
                                Filter
                                {activeFilterCount > 0 && (
                                    <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold tabular-nums">
                                        {activeFilterCount}
                                    </span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[320px] p-4" align="end">
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-sm font-medium">Refine results</p>
                                {activeFilterCount > 0 && (
                                    <button
                                        onClick={clearAllFilters}
                                        className="text-xs text-primary hover:underline flex items-center gap-1"
                                    >
                                        <FilterX className="w-3 h-3" /> Clear all
                                    </button>
                                )}
                            </div>
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Company</label>
                                    <Select value={companyFilter} onValueChange={setCompanyFilter}>
                                        <SelectTrigger className="w-full">
                                            <Building2 className="w-4 h-4 mr-2 text-muted-foreground" />
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All companies</SelectItem>
                                            {companies.map((company) => (
                                                <SelectItem key={company} value={company}>{company}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Role</label>
                                    <Select value={roleFilter} onValueChange={setRoleFilter}>
                                        <SelectTrigger className="w-full">
                                            <UserCircle className="w-4 h-4 mr-2 text-muted-foreground" />
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All roles</SelectItem>
                                            {roleOptions.map((role) => (
                                                <SelectItem key={role} value={role}>{role}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Group</label>
                                    <Select value={groupFilter} onValueChange={setGroupFilter}>
                                        <SelectTrigger className="w-full">
                                            <Tags className="w-4 h-4 mr-2 text-muted-foreground" />
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All groups</SelectItem>
                                            {groupOptions.map((group) => (
                                                <SelectItem key={group} value={group}>{group}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>
                </motion.div>

                {/* ── Active filter chips + result counter ─────────────────── */}
                <div className="flex items-center justify-between gap-3 mb-4 min-h-[28px]">
                    <div className="flex flex-wrap items-center gap-2">
                        {activeFilterCount > 0 && (
                            <>
                                {companyFilter !== "all" && (
                                    <FilterChip icon={Building2} label={companyFilter} onRemove={() => setCompanyFilter("all")} />
                                )}
                                {roleFilter !== "all" && (
                                    <FilterChip icon={UserCircle} label={roleFilter} onRemove={() => setRoleFilter("all")} />
                                )}
                                {groupFilter !== "all" && (
                                    <FilterChip icon={Tags} label={groupFilter} onRemove={() => setGroupFilter("all")} />
                                )}
                                <button onClick={clearAllFilters} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                                    Clear all
                                </button>
                            </>
                        )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                        {groupFilter !== "all" && (
                            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 text-primary hover:text-primary hover:bg-accent" onClick={() => handleEmailGroup(groupFilter)}>
                                <Mail className="w-3 h-3" />
                                Email this group
                            </Button>
                        )}
                        <span>{filteredContacts.length} {filteredContacts.length === 1 ? "result" : "results"}</span>
                    </div>
                </div>

                {/* ── Contacts Table ───────────────────────────────────────── */}
                {filteredContacts.length > 0 ? (
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 }}
                        className="bg-card rounded-xl border border-border shadow-card overflow-hidden"
                    >
                        <div className="overflow-x-auto">
                            <table className="w-full table-fixed">
                                <colgroup>
                                    <col className="w-12" />
                                    <col className="w-[26%]" />
                                    <col className="w-[16%]" />
                                    <col className="w-[12%]" />
                                    <col />
                                    <col className="w-[110px]" />
                                    <col className="w-[140px]" />
                                </colgroup>
                                <thead>
                                    <tr className="border-b border-border bg-muted/40">
                                        <th className="px-4 py-3">
                                            <Checkbox
                                                checked={isAllSelected}
                                                onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                                                aria-label="Select all contacts"
                                                className={isSomeSelected && !isAllSelected ? "data-[state=checked]:bg-primary/50" : ""}
                                            />
                                        </th>
                                        <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Contact</th>
                                        <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Company</th>
                                        <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Role</th>
                                        <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Groups</th>
                                        <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Emails</th>
                                        <th className="text-right text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pagedContacts.map((contact) => {
                                        const isSelected = selectedContacts.has(contact.id);
                                        const avatarColor = getAvatarColor(contact.name);
                                        return (
                                            <motion.tr
                                                key={contact.id}
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                onClick={() => setDrawerContact(contact)}
                                                className={`group/row border-b border-border last:border-b-0 transition-colors cursor-pointer ${isSelected ? "bg-primary/[0.06]" : "hover:bg-muted/40"}`}
                                            >
                                                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                                    <Checkbox
                                                        checked={isSelected}
                                                        onCheckedChange={(checked) => handleSelectContact(contact.id, checked as boolean)}
                                                        aria-label={`Select ${contact.name}`}
                                                    />
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="h-9 w-9 ring-2 ring-background">
                                                            <AvatarFallback className={`text-xs font-semibold ${avatarColor.bg} ${avatarColor.text}`}>
                                                                {getInitials(contact.name)}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-medium text-foreground truncate">{contact.name}</p>
                                                            <p className="text-xs text-muted-foreground truncate">{contact.email}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="text-sm text-foreground">{contact.company}</span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-muted text-muted-foreground border border-border">
                                                        {contact.role}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    {contact.groups.length > 0 ? (
                                                        <div className="flex flex-wrap gap-1 max-w-[220px]">
                                                            {contact.groups.map((group) => {
                                                                const color = getGroupColor(group);
                                                                return (
                                                                    <span
                                                                        key={group}
                                                                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold ${color.bg} ${color.text}`}
                                                                    >
                                                                        {group}
                                                                    </span>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground/50">—</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="text-sm font-semibold text-foreground tabular-nums">
                                                        {contact.totalEmails.toLocaleString()}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
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
                                                </td>
                                            </motion.tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                ) : activeFilterCount > 0 || searchQuery ? (
                    <EmptyState
                        icon={<FilterX className="w-8 h-8 text-muted-foreground" />}
                        title="No contacts match your filters"
                        description="Try adjusting your search or removing some filters."
                        action={
                            <Button variant="outline" onClick={clearAllFilters}>
                                <FilterX className="w-4 h-4" />
                                Clear filters
                            </Button>
                        }
                    />
                ) : (
                    <EmptyState
                        icon={<Users className="w-8 h-8 text-muted-foreground" />}
                        title="No contacts yet"
                        description="Add your first contact to start sending emails."
                        action={
                            <Button onClick={handleAddContact}>
                                <Plus className="w-4 h-4" />
                                Add Contact
                            </Button>
                        }
                    />
                )}

                {/* ── Footer (one-line) ────────────────────────────────────── */}
                {filteredContacts.length > 0 && (
                    <div className="flex items-center justify-between gap-3 mt-4 px-1 text-xs text-muted-foreground tabular-nums">
                        <span>Showing {contactFrom}–{contactTo} of {filteredContacts.length}</span>
                        {contactTotalPages > 1 && (
                            <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon-sm" onClick={goContactPrev} disabled={!hasContactPrev} aria-label="Previous page">
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <span className="px-2 font-medium">Page {contactPage} of {contactTotalPages}</span>
                                <Button variant="ghost" size="icon-sm" onClick={goContactNext} disabled={!hasContactNext} aria-label="Next page">
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                    </div>
                )}
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

            <ContactDialog
                open={dialogOpen}
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
