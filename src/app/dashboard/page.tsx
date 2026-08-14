"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/app-header";
import { supabase } from "@/lib/supabase";

type UserProfile = {
    name: string;
    role: string;
};

type RequestSummary = {
    status: string;
    requested_by: string;
    accountant_approved_by: string | null;
    accountant_decision: "approved" | "rejected" | null;
    receipt_issue_reason: string | null;
    receipt_issue_resolved_at: string | null;
};

type WidgetTone = "attention" | "waiting" | "healthy" | "active" | "neutral";

const greetings = [
    "Hi",
    "Welcome back",
    "Good to see you",
    "Hello again",
    "Nice to have you back",
];

const widgetTones: Record<
    WidgetTone,
    { bar: string; dot: string; label: string }
> = {
    attention: {
        bar: "bg-red-500 dark:bg-red-400",
        dot: "bg-red-500 dark:bg-red-400",
        label: "Needs attention",
    },
    waiting: {
        bar: "bg-amber-400 dark:bg-amber-300",
        dot: "bg-amber-400 dark:bg-amber-300",
        label: "Waiting",
    },
    healthy: {
        bar: "bg-emerald-500 dark:bg-emerald-400",
        dot: "bg-emerald-500 dark:bg-emerald-400",
        label: "Completed",
    },
    active: {
        bar: "bg-sky-500 dark:bg-sky-400",
        dot: "bg-sky-500 dark:bg-sky-400",
        label: "In progress",
    },
    neutral: {
        bar: "bg-slate-400 dark:bg-slate-500",
        dot: "bg-slate-400 dark:bg-slate-500",
        label: "Overview",
    },
};

function WorkflowWidget({
    href,
    title,
    count,
    description,
    tone,
}: {
    href: string;
    title: string;
    count: number;
    description: string;
    tone: WidgetTone;
}) {
    const toneDetails = widgetTones[tone];

    return (
        <Link
            href={href}
            className="dashboard-widget surface-card interactive-card relative overflow-hidden p-7 lg:p-8"
        >
            <span
                aria-hidden="true"
                className={`absolute inset-x-0 top-0 h-1 ${toneDetails.bar}`}
            />
            <div className="flex items-start justify-between gap-4">
                <h2 className="text-xl font-semibold">{title}</h2>
                <span className="text-muted flex shrink-0 items-center gap-2 text-xs">
                    <span
                        aria-hidden="true"
                        className={`h-2 w-2 rounded-full ${toneDetails.dot}`}
                    />
                    {toneDetails.label}
                </span>
            </div>
            <p className="mt-3 text-3xl font-semibold">{count}</p>
            <p className="text-muted mt-1 text-sm">{description}</p>
        </Link>
    );
}

