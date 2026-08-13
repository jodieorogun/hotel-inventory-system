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

type OwnerWorkflowCounts = {
    needsAttention: number;
    awaitingAccountant: number;
    awaitingReceipt: number;
    recentlyCompleted: number;
};

const emptyOwnerCounts: OwnerWorkflowCounts = {
    needsAttention: 0,
    awaitingAccountant: 0,
    awaitingReceipt: 0,
    recentlyCompleted: 0,
};

export default function DashboardPage() {
    const router = useRouter();

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [ownerCounts, setOwnerCounts] =
        useState<OwnerWorkflowCounts>(emptyOwnerCounts);
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

            if (data.role === "owner") {
                const { data: requestData, error: requestsError } =
                    await supabase.from("purchase_requests").select("status");

                if (requestsError) {
                    console.error(
                        "Error loading owner workflow counts:",
                        requestsError
                    );
                } else {
                    const statuses = (requestData ?? []) as { status: string }[];

                    setOwnerCounts({
                        needsAttention: statuses.filter((request) =>
                            ["rejected", "receipt_issue", "cancelled"].includes(
                                request.status
                            )
                        ).length,
                        awaitingAccountant: statuses.filter(
                            (request) => request.status === "pending_accountant"
                        ).length,
                        awaitingReceipt: statuses.filter(
                            (request) => request.status === "approved"
                        ).length,
                        recentlyCompleted: statuses.filter(
                            (request) => request.status === "received"
                        ).length,
                    });
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
                            <a
                                href="/procurement/new"
                                className="surface-card interactive-card p-7 lg:p-8"
                            >
                                <h2 className="text-xl font-semibold">
                                    New Purchase Request
                                </h2>

                                <p className="text-muted mt-2">
                                    Submit items for accountant approval
                                </p>
                            </a>

                            <a
                                href="/procurement"
                                className="surface-card interactive-card p-7 lg:p-8"
                            >
                                <h2 className="text-xl font-semibold">
                                    My Requests
                                </h2>

                                <p className="text-muted mt-2">
                                    View your submitted requests
                                </p>
                            </a>
                        </>
                    )}

                    {profile?.role === "accountant" && (
                        <>
                            <Link
                                href="/accountant/requests"
                                className="surface-card interactive-card p-7 lg:p-8"
                            >
                                <h2 className="text-xl font-semibold">
                                    Purchase Approvals
                                </h2>

                                <p className="text-muted mt-2">
                                    Review procurement requests
                                </p>
                            </Link>

                            <Link
                                href="/accountant/approvals"
                                className="surface-card interactive-card p-7 lg:p-8"
                            >
                                <h2 className="text-xl font-semibold">
                                    Approval History
                                </h2>

                                <p className="text-muted mt-2">
                                    View requests you have reviewed
                                </p>
                            </Link>
                        </>
                    )}

                    {profile?.role === "storekeeper" && (
                        <>
                            <Link
                                href="/storekeeper/receipts"
                                className="surface-card interactive-card p-7 lg:p-8"
                            >
                                <h2 className="text-xl font-semibold">
                                    Incoming Stock
                                </h2>

                                <p className="text-muted mt-2">
                                    Verify approved purchases
                                </p>
                            </Link>

                            <a
                                href="/inventory"
                                className="surface-card interactive-card p-7 lg:p-8"
                            >
                                <h2 className="text-xl font-semibold">
                                    Inventory
                                </h2>

                                <p className="text-muted mt-2">
                                    View current hotel stock
                                </p>
                            </a>
                        </>
                    )}

                    {profile?.role === "owner" && (
                        <>
                            <Link
                                href="/owner"
                                className="surface-card interactive-card p-7 lg:p-8"
                            >
                                <h2 className="text-xl font-semibold">
                                    Owner Overview
                                </h2>
                                <p className="text-muted mt-2">
                                    View the complete stock-in workflow
                                </p>
                            </Link>

                            <Link
                                href="/owner/needs-attention"
                                className="surface-card interactive-card p-7 lg:p-8"
                            >
                                <h2 className="text-xl font-semibold">
                                    Needs Attention
                                </h2>
                                <p className="mt-3 text-3xl font-semibold">
                                    {ownerCounts.needsAttention}
                                </p>
                                <p className="text-muted mt-1 text-sm">
                                    Rejected requests and receipt issues
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
                                    {ownerCounts.awaitingAccountant}
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
                                    {ownerCounts.awaitingReceipt}
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
                                    {ownerCounts.recentlyCompleted}
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

                            <Link
                                href="/inventory"
                                className="surface-card interactive-card p-7 lg:p-8"
                            >
                                <h2 className="text-xl font-semibold">
                                    Inventory
                                </h2>

                                <p className="text-muted mt-2">
                                    View current hotel stock
                                </p>
                            </Link>
                        </>
                    )}
                </div>
            </div>
        </main>
    );
}
