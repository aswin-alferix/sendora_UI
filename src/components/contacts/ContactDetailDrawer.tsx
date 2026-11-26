"use client";

import { useRouter } from "next/navigation";
import { Mail, Building2, UserCircle, Tags, BarChart2, Edit2, X } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";

interface Contact {
    id: string;
    name: string;
    email: string;
    company: string;
    role: string;
    groups: string[];
    totalEmails: number;
}

interface ContactDetailDrawerProps {
    contact: Contact | null;
    onClose: () => void;
    onEdit: (contact: Contact) => void;
}

function getInitials(name: string) {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function getAvatarColor(name: string) {
    const colors = [
        "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
        "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
        "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
        "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
        "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
        "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
}

export function ContactDetailDrawer({ contact, onClose, onEdit }: ContactDetailDrawerProps) {
    const router = useRouter();

    if (!contact) return null;

    const handleEmailContact = () => {
        router.push(`/compose?to=${encodeURIComponent(contact.email)}`);
        onClose();
    };

    return (
        <Sheet open={!!contact} onOpenChange={(open) => !open && onClose()}>
            <SheetContent className="w-full sm:max-w-md flex flex-col">
                <SheetHeader className="pb-0">
                    <div className="flex items-start justify-between">
                        <SheetTitle className="sr-only">Contact Details</SheetTitle>
                        <button onClick={onClose} className="rounded-full p-1.5 hover:bg-muted transition-colors" aria-label="Close">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </SheetHeader>

                {/* Avatar + name */}
                <div className="flex flex-col items-center gap-3 py-6">
                    <Avatar className={`h-20 w-20 text-2xl font-semibold ${getAvatarColor(contact.name)}`}>
                        <AvatarFallback className={getAvatarColor(contact.name)}>
                            {getInitials(contact.name)}
                        </AvatarFallback>
                    </Avatar>
                    <div className="text-center">
                        <h2 className="text-base font-semibold">{contact.name}</h2>
                        <p className="text-body-sm text-muted-foreground">{contact.email}</p>
                    </div>
                    <div className="flex gap-2 mt-1">
                        <Button size="sm" onClick={handleEmailContact}>
                            <Mail className="h-4 w-4" />
                            Send Email
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { onEdit(contact); onClose(); }}>
                            <Edit2 className="h-4 w-4" />
                            Edit
                        </Button>
                    </div>
                </div>

                <Separator />

                {/* Details */}
                <div className="flex-1 overflow-y-auto space-y-5 py-6">
                    <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground mb-0.5">Company</p>
                            <p className="text-sm font-medium">{contact.company}</p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                            <UserCircle className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground mb-0.5">Role</p>
                            <p className="text-sm font-medium">{contact.role}</p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                            <BarChart2 className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground mb-0.5">Total Emails Sent</p>
                            <p className="text-sm font-medium">{contact.totalEmails}</p>
                        </div>
                    </div>

                    {contact.groups.length > 0 && (
                        <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                                <Tags className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground mb-1.5">Groups</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {contact.groups.map((g) => (
                                        <Badge key={g} variant="secondary" className="text-xs">{g}</Badge>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
