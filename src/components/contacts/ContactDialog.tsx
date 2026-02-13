"use client";

import { useState, useEffect } from "react";
import { User, X } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface ContactData {
    id?: string;
    name: string;
    email: string;
    company: string;
    role: string;
    groups: string[];
}

interface ContactDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (contact: ContactData) => void;
    editContact?: ContactData | null;
    roleOptions: string[];
    groupOptions: string[];
}

export const ContactDialog = ({
    open,
    onOpenChange,
    onSubmit,
    editContact,
    roleOptions,
    groupOptions,
}: ContactDialogProps) => {
    const isEditMode = !!editContact;
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [company, setCompany] = useState("");
    const [role, setRole] = useState(roleOptions[0] || "");
    const [selectedGroups, setSelectedGroups] = useState<string[]>([]);

    // Populate form when editing or reset when dialog closes
    useEffect(() => {
        if (open && editContact) {
            setName(editContact.name);
            setEmail(editContact.email);
            setCompany(editContact.company);
            setRole(editContact.role);
            setSelectedGroups(editContact.groups || []);
        } else if (!open) {
            setName("");
            setEmail("");
            setCompany("");
            setRole(roleOptions[0] || "");
            setSelectedGroups([]);
        }
    }, [open, editContact, roleOptions]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({
            id: editContact?.id,
            name,
            email,
            company,
            role,
            groups: selectedGroups,
        });
        onOpenChange(false);
    };

    const handleGroupToggle = (groupName: string, checked: boolean) => {
        if (checked) {
            setSelectedGroups((prev) => [...prev, groupName]);
        } else {
            setSelectedGroups((prev) => prev.filter((g) => g !== groupName));
        }
    };

    const handleRemoveGroup = (groupName: string) => {
        setSelectedGroups((prev) => prev.filter((g) => g !== groupName));
    };

    const isValid = name.trim() && email.trim() && company.trim();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
                            <User className="h-5 w-5 text-accent-foreground" />
                        </div>
                        <div>
                            <DialogTitle>
                                {isEditMode ? "Edit Contact" : "Add New Contact"}
                            </DialogTitle>
                            <DialogDescription>
                                {isEditMode
                                    ? "Update the contact information below."
                                    : "Fill in the details to add a new contact."}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Full Name</Label>
                        <Input
                            id="name"
                            placeholder="Enter full name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="email">Email Address</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="Enter email address"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="company">Company</Label>
                        <Input
                            id="company"
                            placeholder="Enter company name"
                            value={company}
                            onChange={(e) => setCompany(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="role">Role</Label>
                        <Select value={role} onValueChange={setRole}>
                            <SelectTrigger id="role">
                                <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                            <SelectContent>
                                {roleOptions.map((option) => (
                                    <SelectItem key={option} value={option}>
                                        {option}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Groups (for bulk emails)</Label>
                        {selectedGroups.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-2">
                                {selectedGroups.map((group) => (
                                    <span
                                        key={group}
                                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/20 text-primary"
                                    >
                                        {group}
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveGroup(group)}
                                            className="hover:bg-primary/30 rounded-full p-0.5"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}
                        {groupOptions.length > 0 ? (
                            <div className="border border-border rounded-lg p-3 max-h-[150px] overflow-y-auto space-y-2">
                                {groupOptions.map((group) => (
                                    <div key={group} className="flex items-center gap-2">
                                        <Checkbox
                                            id={`group-${group}`}
                                            checked={selectedGroups.includes(group)}
                                            onCheckedChange={(checked) => handleGroupToggle(group, checked as boolean)}
                                        />
                                        <label
                                            htmlFor={`group-${group}`}
                                            className="text-sm cursor-pointer"
                                        >
                                            {group}
                                        </label>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                No groups available. Create groups from the Manage Groups button.
                            </p>
                        )}
                    </div>

                    <DialogFooter className="pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={!isValid}>
                            {isEditMode ? "Save Changes" : "Add Contact"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
