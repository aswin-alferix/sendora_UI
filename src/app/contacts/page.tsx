"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, Users, MoreVertical, Mail, Edit2, Trash2, Building2, UserCircle, Send, Tags, Minus, Check } from "lucide-react";

import { PageHeader } from "@/components/shared/PageHeader";
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
];

const defaultBulkGroups: BulkGroup[] = [
    { id: "1", name: "Newsletter" },
    { id: "2", name: "Marketing" },
];

const mockContacts: Contact[] = [
    { id: "1", name: "John Doe", email: "john.doe@company.com", company: "Company Inc", role: "Employee", groups: ["Newsletter"], totalEmails: 45 },
    { id: "2", name: "Sarah Miller", email: "sarah@startup.io", company: "Startup.io", role: "Client", groups: ["Marketing", "Newsletter"], totalEmails: 32 },
    { id: "3", name: "Mike Johnson", email: "mike@agency.co", company: "Agency Co", role: "Contractor", groups: [], totalEmails: 28 },
    { id: "4", name: "Emily Chen", email: "emily@techcorp.com", company: "TechCorp", role: "Consultant", groups: ["Newsletter"], totalEmails: 19 },
    { id: "5", name: "David Wilson", email: "david@enterprise.com", company: "Enterprise Ltd", role: "Employee", groups: ["Marketing"], totalEmails: 15 },
    { id: "6", name: "Lisa Brown", email: "lisa@design.studio", company: "Design Studio", role: "Client", groups: [], totalEmails: 12 },
];

