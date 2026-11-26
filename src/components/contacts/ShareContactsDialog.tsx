"use client";

import { useEffect, useState } from "react";
import { Share2 } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiErrorMessage } from "@/contexts/AuthContext";

interface Admin {
    id: string;
    name: string;
    email: string;
}

interface ShareContactsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    contactIds: string[];
    onShared?: () => void;
}

/** Sends independent copies of the selected contacts to another admin. */
export function ShareContactsDialog({ open, onOpenChange, contactIds, onShared }: ShareContactsDialogProps) {
    // null = still loading. The parent mounts this dialog only while it is open,
    // so every open starts with fresh state.
    const [admins, setAdmins] = useState<Admin[] | null>(null);
    const loading = admins === null;
    const [recipientId, setRecipientId] = useState("");
    const [sharing, setSharing] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        let cancelled = false;
        fetch("/api/users/admins")
            .then(async (res) => {
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(apiErrorMessage(data, "Couldn't load admins"));
                if (!cancelled) setAdmins(data.items ?? []);
            })
            .catch((err) => {
                if (cancelled) return;
                setAdmins([]);
                toast({ title: "Couldn't load admins", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
            });
        return () => { cancelled = true; };
    }, [toast]);

    const handleShare = async () => {
        if (!recipientId) return;
        setSharing(true);
        try {
            const res = await fetch("/api/contacts/share", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contactIds, recipientUserId: recipientId }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(apiErrorMessage(data, "Share failed"));
            const parts = [`${data.copied} copied`];
            if (data.skipped) parts.push(`${data.skipped} already in their list`);
            if (data.notFound) parts.push(`${data.notFound} not found`);
            toast({
                title: `Shared with ${data.recipient?.name ?? "admin"}`,
                description: parts.join(", ") + ".",
                variant: "success",
            });
            onOpenChange(false);
            onShared?.();
        } catch (err) {
            toast({ title: "Share failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
        } finally {
            setSharing(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Share2 className="w-4 h-4" />
                        Share {contactIds.length} contact{contactIds.length === 1 ? "" : "s"}
                    </DialogTitle>
                    <DialogDescription>
                        The other admin gets their own copy. Later edits on either side don&apos;t affect the other.
                        Contacts they already have (same email) are skipped.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                    <Label>Share with</Label>
                    <Select value={recipientId} onValueChange={setRecipientId} disabled={loading || admins.length === 0}>
                        <SelectTrigger>
                            <SelectValue placeholder={loading ? "Loading admins…" : admins.length === 0 ? "No other admins yet" : "Choose an admin"} />
                        </SelectTrigger>
                        <SelectContent>
                            {(admins ?? []).map((a) => (
                                <SelectItem key={a.id} value={a.id}>
                                    {a.name} <span className="text-muted-foreground">· {a.email}</span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sharing}>Cancel</Button>
                    <Button onClick={handleShare} disabled={!recipientId || sharing}>
                        {sharing ? "Sharing…" : "Share copies"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
