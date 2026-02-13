"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Send, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface ComposeFormProps {
    onSend?: (data: EmailData) => void;
    initialTo?: string;
}

export interface EmailData {
    to: string;
    cc?: string;
    subject: string;
    body: string;
}

export function ComposeForm({ onSend, initialTo = "" }: ComposeFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState<EmailData>({
        to: initialTo,
        cc: "",
        subject: "",
        body: "",
    });
    const [errors, setErrors] = useState<Partial<Record<keyof EmailData, string>>>({});
    const { toast } = useToast();

    const validateEmail = (email: string) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return email.split(",").every((e) => emailRegex.test(e.trim()) || e.trim() === "");
    };

    const validate = () => {
        const newErrors: Partial<Record<keyof EmailData, string>> = {};

        if (!formData.to.trim()) {
            newErrors.to = "Recipient email is required";
        } else if (!validateEmail(formData.to)) {
            newErrors.to = "Please enter a valid email address";
        }

        if (formData.cc && !validateEmail(formData.cc)) {
            newErrors.cc = "Please enter valid CC email addresses";
        }

        if (!formData.subject.trim()) {
            newErrors.subject = "Subject is required";
        }

        if (!formData.body.trim()) {
            newErrors.body = "Email body is required";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validate()) return;

        setIsLoading(true);

        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 1500));

        toast({
            title: "Email sent successfully!",
            description: `Your email to ${formData.to} has been sent.`,
        });

        onSend?.(formData);

        // Reset form
        setFormData({ to: "", cc: "", subject: "", body: "" });
        setIsLoading(false);
    };

    const handleChange = (field: keyof EmailData, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors((prev) => ({ ...prev, [field]: undefined }));
        }
    };

    return (
        <motion.form
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            onSubmit={handleSubmit}
            className="bg-card rounded-xl border border-border shadow-card"
        >
            <div className="p-6 space-y-6">
                {/* To Field */}
                <div className="space-y-2">
                    <Label htmlFor="to" className="text-body-sm font-medium">
                        To <span className="text-destructive">*</span>
                    </Label>
                    <Input
                        id="to"
                        type="text"
                        placeholder="recipient@example.com"
                        value={formData.to}
                        onChange={(e) => handleChange("to", e.target.value)}
                        className={errors.to ? "border-destructive focus-visible:ring-destructive" : ""}
                        aria-invalid={!!errors.to}
                        aria-describedby={errors.to ? "to-error" : undefined}
                    />
                    {errors.to && (
                        <p id="to-error" className="text-body-xs text-destructive" role="alert">
                            {errors.to}
                        </p>
                    )}
                </div>

                {/* CC Field */}
                <div className="space-y-2">
                    <Label htmlFor="cc" className="text-body-sm font-medium">
                        CC
                    </Label>
                    <Input
                        id="cc"
                        type="text"
                        placeholder="cc@example.com (optional)"
                        value={formData.cc}
                        onChange={(e) => handleChange("cc", e.target.value)}
                        className={errors.cc ? "border-destructive focus-visible:ring-destructive" : ""}
                        aria-invalid={!!errors.cc}
                        aria-describedby={errors.cc ? "cc-error" : undefined}
                    />
                    {errors.cc && (
                        <p id="cc-error" className="text-body-xs text-destructive" role="alert">
                            {errors.cc}
                        </p>
                    )}
                </div>

                {/* Subject Field */}
                <div className="space-y-2">
                    <Label htmlFor="subject" className="text-body-sm font-medium">
                        Subject <span className="text-destructive">*</span>
                    </Label>
                    <Input
                        id="subject"
                        type="text"
                        placeholder="Email subject"
                        value={formData.subject}
                        onChange={(e) => handleChange("subject", e.target.value)}
                        className={errors.subject ? "border-destructive focus-visible:ring-destructive" : ""}
                        aria-invalid={!!errors.subject}
                        aria-describedby={errors.subject ? "subject-error" : undefined}
                    />
                    {errors.subject && (
                        <p id="subject-error" className="text-body-xs text-destructive" role="alert">
                            {errors.subject}
                        </p>
                    )}
                </div>

                {/* Body Field */}
                <div className="space-y-2">
                    <Label htmlFor="body" className="text-body-sm font-medium">
                        Message <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                        id="body"
                        placeholder="Write your email message here..."
                        value={formData.body}
                        onChange={(e) => handleChange("body", e.target.value)}
                        rows={10}
                        className={errors.body ? "border-destructive focus-visible:ring-destructive" : ""}
                        aria-invalid={!!errors.body}
                        aria-describedby={errors.body ? "body-error" : undefined}
                    />
                    {errors.body && (
                        <p id="body-error" className="text-body-xs text-destructive" role="alert">
                            {errors.body}
                        </p>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-4 px-6 py-4 border-t border-border bg-muted/30 rounded-b-xl">
                <Button type="button" variant="ghost" size="sm">
                    <Paperclip className="w-4 h-4" />
                    Attach files
                </Button>
                <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => setFormData({ to: "", cc: "", subject: "", body: "" })}
                    >
                        <X className="w-4 h-4" />
                        Clear
                    </Button>
                    <Button type="submit" loading={isLoading}>
                        <Send className="w-4 h-4" />
                        Send Email
                    </Button>
                </div>
            </div>
        </motion.form>
    );
}
