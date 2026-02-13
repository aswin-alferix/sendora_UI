"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Search, FileText, MoreVertical, Copy, Edit2, Trash2 } from "lucide-react";

import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { CreateTemplateDialog } from "@/components/templates/CreateTemplateDialog";
import { useToast } from "@/hooks/use-toast";

interface Template {
    id: string;
    name: string;
    subject: string;
    description: string;
    body?: string;
    updatedAt: string;
}

const mockTemplates: Template[] = [
    {
        id: "1",
        name: "Welcome Email",
        subject: "Welcome to {{company}}!",
        description: "Onboarding email for new users",
        updatedAt: "2 days ago",
    },
    {
        id: "2",
        name: "Password Reset",
        subject: "Reset your password",
        description: "Password reset notification",
        updatedAt: "1 week ago",
    },
    {
        id: "3",
        name: "Invoice",
        subject: "Invoice #{{invoice_number}} from {{company}}",
        description: "Monthly billing invoice template",
        updatedAt: "2 weeks ago",
    },
    {
        id: "4",
        name: "Newsletter",
        subject: "{{month}} Newsletter - What's New",
        description: "Monthly newsletter template",
        updatedAt: "3 weeks ago",
    },
];

const container = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: { staggerChildren: 0.05 },
    },
};

const item = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 },
};

export default function TemplatesPage() {
    const [templates, setTemplates] = useState<Template[]>(mockTemplates);
    const [searchQuery, setSearchQuery] = useState("");
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [templateToDelete, setTemplateToDelete] = useState<Template | null>(null);
    const { toast } = useToast();

    const filteredTemplates = templates.filter(
        (template) =>
            template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            template.subject.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleCreateOrUpdateTemplate = (templateData: {
        id?: string;
        name: string;
        subject: string;
        description: string;
        body: string;
    }) => {
        const isEditing = !!templateData.id;

        if (isEditing) {
            // Update existing template
            setTemplates((prev) =>
                prev.map((t) =>
                    t.id === templateData.id
                        ? { ...t, ...templateData, updatedAt: "Just now" }
                        : t
                )
            );
            toast({
                title: "Changes Saved",
                description: `"${templateData.name}" has been updated successfully.`,
                variant: "success",
            });
        } else {
            // Create new template
            const template: Template = {
                id: crypto.randomUUID(),
                name: templateData.name,
                subject: templateData.subject,
                description: templateData.description || "No description",
                body: templateData.body,
                updatedAt: "Just now",
            };
            setTemplates((prev) => [template, ...prev]);
            toast({
                title: "Template Created",
                description: `"${templateData.name}" has been created successfully.`,
                variant: "success",
            });
        }
        setEditingTemplate(null);
    };

    const handleDeleteClick = (template: Template) => {
        setTemplateToDelete(template);
        setDeleteDialogOpen(true);
    };

    const handleConfirmDelete = () => {
        if (templateToDelete) {
            setTemplates((prev) => prev.filter((t) => t.id !== templateToDelete.id));
            toast({
                title: "Template Deleted",
                description: `"${templateToDelete.name}" has been deleted.`,
                variant: "destructive",
            });
            setTemplateToDelete(null);
        }
        setDeleteDialogOpen(false);
    };

    const handleDuplicateTemplate = (template: Template) => {
        const duplicatedTemplate: Template = {
            id: crypto.randomUUID(),
            name: `${template.name} (Copy)`,
            subject: template.subject,
            description: template.description,
            body: template.body,
            updatedAt: "Just now",
        };
        setTemplates((prev) => [duplicatedTemplate, ...prev]);
        toast({
            title: "Template Duplicated",
            description: `"${duplicatedTemplate.name}" has been created.`,
            variant: "success",
        });
    };

    const handleEditTemplate = (template: Template) => {
        setEditingTemplate(template);
        setIsCreateDialogOpen(true);
    };

    const handleDialogClose = (open: boolean) => {
        setIsCreateDialogOpen(open);
        if (!open) {
            setEditingTemplate(null);
        }
    };

    return (
        <>
            <div className="p-4 md:p-8 max-w-7xl mx-auto">
                <PageHeader
                    title="Email Templates"
                    description="Create and manage reusable email templates"
                    action={
                        <Button onClick={() => setIsCreateDialogOpen(true)}>
                            <Plus className="w-4 h-4" />
                            Create Template
                        </Button>
                    }
                />

                {/* Search */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6"
                >
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search templates..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                </motion.div>

                {/* Templates Grid */}
                {filteredTemplates.length > 0 ? (
                    <motion.div
                        variants={container}
                        initial="hidden"
                        animate="show"
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                    >
                        {filteredTemplates.map((template) => (
                            <motion.div
                                key={template.id}
                                variants={item}
                                whileHover={{ y: -4 }}
                                className="bg-card rounded-xl border border-border shadow-card p-6 transition-shadow hover:shadow-md"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent">
                                        <FileText className="w-5 h-5 text-accent-foreground" />
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon-sm">
                                                <MoreVertical className="w-4 h-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => handleEditTemplate(template)}>
                                                <Edit2 className="w-4 h-4 mr-2" />
                                                Edit
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleDuplicateTemplate(template)}>
                                                <Copy className="w-4 h-4 mr-2" />
                                                Duplicate
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                className="text-destructive"
                                                onClick={() => handleDeleteClick(template)}
                                            >
                                                <Trash2 className="w-4 h-4 mr-2" />
                                                Delete
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                                <h3 className="text-heading-4 font-heading text-foreground mb-1">
                                    {template.name}
                                </h3>
                                <p className="text-body-sm text-muted-foreground mb-3 truncate">
                                    {template.subject}
                                </p>
                                <p className="text-body-xs text-muted-foreground">
                                    Updated {template.updatedAt}
                                </p>
                            </motion.div>
                        ))}
                    </motion.div>
                ) : (
                    <EmptyState
                        icon={<FileText className="w-8 h-8 text-muted-foreground" />}
                        title="No templates found"
                        description="Create your first email template to save time on repetitive emails."
                        action={
                            <Button onClick={() => setIsCreateDialogOpen(true)}>
                                <Plus className="w-4 h-4" />
                                Create Template
                            </Button>
                        }
                    />
                )}
            </div>

            <CreateTemplateDialog
                open={isCreateDialogOpen}
                onOpenChange={handleDialogClose}
                onSubmit={handleCreateOrUpdateTemplate}
                editTemplate={editingTemplate}
            />

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Template</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete "{templateToDelete?.name}"? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
