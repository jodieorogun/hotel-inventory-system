"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/app-header";
import { supabase } from "@/lib/supabase";
import {
    formatStockCheckDate,
    getNextStockCheckDate,
    isStockCheckDue,
} from "@/lib/stock-checks";
import { formatStaffRole } from "@/lib/staff-roles";

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

type StockOutSummary = {
    status: string;
    requested_by: string;
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
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:justify-between sm:gap-4">
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

function StockCheckWidget({
    lastCompletedAt,
}: {
    lastCompletedAt: string | null;
}) {
    const due = isStockCheckDue(lastCompletedAt);
    const nextCheckDate = lastCompletedAt
        ? getNextStockCheckDate(lastCompletedAt)
        : null;

    return (
        <Link
            href="/owner/stock-checks"
            className="dashboard-widget surface-card interactive-card relative overflow-hidden p-7 lg:p-8"
        >
            <span
                aria-hidden="true"
                className={`absolute inset-x-0 top-0 h-1 ${
                    due
                        ? "bg-amber-400 dark:bg-amber-300"
                        : "bg-emerald-500 dark:bg-emerald-400"
                }`}
            />
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:justify-between sm:gap-4">
                <h2 className="text-xl font-semibold">Stock Check</h2>
                <span className="text-muted flex shrink-0 items-center gap-2 text-xs">
                    <span
                        aria-hidden="true"
                        className={`h-2 w-2 rounded-full ${
                            due
                                ? "bg-amber-400 dark:bg-amber-300"
                                : "bg-emerald-500 dark:bg-emerald-400"
                        }`}
                    />
                    {due ? "Due" : "Up to date"}
                </span>
            </div>
            <p className="mt-5 font-semibold">
                {lastCompletedAt
                    ? `Last checked ${formatStockCheckDate(lastCompletedAt)}`
                    : "No stock checks completed"}
            </p>
            <p className="text-muted mt-1 text-sm">
                {nextCheckDate
                    ? `Next weekly check: ${formatStockCheckDate(nextCheckDate)}`
                    : "The first stock check is due now"}
            </p>
        </Link>
    );
}

function DashboardSection({
    title,
    description,
    children,
}: {
    title: string;
    description: string;
    children: ReactNode;
}) {
    return (
        <section className="mt-8 sm:mt-10">
            <div className="mb-4 sm:flex sm:items-end sm:justify-between sm:gap-6">
                <h2 className="text-lg font-semibold tracking-[-0.02em]">
                    {title}
                </h2>
                <p className="text-muted mt-1 text-sm sm:mt-0">
                    {description}
                </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 sm:gap-6">{children}</div>
        </section>
    );
}

export default function DashboardPage() {
    const router = useRouter();

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [workflowCounts, setWorkflowCounts] = useState<Record<string, number>>(
        {}
    );
    const [inventoryItemCount, setInventoryItemCount] = useState(0);
    const [lastStockCheckAt, setLastStockCheckAt] = useState<string | null>(null);
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

            if (data.role !== "housekeeper") {
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

            if (data.role === "owner") {
                const { data: stockCheckData, error: stockCheckError } =
                    await supabase
                        .from("stock_checks")
                        .select("completed_at")
                        .order("completed_at", { ascending: false })
                        .limit(1)
                        .maybeSingle();

                if (stockCheckError) {
                    console.error(
                        "Error loading latest stock check:",
                        stockCheckError
                    );
                } else {
                    setLastStockCheckAt(stockCheckData?.completed_at ?? null);
                }
            }

            if (["housekeeper", "storekeeper", "owner"].includes(data.role)) {
                const { data: stockOutData, error: stockOutError } = await supabase
                    .from("stock_out_requests")
                    .select("status, requested_by");

                if (stockOutError) {
                    console.error("Error loading stock-out counts:", stockOutError);
                } else {
                    const stockOutRequests = (stockOutData ?? []) as StockOutSummary[];
                    const ownStockRequests = stockOutRequests.filter(
                        (request) => request.requested_by === user.id
                    );

                    setWorkflowCounts((counts) => ({
                        ...counts,
                        housekeeperPending: ownStockRequests.filter(
                            (request) => request.status === "pending_storekeeper"
                        ).length,
                        housekeeperIssued: ownStockRequests.filter(
                            (request) => request.status === "issued"
                        ).length,
                        housekeeperEscalated: ownStockRequests.filter(
                            (request) => request.status === "escalated_owner"
                        ).length,
                        housekeeperVoided: ownStockRequests.filter(
                            (request) => request.status === "cancelled"
                        ).length,
                        housekeeperAll: ownStockRequests.length,
                        pendingStockOut: stockOutRequests.filter(
                            (request) => request.status === "pending_storekeeper"
                        ).length,
                        issuedStockOut: stockOutRequests.filter(
                            (request) => request.status === "issued"
                        ).length,
                        escalatedStockOut: stockOutRequests.filter(
                            (request) => request.status === "escalated_owner"
                        ).length,
                    }));
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
        profile?.role === "housekeeper"
            ? (workflowCounts.housekeeperEscalated ?? 0) +
              (workflowCounts.housekeeperVoided ?? 0)
            : profile?.role === "procurement"
            ? (workflowCounts.procurementRejected ?? 0)
            : profile?.role === "accountant"
              ? (workflowCounts.accountantPending ?? 0)
              : profile?.role === "storekeeper"
                ? (workflowCounts.awaitingReceipt ?? 0) +
                  (workflowCounts.receiptIssues ?? 0) +
                  (workflowCounts.pendingStockOut ?? 0)
                : (workflowCounts.needsAttention ?? 0) +
                  (workflowCounts.escalatedStockOut ?? 0);
    const reviewSummary = (() => {
        if (reviewCount === 0) {
            return "nothing new needs your attention.";
        }

        if (profile?.role === "storekeeper") {
            return `${reviewCount} stock ${reviewCount === 1 ? "task needs" : "tasks need"} your review.`;
        }

        if (profile?.role === "housekeeper") {
            return `${reviewCount} stock ${reviewCount === 1 ? "request has" : "requests have"} an update.`;
        }

        if (profile?.role === "procurement") {
            return `${reviewCount} rejected ${reviewCount === 1 ? "request needs" : "requests need"} your review.`;
        }

        return `${reviewCount} ${reviewCount === 1 ? "request needs" : "requests need"} your review.`;
    })();
    const reviewHref =
        profile?.role === "housekeeper"
            ? (workflowCounts.housekeeperEscalated ?? 0) > 0
                ? "/housekeeper/requests?tab=escalated"
                : "/housekeeper/requests?tab=cancelled"
            : profile?.role === "procurement"
            ? "/procurement?tab=rejected"
            : profile?.role === "accountant"
              ? "/accountant/requests?tab=pending"
              : profile?.role === "storekeeper"
                ? (workflowCounts.receiptIssues ?? 0) > 0
                    ? "/storekeeper/receipts?tab=issues"
                    : (workflowCounts.pendingStockOut ?? 0) > 0
                      ? "/storekeeper/stock-out?tab=pending"
                      : "/storekeeper/receipts?tab=awaiting"
                : (workflowCounts.escalatedStockOut ?? 0) > 0
                  ? "/storekeeper/stock-out?tab=escalated"
                  : "/owner/needs-attention";

    return (
        <main className="app-page">
            <div className="mx-auto max-w-7xl">
                <AppHeader>
                    <div>
                        <p className="text-sm font-medium capitalize text-[var(--muted-strong)]">
                            {formatStaffRole(profile?.role ?? "staff")} workspace
                        </p>
                        <h1 className="mt-2 max-w-4xl text-[clamp(2.1rem,11vw,4.75rem)] font-semibold leading-[1] tracking-[-0.05em] sm:leading-[0.95] sm:tracking-[-0.055em]">
                            {greetings[greetingIndex]},{" "}
                            <span className="text-[var(--accent)]">
                                {profile?.name}
                            </span>
                        </h1>
                    </div>
                </AppHeader>

                <Link
                    href={reviewHref}
                    className="dashboard-widget surface-card interactive-card flex items-center gap-3 p-4 sm:gap-7 sm:p-7"
                >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-xl font-semibold text-[var(--accent)] sm:h-16 sm:w-16 sm:rounded-2xl sm:text-3xl">
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

                {profile?.role === "housekeeper" && (
                    <DashboardSection
                        title="Stock requests"
                        description="Request consumables and follow their progress"
                    >
                        <Link
                            href="/housekeeper/requests/new"
                            className="dashboard-widget surface-card interactive-card p-7 lg:p-8"
                        >
                            <h2 className="text-xl font-semibold">New Stock Request</h2>
                            <p className="text-muted mt-2">Request consumables from the Storekeeper</p>
                        </Link>
                            <WorkflowWidget
                                href="/housekeeper/requests?tab=pending"
                                title="Pending"
                                count={workflowCounts.housekeeperPending ?? 0}
                                description="Requests waiting for the Storekeeper"
                                tone="waiting"
                            />
                            <WorkflowWidget
                                href="/housekeeper/requests?tab=issued"
                                title="Issued"
                                count={workflowCounts.housekeeperIssued ?? 0}
                                description="Consumables handed over to you"
                                tone="healthy"
                            />
                            <WorkflowWidget
                                href="/housekeeper/requests?tab=escalated"
                                title="Owner Review"
                                count={workflowCounts.housekeeperEscalated ?? 0}
                                description="Requests escalated by the Storekeeper"
                                tone="attention"
                            />
                            <WorkflowWidget
                                href="/housekeeper/requests?tab=cancelled"
                                title="Voided"
                                count={workflowCounts.housekeeperVoided ?? 0}
                                description="Requests closed by the Owner"
                                tone="neutral"
                            />
                            <WorkflowWidget
                                href="/housekeeper/requests?tab=all"
                                title="All Requests"
                                count={workflowCounts.housekeeperAll ?? 0}
                                description="Your complete stock request history"
                                tone="neutral"
                            />
                    </DashboardSection>
                )}

                {profile?.role === "procurement" && (
                    <DashboardSection
                        title="Purchase requests"
                        description="Create requests and track them from approval to receipt"
                    >
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
                    </DashboardSection>
                )}

                {profile?.role === "accountant" && (
                    <DashboardSection
                        title="Purchase approvals"
                        description="Review requests and find earlier decisions"
                    >
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
                    </DashboardSection>
                )}

                {profile?.role === "storekeeper" && (
                    <>
                        <DashboardSection
                            title="Stock coming in"
                            description="Check purchases and add received goods to inventory"
                        >
                            <WorkflowWidget
                                href="/inventory"
                                title="Inventory"
                                count={inventoryItemCount}
                                description="Items currently tracked in stock"
                                tone="neutral"
                            />
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
                        </DashboardSection>

                        <DashboardSection
                            title="Stock requests"
                            description="Handle consumables requested by staff"
                        >
                            <WorkflowWidget
                                href="/storekeeper/stock-out?tab=pending"
                                title="Pending Stock Requests"
                                count={workflowCounts.pendingStockOut ?? 0}
                                description="Consumables waiting to be handed out"
                                tone="waiting"
                            />
                            <WorkflowWidget
                                href="/storekeeper/stock-out?tab=issued"
                                title="Recently Issued"
                                count={workflowCounts.issuedStockOut ?? 0}
                                description="Consumables already handed over"
                                tone="healthy"
                            />
                        </DashboardSection>
                        </>
                    )}

                {profile?.role === "owner" && (
                    <>
                        <div className="mt-8 grid gap-4 sm:mt-10 sm:grid-cols-2 sm:gap-6">
                            <WorkflowWidget
                                href="/owner/needs-attention"
                                title="Needs Attention"
                                count={workflowCounts.needsAttention ?? 0}
                                description="Escalations, rejections, and receipt issues"
                                tone="attention"
                            />
                            <WorkflowWidget
                                href="/inventory"
                                title="Inventory"
                                count={inventoryItemCount}
                                description="Items currently tracked in stock"
                                tone="neutral"
                            />
                        </div>

                        <DashboardSection
                            title="Stock"
                            description="Goods coming into and going out of the store room"
                        >
                            <StockCheckWidget lastCompletedAt={lastStockCheckAt} />
                            <Link
                                href="/owner/stock-out/new"
                                className="dashboard-widget surface-card interactive-card p-7 lg:p-8"
                            >
                                <h2 className="text-xl font-semibold">
                                    New Stock Request
                                </h2>
                                <p className="text-muted mt-2">
                                    Request consumables from the Storekeeper
                                </p>
                            </Link>
                            <WorkflowWidget
                                href="/storekeeper/stock-out?tab=escalated"
                                title="Stock-Out Escalations"
                                count={workflowCounts.escalatedStockOut ?? 0}
                                description="Consumable requests needing your decision"
                                tone="attention"
                            />
                            <WorkflowWidget
                                href="/storekeeper/stock-out?tab=pending"
                                title="Pending Stock Requests"
                                count={workflowCounts.pendingStockOut ?? 0}
                                description="All consumable requests awaiting issue"
                                tone="waiting"
                            />
                            <WorkflowWidget
                                href="/storekeeper/stock-out?tab=issued"
                                title="Issued Consumables"
                                count={workflowCounts.issuedStockOut ?? 0}
                                description="Completed stock-out requests"
                                tone="healthy"
                            />
                            <WorkflowWidget
                                href="/owner/awaiting-receipt"
                                title="Awaiting Receipt"
                                count={workflowCounts.awaitingReceipt ?? 0}
                                description="Approved requests ready to receive"
                                tone="waiting"
                            />
                        </DashboardSection>

                        <DashboardSection
                            title="Purchase requests"
                            description="Create purchases and follow their approval progress"
                        >
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
                                href="/procurement?tab=all"
                                title="My Purchases"
                                count={workflowCounts.procurementAll ?? 0}
                                description="Purchase requests you created"
                                tone="active"
                            />
                            <WorkflowWidget
                                href="/owner/awaiting-accountant"
                                title="Awaiting Accountant"
                                count={workflowCounts.awaitingAccountant ?? 0}
                                description="Requests ready for approval"
                                tone="waiting"
                            />
                            <WorkflowWidget
                                href="/owner/recently-completed"
                                title="Recently Completed"
                                count={workflowCounts.recentlyCompleted ?? 0}
                                description="Received purchase requests"
                                tone="healthy"
                            />
                        </DashboardSection>

                        <DashboardSection
                            title="Records"
                            description="Review system activity and manage staff access"
                        >
                            <Link
                                href="/owner/audit-trail"
                                className="dashboard-widget surface-card interactive-card p-7 lg:p-8"
                            >
                                <h2 className="text-xl font-semibold">Audit Trail</h2>
                                <p className="text-muted mt-2">
                                    See what changed, who changed it, and when
                                </p>
                            </Link>
                            <Link
                                href="/owner/users"
                                className="dashboard-widget surface-card interactive-card p-7 lg:p-8"
                            >
                                <h2 className="text-xl font-semibold">Users</h2>
                                <p className="text-muted mt-2">
                                    Add staff and manage their access
                                </p>
                            </Link>
                        </DashboardSection>
                    </>
                )}
            </div>
        </main>
    );
}