// Color palette for group badges
const groupColors = [
    { bg: "bg-blue-100 dark:bg-blue-900/40", text: "text-blue-700 dark:text-blue-300", border: "border-blue-200 dark:border-blue-800" },
    { bg: "bg-emerald-100 dark:bg-emerald-900/40", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-200 dark:border-emerald-800" },
    { bg: "bg-purple-100 dark:bg-purple-900/40", text: "text-purple-700 dark:text-purple-300", border: "border-purple-200 dark:border-purple-800" },
    { bg: "bg-amber-100 dark:bg-amber-900/40", text: "text-amber-700 dark:text-amber-300", border: "border-amber-200 dark:border-amber-800" },
    { bg: "bg-rose-100 dark:bg-rose-900/40", text: "text-rose-700 dark:text-rose-300", border: "border-rose-200 dark:border-rose-800" },
    { bg: "bg-cyan-100 dark:bg-cyan-900/40", text: "text-cyan-700 dark:text-cyan-300", border: "border-cyan-200 dark:border-cyan-800" },
    { bg: "bg-orange-100 dark:bg-orange-900/40", text: "text-orange-700 dark:text-orange-300", border: "border-orange-200 dark:border-orange-800" },
    { bg: "bg-indigo-100 dark:bg-indigo-900/40", text: "text-indigo-700 dark:text-indigo-300", border: "border-indigo-200 dark:border-indigo-800" },
];

const getGroupColor = (groupName: string) => {
    // Generate consistent color index from group name
    let hash = 0;
    for (let i = 0; i < groupName.length; i++) {
        hash = groupName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % groupColors.length;
    return groupColors[index];
};

export default function ContactsPage() {
    const [contacts, setContacts] = useState<Contact[]>(mockContacts);
    const [roles, setRoles] = useState<ContactRole[]>(defaultRoles);
    const [bulkGroups, setBulkGroups] = useState<BulkGroup[]>(defaultBulkGroups);
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
    const [groupFilterOpen, setGroupFilterOpen] = useState(false);
    const [newGroupName, setNewGroupName] = useState("");
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);
    const [deleteGroupDialogOpen, setDeleteGroupDialogOpen] = useState(false);
    const [groupToDelete, setGroupToDelete] = useState<string | null>(null);
    const [editingGroupInFilter, setEditingGroupInFilter] = useState<string | null>(null);
    const [editGroupName, setEditGroupName] = useState("");
    const { toast } = useToast();
    const router = useRouter();

    const roleOptions = useMemo(() => roles.map((r) => r.name), [roles]);
    const groupOptions = useMemo(() => bulkGroups.map((g) => g.name), [bulkGroups]);

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

    const handleConfirmDelete = () => {
        if (contactToDelete) {
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

    const handleConfirmBulkDelete = () => {
        setContacts((prev) => prev.filter((c) => !selectedContacts.has(c.id)));
        toast({
            title: "Contacts deleted",
            description: `${selectedContacts.size} contact(s) have been removed successfully.`,
            variant: "success",
        });
        setSelectedContacts(new Set());
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

    const handleSubmitContact = (contactData: {
        id?: string;
        name: string;
        email: string;
        company: string;
        role: string;
        groups: string[];
    }) => {
        if (contactData.id) {
            // Edit existing contact
            setContacts((prev) =>
                prev.map((c) =>
                    c.id === contactData.id
                        ? { ...c, name: contactData.name, email: contactData.email, company: contactData.company, role: contactData.role, groups: contactData.groups }
                        : c
                )
            );
            toast({
                title: "Contact updated",
                description: "The contact has been updated successfully.",
                variant: "success",
            });
        } else {
            // Add new contact
            const newContact: Contact = {
                id: String(Date.now()),
                name: contactData.name,
                email: contactData.email,
                company: contactData.company,
                role: contactData.role,
                groups: contactData.groups,
                totalEmails: 0,
            };
            setContacts((prev) => [...prev, newContact]);
            toast({
                title: "Contact added",
                description: "The new contact has been added successfully.",
                variant: "success",
            });
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
            <div className="p-4 md:p-8 max-w-7xl mx-auto">
                <PageHeader
                    title="Contacts"
                    description="Manage your email contacts and recipients"
                    action={
                        <TooltipProvider>
                            <div className="flex items-center gap-2">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="outline" onClick={() => setRolesDialogOpen(true)}>
                                            <UserCircle className="w-4 h-4" />
                                            Manage Roles
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Manage Roles <kbd className="ml-1 px-1.5 py-0.5 text-xs bg-muted rounded border">Ctrl+R</kbd></p>
                                    </TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="outline" onClick={() => setGroupsDialogOpen(true)}>
                                            <Tags className="w-4 h-4" />
                                            Manage Groups
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Manage Groups <kbd className="ml-1 px-1.5 py-0.5 text-xs bg-muted rounded border">Ctrl+G</kbd></p>
                                    </TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button onClick={handleAddContact}>
                                            <Plus className="w-4 h-4" />
                                            Add Contact
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Add Contact <kbd className="ml-1 px-1.5 py-0.5 text-xs bg-muted rounded border">Ctrl+N</kbd></p>
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                        </TooltipProvider>
                    }
                />

                {/* Search and Filter */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 flex flex-col sm:flex-row gap-4"
                >
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search contacts..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <Select value={companyFilter} onValueChange={setCompanyFilter}>
                        <SelectTrigger className="w-full sm:w-[180px]">
                            <Building2 className="w-4 h-4 mr-2 text-muted-foreground" />
                            <SelectValue placeholder="Filter by company" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Companies</SelectItem>
                            {companies.map((company) => (
                                <SelectItem key={company} value={company}>
                                    {company}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={roleFilter} onValueChange={setRoleFilter}>
                        <SelectTrigger className="w-full sm:w-[150px]">
                            <UserCircle className="w-4 h-4 mr-2 text-muted-foreground" />
                            <SelectValue placeholder="Filter by role" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Roles</SelectItem>
                            {roleOptions.map((role) => (
                                <SelectItem key={role} value={role}>
                                    {role}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Popover open={groupFilterOpen} onOpenChange={(open) => {
                        setGroupFilterOpen(open);
                        if (!open) {
                            setIsCreatingGroup(false);
                            setNewGroupName("");
                            setEditingGroupInFilter(null);
                            setEditGroupName("");
                        }
                    }}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={groupFilterOpen}
                                className="w-full sm:w-[180px] justify-between"
                            >
                                <Tags className="w-4 h-4 mr-2 text-muted-foreground" />
                                <span className="truncate">
                                    {groupFilter === "all" ? "All Groups" : groupFilter}
                                </span>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[220px] p-0" align="start">
                            <Command>
                                <CommandInput placeholder="Search groups..." />
                                <CommandList>
                                    <CommandEmpty>No group found.</CommandEmpty>
                                    <CommandGroup>
                                        <CommandItem
                                            value="all"
                                            onSelect={() => {
                                                setGroupFilter("all");
                                                setGroupFilterOpen(false);
                                            }}
                                        >
                                            <Check className={`mr-2 h-4 w-4 ${groupFilter === "all" ? "opacity-100" : "opacity-0"}`} />
                                            All Groups
                                        </CommandItem>
                                        {groupOptions.map((group) => (
                                            editingGroupInFilter === group ? (
                                                <div key={group} className="flex items-center gap-2 p-2">
                                                    <Input
                                                        value={editGroupName}
                                                        onChange={(e) => setEditGroupName(e.target.value)}
                                                        placeholder="Group name"
                                                        className="h-8 text-sm flex-1"
                                                        autoFocus
                                                        onKeyDown={(e) => {
                                                            if (e.key === "Enter") {
                                                                e.preventDefault();
                                                                handleSaveEditGroupInFilter();
                                                            } else if (e.key === "Escape") {
                                                                handleCancelEditGroupInFilter();
                                                            }
                                                        }}
                                                    />
                                                    <Button
                                                        size="sm"
                                                        className="h-8 px-2"
                                                        onClick={handleSaveEditGroupInFilter}
                                                        disabled={!editGroupName.trim()}
                                                    >
                                                        <Check className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <CommandItem
                                                    key={group}
                                                    value={group}
                                                    onSelect={() => {
                                                        setGroupFilter(group);
                                                        setGroupFilterOpen(false);
                                                    }}
                                                    className="flex items-center justify-between group/item"
                                                >
                                                    <div className="flex items-center">
                                                        <Check className={`mr-2 h-4 w-4 ${groupFilter === group ? "opacity-100" : "opacity-0"}`} />
                                                        {group}
                                                    </div>
                                                    <div className="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                                                        <Edit2
                                                            className="h-4 w-4 text-muted-foreground hover:text-foreground cursor-pointer"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleStartEditGroupInFilter(group);
                                                            }}
                                                        />
                                                        <Trash2
                                                            className="h-4 w-4 text-muted-foreground hover:text-destructive cursor-pointer"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeleteGroupClick(group);
                                                            }}
                                                        />
                                                    </div>
                                                </CommandItem>
                                            )
                                        ))}
                                    </CommandGroup>
                                    <CommandSeparator />
                                    <CommandGroup>
                                        {isCreatingGroup ? (
                                            <div className="flex items-center gap-2 p-2">
                                                <Input
                                                    value={newGroupName}
                                                    onChange={(e) => setNewGroupName(e.target.value)}
                                                    placeholder="Group name"
                                                    className="h-8 text-sm"
                                                    autoFocus
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter") {
                                                            e.preventDefault();
                                                            handleQuickCreateGroup();
                                                        } else if (e.key === "Escape") {
                                                            setIsCreatingGroup(false);
                                                            setNewGroupName("");
                                                        }
                                                    }}
                                                />
                                                <Button
                                                    size="sm"
                                                    className="h-8 px-2"
                                                    onClick={handleQuickCreateGroup}
                                                    disabled={!newGroupName.trim()}
                                                >
                                                    <Plus className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ) : (
                                            <CommandItem
                                                onSelect={() => setIsCreatingGroup(true)}
                                                className="text-primary"
                                            >
                                                <Plus className="mr-2 h-4 w-4" />
                                                Create New Group
                                            </CommandItem>
                                        )}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                    {groupFilter !== "all" && (
                        <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleEmailGroup(groupFilter)}
                            className="whitespace-nowrap"
                        >
                            <Mail className="w-4 h-4 mr-2" />
                            Email Group
                        </Button>
                    )}
                </motion.div>

                {/* Bulk Actions Bar */}
                <AnimatePresence>
                    {selectedContacts.size > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="mb-4 p-4 bg-accent rounded-lg border border-border flex items-center justify-between"
                        >
                            <span className="text-body-base font-medium">
                                {selectedContacts.size} contact{selectedContacts.size > 1 ? "s" : ""} selected
                            </span>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setSelectedContacts(new Set())}
                                >
                                    Clear Selection
                                </Button>
                                {groupOptions.length > 0 && (
                                    <>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="outline" size="sm">
                                                    <Tags className="w-4 h-4 mr-2" />
                                                    Add to Group
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                {groupOptions.map((group) => (
                                                    <DropdownMenuItem
                                                        key={group}
                                                        onClick={() => handleBulkAssignGroup(group)}
                                                    >
                                                        {group}
                                                    </DropdownMenuItem>
                                                ))}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="outline" size="sm">
                                                    <Minus className="w-4 h-4 mr-2" />
                                                    Remove from Group
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                {groupOptions.map((group) => (
                                                    <DropdownMenuItem
                                                        key={group}
                                                        onClick={() => handleBulkRemoveGroup(group)}
                                                    >
                                                        {group}
                                                    </DropdownMenuItem>
                                                ))}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </>
                                )}
                                <Button
                                    variant="default"
                                    size="sm"
                                    onClick={handleBulkEmail}
                                >
                                    <Send className="w-4 h-4 mr-2" />
                                    Email Selected
                                </Button>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={handleBulkDeleteClick}
                                >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete Selected
                                </Button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Contacts Table */}
                {filteredContacts.length > 0 ? (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-card rounded-xl border border-border shadow-card overflow-hidden"
                    >
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-border bg-muted/30">
                                        <th className="text-left text-body-sm font-medium text-muted-foreground px-6 py-4 w-12">
                                            <Checkbox
                                                checked={isAllSelected}
                                                onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                                                aria-label="Select all contacts"
                                                className={isSomeSelected && !isAllSelected ? "data-[state=checked]:bg-primary/50" : ""}
                                            />
                                        </th>
                                        <th className="text-left text-body-sm font-medium text-muted-foreground px-6 py-4">
                                            Contact
                                        </th>
                                        <th className="text-left text-body-sm font-medium text-muted-foreground px-6 py-4">
                                            Company
                                        </th>
                                        <th className="text-left text-body-sm font-medium text-muted-foreground px-6 py-4">
                                            Role
                                        </th>
                                        <th className="text-left text-body-sm font-medium text-muted-foreground px-6 py-4">
                                            Groups
                                        </th>
                                        <th className="text-left text-body-sm font-medium text-muted-foreground px-6 py-4">
                                            Emails Sent
                                        </th>
                                        <th className="text-right text-body-sm font-medium text-muted-foreground px-6 py-4">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredContacts.map((contact) => (
                                        <motion.tr
                                            key={contact.id}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className={`border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors ${selectedContacts.has(contact.id) ? "bg-accent/50" : ""
                                                }`}
                                        >
                                            <td className="px-6 py-4">
                                                <Checkbox
                                                    checked={selectedContacts.has(contact.id)}
                                                    onCheckedChange={(checked) => handleSelectContact(contact.id, checked as boolean)}
                                                    aria-label={`Select ${contact.name}`}
                                                />
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-10 w-10">
                                                        <AvatarFallback className="bg-accent text-accent-foreground text-sm font-medium">
                                                            {getInitials(contact.name)}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <p className="text-body-base font-medium text-foreground">
                                                            {contact.name}
                                                        </p>
                                                        <p className="text-body-sm text-muted-foreground">
                                                            {contact.email}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-body-base text-foreground">
                                                    {contact.company}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent text-accent-foreground">
                                                    {contact.role}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                {contact.groups.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {contact.groups.map((group) => {
                                                            const color = getGroupColor(group);
                                                            return (
                                                                <span
                                                                    key={group}
                                                                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${color.bg} ${color.text} ${color.border}`}
                                                                >
                                                                    {group}
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                ) : (
                                                    <span className="text-body-sm text-muted-foreground">—</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-body-base text-foreground">
                                                    {contact.totalEmails}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon-sm"
                                                        aria-label="Send email"
                                                        onClick={() => handleSingleEmail(contact)}
                                                    >
                                                        <Mail className="w-4 h-4" />
                                                    </Button>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon-sm" aria-label="More options">
                                                                <MoreVertical className="w-4 h-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem onClick={() => handleEditContact(contact)}>
                                                                <Edit2 className="w-4 h-4 mr-2" />
                                                                Edit
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                className="text-destructive"
                                                                onClick={() => handleDeleteClick(contact)}
                                                            >
                                                                <Trash2 className="w-4 h-4 mr-2" />
                                                                Delete
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            </td>
                                        </motion.tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                ) : (
                    <EmptyState
                        icon={<Users className="w-8 h-8 text-muted-foreground" />}
                        title="No contacts found"
                        description="Add your first contact to start sending emails."
                        action={
                            <Button onClick={handleAddContact}>
                                <Plus className="w-4 h-4" />
                                Add Contact
                            </Button>
                        }
                    />
                )}
            </div>

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
        </>
    );
}
