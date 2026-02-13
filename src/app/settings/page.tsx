"use client";

import { motion } from "framer-motion";
import { User, Bell, Shield, Palette } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function SettingsPage() {
    return (
        <div className="p-4 md:p-8 max-w-4xl mx-auto">
            <PageHeader
                title="Settings"
                description="Manage your account and preferences"
            />

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <Tabs defaultValue="profile" className="space-y-6">
                    <TabsList className="grid w-full grid-cols-4 bg-muted/50 p-1 rounded-lg">
                        <TabsTrigger value="profile" className="gap-2">
                            <User className="w-4 h-4" />
                            <span className="hidden sm:inline">Profile</span>
                        </TabsTrigger>
                        <TabsTrigger value="notifications" className="gap-2">
                            <Bell className="w-4 h-4" />
                            <span className="hidden sm:inline">Notifications</span>
                        </TabsTrigger>
                        <TabsTrigger value="security" className="gap-2">
                            <Shield className="w-4 h-4" />
                            <span className="hidden sm:inline">Security</span>
                        </TabsTrigger>
                        <TabsTrigger value="appearance" className="gap-2">
                            <Palette className="w-4 h-4" />
                            <span className="hidden sm:inline">Appearance</span>
                        </TabsTrigger>
                    </TabsList>

                    {/* Profile Tab */}
                    <TabsContent value="profile">
                        <div className="bg-card rounded-xl border border-border shadow-card p-6 space-y-6">
                            <div>
                                <h3 className="text-heading-4 font-heading mb-1">Profile Information</h3>
                                <p className="text-body-sm text-muted-foreground">
                                    Update your personal information and email signature.
                                </p>
                            </div>

                            <div className="grid gap-6 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="firstName">First Name</Label>
                                    <Input id="firstName" defaultValue="Alex" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="lastName">Last Name</Label>
                                    <Input id="lastName" defaultValue="Johnson" />
                                </div>
                                <div className="space-y-2 sm:col-span-2">
                                    <Label htmlFor="email">Email Address</Label>
                                    <Input id="email" type="email" defaultValue="alex@sendora.io" />
                                </div>
                                <div className="space-y-2 sm:col-span-2">
                                    <Label htmlFor="company">Company</Label>
                                    <Input id="company" defaultValue="Sendora Inc." />
                                </div>
                            </div>

                            <div className="flex justify-end">
                                <Button>Save Changes</Button>
                            </div>
                        </div>
                    </TabsContent>

                    {/* Notifications Tab */}
                    <TabsContent value="notifications">
                        <div className="bg-card rounded-xl border border-border shadow-card p-6 space-y-6">
                            <div>
                                <h3 className="text-heading-4 font-heading mb-1">Notification Preferences</h3>
                                <p className="text-body-sm text-muted-foreground">
                                    Choose how you want to be notified about email activity.
                                </p>
                            </div>

                            <div className="space-y-4">
                                {[
                                    { id: "email-sent", label: "Email sent confirmations", description: "Get notified when an email is successfully sent" },
                                    { id: "email-opened", label: "Email opened notifications", description: "Get notified when recipients open your emails" },
                                    { id: "email-failed", label: "Failed delivery alerts", description: "Get notified when email delivery fails" },
                                    { id: "weekly-digest", label: "Weekly digest", description: "Receive a weekly summary of your email activity" },
                                ].map((item) => (
                                    <div key={item.id} className="flex items-center justify-between py-3 border-b border-border last:border-b-0">
                                        <div>
                                            <Label htmlFor={item.id} className="font-medium">{item.label}</Label>
                                            <p className="text-body-sm text-muted-foreground">{item.description}</p>
                                        </div>
                                        <Switch id={item.id} defaultChecked />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </TabsContent>

                    {/* Security Tab */}
                    <TabsContent value="security">
                        <div className="bg-card rounded-xl border border-border shadow-card p-6 space-y-6">
                            <div>
                                <h3 className="text-heading-4 font-heading mb-1">Security Settings</h3>
                                <p className="text-body-sm text-muted-foreground">
                                    Manage your password and security preferences.
                                </p>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="current-password">Current Password</Label>
                                    <Input id="current-password" type="password" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="new-password">New Password</Label>
                                    <Input id="new-password" type="password" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="confirm-password">Confirm New Password</Label>
                                    <Input id="confirm-password" type="password" />
                                </div>
                            </div>

                            <div className="pt-4 border-t border-border">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <Label className="font-medium">Two-Factor Authentication</Label>
                                        <p className="text-body-sm text-muted-foreground">Add an extra layer of security</p>
                                    </div>
                                    <Switch />
                                </div>
                            </div>

                            <div className="flex justify-end">
                                <Button>Update Password</Button>
                            </div>
                        </div>
                    </TabsContent>

                    {/* Appearance Tab */}
                    <TabsContent value="appearance">
                        <div className="bg-card rounded-xl border border-border shadow-card p-6 space-y-6">
                            <div>
                                <h3 className="text-heading-4 font-heading mb-1">Appearance</h3>
                                <p className="text-body-sm text-muted-foreground">
                                    Customize how Sendora looks for you.
                                </p>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between py-3 border-b border-border">
                                    <div>
                                        <Label className="font-medium">Compact Mode</Label>
                                        <p className="text-body-sm text-muted-foreground">Show more content with smaller spacing</p>
                                    </div>
                                    <Switch />
                                </div>
                                <div className="flex items-center justify-between py-3">
                                    <div>
                                        <Label className="font-medium">Reduce Animations</Label>
                                        <p className="text-body-sm text-muted-foreground">Minimize motion for accessibility</p>
                                    </div>
                                    <Switch />
                                </div>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </motion.div>
        </div>
    );
}
