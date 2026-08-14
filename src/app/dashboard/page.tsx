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
    owner_escalated_at: string | null;
    receipt_issue_reason: string | null;
    receipt_issue_resolved_at: string | null;
};

function WorkflowWidget({
    href,
    title,
    count,
    description,
}: {
    href: string;
    title: string;
    count: number;
    description: string;
}) {
    return (
        <Link
            href={href}
            className="surface-card interactive-card p-7 lg:p-8"
        >
            <h2 className="text-xl font-semibold">{title}</h2>
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
                    "status, requested_by, accountant_approved_by, owner_escalated_at, receipt_issue_reason, receipt_issue_resolved_at"
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
                            request.status !== "rejected" &&
                            !request.owner_escalated_at
                    ).length,
                    accountantRejected: accountantRequests.filter(
                        (request) =>
                            request.status !== "pending_accountant" &&
                            (request.status === "rejected" ||
                                Boolean(request.owner_escalated_at))
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
            setLoading(false);
        }

        loadUser();
    }, [router]);

    if (loading) {
        return (
            <main className="app-page">
                <div className="mx-auto max-w-7xl">
                    <AppHeader />

                    <p className="text-muted">
                        Loading...
                    </p>
                </div>
            </main>
        );
    }

    return (
        <main className="app-page">
            <div className="mx-auto max-w-7xl">
                <AppHeader />

                <div>
                    <h1 className="page-title">
                        Welcome, {profile?.name}
                    </h1>

                    <p className="page-description mt-2 capitalize">
                        {profile?.role.replaceAll("_", " ")} workspace
                    </p>
                </div>

                <div className="mt-10 grid gap-6 sm:grid-cols-2">
                    {profile?.role === "procurement" && (
                        <>
                            <WorkflowWidget
                                href="/procurement?tab=active"
                                title="Active"
                                count={workflowCounts.procurementActive ?? 0}
                                description="Requests moving through the workflow"
                            />
                            <WorkflowWidget
                                href="/procurement?tab=rejected"
                                title="Rejected"
                                count={workflowCounts.procurementRejected ?? 0}
                                description="Requests to modify or escalate"
                            />
                            <WorkflowWidget
                                href="/procurement?tab=completed"
                                title="Completed"
                                count={workflowCounts.procurementCompleted ?? 0}
                                description="Requests received into inventory"
                            />
                            <WorkflowWidget
                                href="/procurement?tab=all"
                                title="All Requests"
                                count={workflowCounts.procurementAll ?? 0}
                                description="Every request you have submitted"
                            />
                            <Link
                                href="/procurement/new"
                                className="surface-card interactive-card p-7 lg:p-8"
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
                            />
                            <WorkflowWidget
                                href="/accountant/requests?tab=approved"
                                title="Approved"
                                count={workflowCounts.accountantApproved ?? 0}
                                description="Requests you approved"
                            />
                            <WorkflowWidget
                                href="/accountant/requests?tab=rejected"
                                title="Rejected"
                                count={workflowCounts.accountantRejected ?? 0}
                                description="Requests you rejected"
                            />
                            <WorkflowWidget
                                href="/accountant/requests?tab=all"
                                title="All Requests"
                                count={workflowCounts.accountantAll ?? 0}
                                description="Pending and reviewed requests"
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
                            />
                            <WorkflowWidget
                                href="/storekeeper/receipts?tab=issues"
                                title="Receipt Issues"
                                count={workflowCounts.receiptIssues ?? 0}
                                description="Reported mismatches awaiting resolution"
                            />
                            <WorkflowWidget
                                href="/storekeeper/receipts?tab=received"
                                title="Recently Received"
                                count={workflowCounts.recentlyReceived ?? 0}
                                description="Requests added to inventory"
                            />

                            <WorkflowWidget
                                href="/inventory"
                                title="Inventory"
                                count={inventoryItemCount}
                                description="Items currently tracked in stock"
                            />
                        </>
                    )}

                    {profile?.role === "owner" && (
                        <>
                            <Link
                                href="/owner/needs-attention"
                                className="surface-card interactive-card p-7 lg:p-8"
                            >
                                <h2 className="text-xl font-semibold">
                                    Needs Attention
                                </h2>
                                <p className="mt-3 text-3xl font-semibold">
                                    {workflowCounts.needsAttention ?? 0}
                                </p>
                                <p className="text-muted mt-1 text-sm">
                                    Escalations, rejections, and receipt issues
                                </p>
                            </Link>

                            <Link
                                href="/owner/awaiting-accountant"
                                className="surface-card interactive-card p-7 lg:p-8"
                            >
                                <h2 className="text-xl font-semibold">
                                    Awaiting Accountant
                                </h2>
                                <p className="mt-3 text-3xl font-semibold">
                                    {workflowCounts.awaitingAccountant ?? 0}
                                </p>
                                <p className="text-muted mt-1 text-sm">
                                    Requests ready for approval
                                </p>
                            </Link>

                            <Link
                                href="/owner/awaiting-receipt"
                                className="surface-card interactive-card p-7 lg:p-8"
                            >
                                <h2 className="text-xl font-semibold">
                                    Awaiting Receipt
                                </h2>
                                <p className="mt-3 text-3xl font-semibold">
                                    {workflowCounts.awaitingReceipt ?? 0}
                                </p>
                                <p className="text-muted mt-1 text-sm">
                                    Approved requests ready to receive
                                </p>
                            </Link>

                            <Link
                                href="/owner/recently-completed"
                                className="surface-card interactive-card p-7 lg:p-8"
                            >
                                <h2 className="text-xl font-semibold">
                                    Recently Completed
                                </h2>
                                <p className="mt-3 text-3xl font-semibold">
                                    {workflowCounts.recentlyCompleted ?? 0}
                                </p>
                                <p className="text-muted mt-1 text-sm">
                                    Received purchase requests
                                </p>
                            </Link>

                            <Link
                                href="/procurement/new"
                                className="surface-card interactive-card p-7 lg:p-8"
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
                            />
                        </>
                    )}
                </div>
            </div>
        </main>
    );
}
