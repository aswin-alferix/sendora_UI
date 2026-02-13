"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  Mail,
  Send,
  TrendingUp,
  Clock,
  ArrowRight,
  Plus,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { EmailRow } from "@/components/shared/EmailRow";
import { Button } from "@/components/ui/button";

// Mock data for recent emails
const recentEmails = [
  {
    id: "1",
    to: "john.doe@company.com",
    subject: "Weekly Report - Q4 Updates",
    status: "sent" as const,
    date: "2 min ago",
  },
  {
    id: "2",
    to: "marketing@startup.io",
    subject: "Partnership Proposal",
    status: "sent" as const,
    date: "15 min ago",
  },
  {
    id: "3",
    to: "team@agency.co",
    subject: "Project Kickoff Meeting",
    status: "pending" as const,
    date: "1 hour ago",
  },
  {
    id: "4",
    to: "support@vendor.net",
    subject: "Invoice #12345 - Payment Confirmation",
    status: "failed" as const,
    date: "2 hours ago",
  },
  {
    id: "5",
    to: "hr@enterprise.com",
    subject: "New Hire Onboarding Documents",
    status: "sent" as const,
    date: "3 hours ago",
  },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function Dashboard() {
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Dashboard"
        description="Monitor your email activity and performance"
        action={
          <Button asChild>
            <Link href="/compose">
              <Plus className="w-4 h-4" />
              Compose Email
            </Link>
          </Button>
        }
      />

      {/* Stats Grid */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
      >
        <motion.div variants={item}>
          <StatCard
            icon={<Send className="w-6 h-6 text-primary" />}
            label="Emails Sent"
            value="1,234"
            change={{ value: "12%", positive: true }}
          />
        </motion.div>
        <motion.div variants={item}>
          <StatCard
            icon={<CheckCircle className="w-6 h-6 text-success" />}
            label="Delivery Rate"
            value="98.5%"
            change={{ value: "2.3%", positive: true }}
          />
        </motion.div>
        <motion.div variants={item}>
          <StatCard
            icon={<TrendingUp className="w-6 h-6 text-primary" />}
            label="Open Rate"
            value="45.2%"
            change={{ value: "5.1%", positive: true }}
          />
        </motion.div>
        <motion.div variants={item}>
          <StatCard
            icon={<AlertCircle className="w-6 h-6 text-destructive" />}
            label="Bounced"
            value="23"
            change={{ value: "3", positive: false }}
          />
        </motion.div>
      </motion.div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2"
        >
          <div className="bg-card rounded-xl border border-border shadow-card">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-heading-4 font-heading text-foreground">
                Recent Emails
              </h2>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/sent">
                  View all
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </div>
            <div>
              {recentEmails.map((email) => (
                <EmailRow
                  key={email.id}
                  {...email}
                  onView={(id) => console.log("View:", id)}
                  onResend={(id) => console.log("Resend:", id)}
                />
              ))}
            </div>
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="space-y-6"
        >
          {/* Quick Actions Card */}
          <div className="bg-card rounded-xl border border-border shadow-card p-6">
            <h2 className="text-heading-4 font-heading text-foreground mb-4">
              Quick Actions
            </h2>
            <div className="space-y-3">
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/compose">
                  <Mail className="w-4 h-4 text-primary" />
                  New Email
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/templates">
                  <Plus className="w-4 h-4 text-primary" />
                  Create Template
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/contacts">
                  <Plus className="w-4 h-4 text-primary" />
                  Add Contact
                </Link>
              </Button>
            </div>
          </div>

          {/* Schedule Card */}
          <div className="bg-gradient-to-br from-primary to-primary/80 rounded-xl p-6 text-primary-foreground">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary-foreground/20">
                <Clock className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-medium">Scheduled</h3>
            </div>
            <p className="text-4xl font-heading font-bold mb-2">5</p>
            <p className="text-primary-foreground/80 text-sm">
              Emails scheduled for delivery
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-4 bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground border-0"
              asChild
            >
              <Link href="/history">View Schedule</Link>
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
