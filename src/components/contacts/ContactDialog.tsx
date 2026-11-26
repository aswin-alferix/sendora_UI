"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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

const schema = z.object({
    name: z.string().min(1, "Full name is required"),
    email: z.string().email("Enter a valid email address"),
    company: z.string().min(1, "Company is required"),
    role: z.string().min(1, "Role is required"),
    groups: z.array(z.string()),
});

type FormData = z.infer<typeof schema>;

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

    const { register, handleSubmit, control, reset, watch, setValue, formState: { errors } } = useForm<FormData>({
        resolver: zodResolver(schema),
        defaultValues: {
            name: "",
            email: "",
            company: "",
            role: roleOptions[0] ?? "",
            groups: [],
        },
    });

    useEffect(() => {
        if (open && editContact) {
            reset({
                name: editContact.name,
                email: editContact.email,
                company: editContact.company,
                role: editContact.role,
                groups: editContact.groups ?? [],
            });
        } else if (!open) {
            reset({ name: "", email: "", company: "", role: roleOptions[0] ?? "", groups: [] });
        }
    }, [open, editContact, roleOptions, reset]);

    const selectedGroups = watch("groups");

    const handleGroupToggle = (group: string, checked: boolean) => {
        if (checked) {
            setValue("groups", [...selectedGroups, group]);
        } else {
            setValue("groups", selectedGroups.filter((g) => g !== group));
        }
    };

    const onFormSubmit = (data: FormData) => {
        onSubmit({ id: editContact?.id, ...data });
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
                            <User className="h-5 w-5 text-accent-foreground" />
                        </div>
                        <div>
                            <DialogTitle>{isEditMode ? "Edit Contact" : "Add New Contact"}</DialogTitle>
                            <DialogDescription>
                                {isEditMode ? "Update the contact information below." : "Fill in the details to add a new contact."}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4 mt-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="contact-name">Full Name <span className="text-destructive">*</span></Label>
                        <Input id="contact-name" placeholder="Enter full name" {...register("name")} aria-invalid={!!errors.name} />
                        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="contact-email">Email Address <span className="text-destructive">*</span></Label>
                        <Input id="contact-email" type="email" placeholder="Enter email address" {...register("email")} aria-invalid={!!errors.email} />
                        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="contact-company">Company <span className="text-destructive">*</span></Label>
                        <Input id="contact-company" placeholder="Enter company name" {...register("company")} aria-invalid={!!errors.company} />
                        {errors.company && <p className="text-xs text-destructive">{errors.company.message}</p>}
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="contact-role">Role</Label>
                        <Controller
                            name="role"
                            control={control}
                            render={({ field }) => (
                                <Select value={field.value} onValueChange={field.onChange}>
                                    <SelectTrigger id="contact-role">
                                        <SelectValue placeholder="Select a role" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {roleOptions.map((option) => (
                                            <SelectItem key={option} value={option}>{option}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        />
                        {errors.role && <p className="text-xs text-destructive">{errors.role.message}</p>}
                    </div>

                    <div className="space-y-1.5">
                        <Label>Groups</Label>
                        {selectedGroups.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-2">
                                {selectedGroups.map((group) => (
                                    <span key={group} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/20 text-primary">
                                        {group}
                                        <button type="button" onClick={() => handleGroupToggle(group, false)} className="hover:bg-primary/30 rounded-full p-0.5">
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
                                            id={`grp-${group}`}
                                            checked={selectedGroups.includes(group)}
                                            onCheckedChange={(c) => handleGroupToggle(group, c as boolean)}
                                        />
                                        <label htmlFor={`grp-${group}`} className="text-sm cursor-pointer">{group}</label>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">No groups available. Create groups from the Manage Groups button.</p>
                        )}
                    </div>

                    <DialogFooter className="pt-4">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button type="submit">{isEditMode ? "Save Changes" : "Add Contact"}</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