export default function DashboardPage() {
    const router = useRouter();

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [workflowCounts, setWorkflowCounts] = useState<Record<string, number>>(
        {}
    );
    const [inventoryItemCount, setInventoryItemCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [greetingIndex, setGreetingIndex] = useState(0);

    useEffect(() => {
        async function loadUser() {
            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser();

            if (userError || !user) {
                router.push("/login");
                return;
            }

            const { data, error } = await supabase
                .from("users")
                .select("name, role")
                .eq("id", user.id)
                .single();

            if (error) {
                console.error("Error loading profile:", error);
                setLoading(false);
                return;
            }

            const { data: requestData, error: requestsError } = await supabase
                .from("purchase_requests")
                .select(
                    "status, requested_by, accountant_approved_by, accountant_decision, receipt_issue_reason, receipt_issue_resolved_at"
                );

            if (requestsError) {
                console.error("Error loading workflow counts:", requestsError);
            } else {
                const requests = (requestData ?? []) as RequestSummary[];
                const ownRequests = requests.filter(
                    (request) => request.requested_by === user.id
                );
                const accountantRequests = requests.filter(
                    (request) =>
                        request.status === "pending_accountant" ||
                        request.accountant_approved_by === user.id
                );

                setWorkflowCounts({
                    procurementActive: ownRequests.filter((request) =>
                        [
                            "pending_accountant",
                            "approved",
                            "receipt_issue",
                            "escalated_owner",
                        ].includes(request.status)
                    ).length,
                    procurementRejected: ownRequests.filter(
                        (request) => request.status === "rejected"
                    ).length,
                    procurementCompleted: ownRequests.filter(
                        (request) => request.status === "received"
                    ).length,
                    procurementAll: ownRequests.length,
                    accountantPending: accountantRequests.filter(
                        (request) => request.status === "pending_accountant"
                    ).length,
                    accountantApproved: accountantRequests.filter(
                        (request) =>
                            request.status !== "pending_accountant" &&
                            request.accountant_decision === "approved"
                    ).length,
                    accountantRejected: accountantRequests.filter(
                        (request) =>
                            request.status !== "pending_accountant" &&
                            request.accountant_decision === "rejected"
                    ).length,
                    accountantAll: accountantRequests.length,
                    awaitingReceipt: requests.filter(
                        (request) => request.status === "approved"
                    ).length,
                    receiptIssues: requests.filter(
                        (request) =>
                            request.status === "receipt_issue" ||
                            (Boolean(request.receipt_issue_reason) &&
                                !request.receipt_issue_resolved_at &&
                                request.status !== "received")
                    ).length,
                    recentlyReceived: requests.filter(
                        (request) => request.status === "received"
                    ).length,
                    needsAttention: requests.filter((request) =>
                        [
                            "rejected",
                            "receipt_issue",
                            "escalated_owner",
                        ].includes(request.status) ||
                        (Boolean(request.receipt_issue_reason) &&
                            !request.receipt_issue_resolved_at &&
                            request.status !== "received")
                    ).length,
                    awaitingAccountant: requests.filter(
                        (request) => request.status === "pending_accountant"
                    ).length,
                    recentlyCompleted: requests.filter(
                        (request) => request.status === "received"
                    ).length,
                });
            }

            if (["storekeeper", "owner"].includes(data.role)) {
                const { count, error: inventoryError } = await supabase
                    .from("items")
                    .select("id", { count: "exact", head: true });

                if (inventoryError) {
                    console.error(
                        "Error loading inventory item count:",
                        inventoryError
                    );
                } else {
                    setInventoryItemCount(count ?? 0);
                }
            }

            setProfile(data);
            setGreetingIndex(Math.floor(Math.random() * greetings.length));
            setLoading(false);
        }

        loadUser();
    }, [router]);

    if (loading) {
        return (
            <main className="app-page">
                <div className="mx-auto max-w-7xl">
                    <AppHeader>
                        <div>
                            <h1 className="page-title">Dashboard</h1>
                        </div>
                    </AppHeader>

                    <p className="text-muted">
                        Loading...
                    </p>
                </div>
            </main>
        );
    }

    const reviewCount =
        profile?.role === "procurement"
            ? (workflowCounts.procurementRejected ?? 0)
            : profile?.role === "accountant"
              ? (workflowCounts.accountantPending ?? 0)
              : profile?.role === "storekeeper"
                ? (workflowCounts.awaitingReceipt ?? 0) +
                  (workflowCounts.receiptIssues ?? 0)
                : (workflowCounts.needsAttention ?? 0);
    const reviewSummary = (() => {
        if (reviewCount === 0) {
            return "nothing new needs your attention.";
        }

        if (profile?.role === "storekeeper") {
            return `${reviewCount} receipt ${reviewCount === 1 ? "task needs" : "tasks need"} your review.`;
        }

        if (profile?.role === "procurement") {
            return `${reviewCount} rejected ${reviewCount === 1 ? "request needs" : "requests need"} your review.`;
        }

        return `${reviewCount} ${reviewCount === 1 ? "request needs" : "requests need"} your review.`;
    })();
    const reviewHref =
        profile?.role === "procurement"
            ? "/procurement?tab=rejected"
            : profile?.role === "accountant"
              ? "/accountant/requests?tab=pending"
              : profile?.role === "storekeeper"
                ? (workflowCounts.receiptIssues ?? 0) > 0
                    ? "/storekeeper/receipts?tab=issues"
                    : "/storekeeper/receipts?tab=awaiting"
                : "/owner/needs-attention";

    return (
        <main className="app-page">
            <div className="mx-auto max-w-7xl">
                <AppHeader>
                    <div>
                        <p className="text-sm font-medium capitalize text-[var(--muted-strong)]">
                            {profile?.role.replaceAll("_", " ")} workspace
                        </p>
                        <h1 className="mt-2 max-w-4xl text-[clamp(2.5rem,6vw,4.75rem)] font-semibold leading-[0.95] tracking-[-0.055em]">
                            {greetings[greetingIndex]},{" "}
                            <span className="text-[var(--accent)]">
                                {profile?.name}
                            </span>
                        </h1>
                    </div>
                </AppHeader>

                <Link
                    href={reviewHref}
                    className="dashboard-widget surface-card interactive-card flex items-center gap-5 p-6 sm:gap-7 sm:p-7"
                >
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-2xl font-semibold text-[var(--accent)] sm:h-16 sm:w-16 sm:text-3xl">
                        {reviewCount}
                    </span>

                    <div className="min-w-0 flex-1">
                        <p className="text-muted text-xs font-semibold uppercase tracking-[0.12em]">
                            Since you&apos;ve been gone
                        </p>
                        <h2 className="mt-2 text-lg font-semibold sm:text-xl">
                            {reviewSummary.charAt(0).toUpperCase() +
                                reviewSummary.slice(1)}
                        </h2>
                    </div>

                    <span aria-hidden="true" className="text-muted text-xl">
                        →
                    </span>
                </Link>

                <div className="mt-6 grid gap-6 sm:grid-cols-2">
                    {profile?.role === "procurement" && (
                        <>
                            <WorkflowWidget
                                href="/procurement?tab=active"
                                title="Active"
                                count={workflowCounts.procurementActive ?? 0}
                                description="Requests moving through the workflow"
                                tone="active"
                            />
                            <WorkflowWidget
                                href="/procurement?tab=rejected"
                                title="Rejected"
                                count={workflowCounts.procurementRejected ?? 0}
                                description="Requests to modify or escalate"
                                tone="attention"
                            />
                            <WorkflowWidget
                                href="/procurement?tab=completed"
                                title="Completed"
                                count={workflowCounts.procurementCompleted ?? 0}
                                description="Requests received into inventory"
                                tone="healthy"
                            />
                            <WorkflowWidget
                                href="/procurement?tab=all"
                                title="All Requests"
                                count={workflowCounts.procurementAll ?? 0}
                                description="Every request you have submitted"
                                tone="neutral"
                            />
                            <Link
                                href="/procurement/new"
                                className="dashboard-widget surface-card interactive-card p-7 lg:p-8"
                            >
                                <h2 className="text-xl font-semibold">
                                    New Purchase Request
                                </h2>
                                <p className="text-muted mt-2">
                                    Submit items for accountant approval
                                </p>
                            </Link>
                        </>
                    )}

                    {profile?.role === "accountant" && (
                        <>
                            <WorkflowWidget
                                href="/accountant/requests?tab=pending"
                                title="Pending"
                                count={workflowCounts.accountantPending ?? 0}
                                description="Requests waiting for your decision"
                                tone="waiting"
                            />
                            <WorkflowWidget
                                href="/accountant/requests?tab=approved"
                                title="Approved"
                                count={workflowCounts.accountantApproved ?? 0}
                                description="Requests you approved"
                                tone="healthy"
                            />
                            <WorkflowWidget
                                href="/accountant/requests?tab=rejected"
                                title="Rejected"
                                count={workflowCounts.accountantRejected ?? 0}
                                description="Requests you rejected"
                                tone="attention"
                            />
                            <WorkflowWidget
                                href="/accountant/requests?tab=all"
                                title="All Requests"
                                count={workflowCounts.accountantAll ?? 0}
                                description="Pending and reviewed requests"
                                tone="neutral"
                            />
                        </>
                    )}

                    {profile?.role === "storekeeper" && (
                        <>
                            <WorkflowWidget
                                href="/storekeeper/receipts?tab=awaiting"
                                title="Awaiting Receipt"
                                count={workflowCounts.awaitingReceipt ?? 0}
                                description="Approved requests ready to check"
                                tone="waiting"
                            />
                            <WorkflowWidget
                                href="/storekeeper/receipts?tab=issues"
                                title="Receipt Issues"
                                count={workflowCounts.receiptIssues ?? 0}
                                description="Reported mismatches awaiting resolution"
                                tone="attention"
                            />
                            <WorkflowWidget
                                href="/storekeeper/receipts?tab=received"
                                title="Recently Received"
                                count={workflowCounts.recentlyReceived ?? 0}
                                description="Requests added to inventory"
                                tone="healthy"
                            />
                            <WorkflowWidget
                                href="/inventory"
                                title="Inventory"
                                count={inventoryItemCount}
                                description="Items currently tracked in stock"
                                tone="neutral"
                            />
                        </>
                    )}

                    {profile?.role === "owner" && (
                        <>
                            <WorkflowWidget
                                href="/owner/needs-attention"
                                title="Needs Attention"
                                count={workflowCounts.needsAttention ?? 0}
                                description="Escalations, rejections, and receipt issues"
                                tone="attention"
                            />
                            <WorkflowWidget
                                href="/owner/awaiting-accountant"
                                title="Awaiting Accountant"
                                count={workflowCounts.awaitingAccountant ?? 0}
                                description="Requests ready for approval"
                                tone="waiting"
                            />
                            <WorkflowWidget
                                href="/owner/awaiting-receipt"
                                title="Awaiting Receipt"
                                count={workflowCounts.awaitingReceipt ?? 0}
                                description="Approved requests ready to receive"
                                tone="waiting"
                            />
                            <WorkflowWidget
                                href="/owner/recently-completed"
                                title="Recently Completed"
                                count={workflowCounts.recentlyCompleted ?? 0}
                                description="Received purchase requests"
                                tone="healthy"
                            />
                            <Link
                                href="/procurement/new"
                                className="dashboard-widget surface-card interactive-card p-7 lg:p-8"
                            >
                                <h2 className="text-xl font-semibold">
                                    New Purchase Request
                                </h2>
                                <p className="text-muted mt-2">
                                    Create a request for accountant approval
                                </p>
                            </Link>
                            <WorkflowWidget
                                href="/inventory"
                                title="Inventory"
                                count={inventoryItemCount}
                                description="Items currently tracked in stock"
                                tone="neutral"
                            />
                        </>
                    )}
                </div>
            </div>
        </main>
    );
}
