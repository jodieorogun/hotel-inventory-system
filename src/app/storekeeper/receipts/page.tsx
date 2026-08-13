"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/app-header";
import { supabase } from "@/lib/supabase";

type ReceiptRequest = {
    id: number;
    status: string;
    createdAt: string;
    receivedAt: string | null;
    requestedBy: string;
    approvedBy: string;
    receivedBy: string | null;
    receiptIssueReason: string | null;
    receiptIssueReportedAt: string | null;
    receiptIssueReportedBy: string | null;
    itemCount: number;
};

type RequestRow = {
    id: number;
    status: string;
    created_at: string;
    requested_by: string;
    accountant_approved_by: string | null;
    storekeeper_verified_by: string | null;
    storekeeper_verified_at: string | null;
    receipt_issue_reason: string | null;
    receipt_issue_reported_by: string | null;
    receipt_issue_reported_at: string | null;
};

type RequestItemRow = {
    request_id: number;
};

type UserRow = {
    id: string;
    name: string;
};

function formatDate(value: string) {
    return new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
    }).format(new Date(value));
}

export default function StorekeeperReceiptsPage() {
    const router = useRouter();
    const [requests, setRequests] = useState<ReceiptRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState("");

    useEffect(() => {
        let ignore = false;

        async function loadReceipts() {
            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser();

            if (userError || !user) {
                router.replace("/login");
                return;
            }

            const { data: profile, error: profileError } = await supabase
                .from("users")
                .select("role")
                .eq("id", user.id)
                .single();

            if (profileError) {
                console.error("Error checking storekeeper role:", profileError);

                if (!ignore) {
                    setErrorMessage("Could not verify your account permissions.");
                    setLoading(false);
                }

                return;
            }

            if (profile.role !== "storekeeper") {
                router.replace("/dashboard");
                return;
            }

            const { data: requestData, error: requestsError } = await supabase
                .from("purchase_requests")
                .select(
                    "id, status, created_at, requested_by, accountant_approved_by, storekeeper_verified_by, storekeeper_verified_at, receipt_issue_reason, receipt_issue_reported_by, receipt_issue_reported_at"
                )
                .in("status", ["approved", "received", "receipt_issue"])
                .order("created_at", { ascending: false });

            if (requestsError) {
                console.error("Error loading incoming stock:", requestsError);

                if (!ignore) {
                    setErrorMessage("Could not load incoming stock.");
                    setLoading(false);
                }

                return;
            }

            const requestRows = (requestData ?? []) as RequestRow[];

            if (requestRows.length === 0) {
                if (!ignore) {
                    setRequests([]);
                    setLoading(false);
                }

                return;
            }

            const requestIds = requestRows.map((request) => request.id);
            const userIds = [
                ...new Set(
                    requestRows.flatMap((request) =>
                        [
                            request.requested_by,
                            request.accountant_approved_by,
                            request.storekeeper_verified_by,
                            request.receipt_issue_reported_by,
                        ].filter((id): id is string => Boolean(id))
                    )
                ),
            ];
            const [itemsResult, usersResult] = await Promise.all([
                supabase
                    .from("purchase_requests_items")
                    .select("request_id")
                    .in("request_id", requestIds),
                supabase.from("users").select("id, name").in("id", userIds),
            ]);

            if (itemsResult.error || usersResult.error) {
                console.error(
                    "Error loading receipt details:",
                    itemsResult.error ?? usersResult.error
                );

                if (!ignore) {
                    setErrorMessage("Could not load the receipt details.");
                    setLoading(false);
                }

                return;
            }

            const itemRows = (itemsResult.data ?? []) as RequestItemRow[];
            const userRows = (usersResult.data ?? []) as UserRow[];
            const usersById = new Map(
                userRows.map((profileRow) => [profileRow.id, profileRow.name])
            );
            const formattedRequests = requestRows.map((request) => ({
                id: request.id,
                status: request.status,
                createdAt: request.created_at,
                receivedAt: request.storekeeper_verified_at,
                requestedBy:
                    usersById.get(request.requested_by) ?? "Procurement user",
                approvedBy: request.accountant_approved_by
                    ? (usersById.get(request.accountant_approved_by) ??
                      "Accountant")
                    : "Not recorded",
                receivedBy: request.storekeeper_verified_by
                    ? (usersById.get(request.storekeeper_verified_by) ??
                      "Storekeeper")
                    : null,
                receiptIssueReason: request.receipt_issue_reason,
                receiptIssueReportedAt: request.receipt_issue_reported_at,
                receiptIssueReportedBy: request.receipt_issue_reported_by
                    ? (usersById.get(request.receipt_issue_reported_by) ??
                      "Storekeeper")
                    : null,
                itemCount: itemRows.filter(
                    (item) => item.request_id === request.id
                ).length,
            }));

            if (!ignore) {
                setRequests(formattedRequests);
                setLoading(false);
            }
        }

        loadReceipts();

        return () => {
            ignore = true;
        };
    }, [router]);

    if (loading) {
        return (
            <main className="app-page">
                <div className="mx-auto max-w-7xl">
                    <AppHeader />
                    <p className="text-muted">Loading incoming stock...</p>
                </div>
            </main>
        );
    }

    const waitingRequests = requests.filter(
        (request) => request.status === "approved"
    );
    const receivedRequests = requests.filter(
        (request) => request.status === "received"
    );
    const issueRequests = requests.filter(
        (request) => request.status === "receipt_issue"
    );

    return (
        <main className="app-page">
            <div className="mx-auto max-w-7xl">
                <AppHeader />

                <div>
                    <h1 className="page-title">Incoming Stock</h1>
                    <p className="page-description mt-2">
                        Check approved purchases when goods arrive in the store room.
                    </p>
                </div>

                {errorMessage && (
                    <div className="error-message mt-8" role="alert">
                        {errorMessage}
                    </div>
                )}

                {!errorMessage && (
                    <>
                        <section className="mt-8" aria-labelledby="waiting-heading">
                            <h2 id="waiting-heading" className="text-xl font-semibold">
                                Awaiting Receipt
                            </h2>

                            {waitingRequests.length === 0 ? (
                                <div className="surface-card mt-4 p-8 text-center">
                                    <h3 className="text-lg font-semibold">
                                        No receipts awaiting review
                                    </h3>
                                    <p className="text-muted mt-2">
                                        Approved purchases will appear here.
                                    </p>
                                </div>
                            ) : (
                                <div className="mt-4 grid gap-6 lg:grid-cols-2">
                                    {waitingRequests.map((request) => (
                                        <article
                                            key={request.id}
                                            className="surface-card h-full overflow-hidden"
                                        >
                                            <div className="flex flex-col gap-5 p-7 sm:flex-row sm:items-start sm:justify-between">
                                                <div>
                                                    <h3 className="text-xl font-semibold">
                                                        Request #{request.id}
                                                    </h3>
                                                    <p className="text-muted mt-2 text-sm">
                                                        Requested by: {request.requestedBy}
                                                    </p>
                                                    <p className="text-muted mt-1 text-sm">
                                                        Created: {formatDate(request.createdAt)}
                                                    </p>
                                                    <p className="text-muted mt-1 text-sm">
                                                        Approved by: {request.approvedBy}
                                                    </p>
                                                    <p className="text-muted mt-1 text-sm">
                                                        {request.itemCount}{" "}
                                                        {request.itemCount === 1 ? "item" : "items"}
                                                    </p>
                                                </div>

                                                <span className="inline-flex self-start rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm font-medium text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
                                                    Awaiting Receipt
                                                </span>
                                            </div>

                                            <div className="border-t border-[var(--border)] p-5">
                                                <Link
                                                    href={`/storekeeper/receipts/${request.id}`}
                                                    className="primary-action w-full text-center"
                                                >
                                                    Review Receipt
                                                </Link>
                                            </div>
                                        </article>
                                    ))}
                                </div>
                            )}
                        </section>

                        <section className="mt-12" aria-labelledby="issues-heading">
                            <h2 id="issues-heading" className="text-xl font-semibold">
                                Receipt Issues
                            </h2>

                            {issueRequests.length === 0 ? (
                                <div className="surface-card mt-4 p-8 text-center">
                                    <p className="text-muted">
                                        Reported receipt issues will appear here.
                                    </p>
                                </div>
                            ) : (
                                <div className="mt-4 grid gap-6 lg:grid-cols-2">
                                    {issueRequests.map((request) => (
                                        <article
                                            key={request.id}
                                            className="surface-card h-full overflow-hidden"
                                        >
                                            <div className="flex flex-col gap-5 p-7 sm:flex-row sm:items-start sm:justify-between">
                                                <div>
                                                    <h3 className="text-xl font-semibold">
                                                        Request #{request.id}
                                                    </h3>
                                                    <p className="mt-3 whitespace-pre-wrap text-sm">
                                                        {request.receiptIssueReason ??
                                                            "Receipt issue reported"}
                                                    </p>
                                                    {request.receiptIssueReportedAt && (
                                                        <p className="text-muted mt-2 text-sm">
                                                            Reported: {formatDate(request.receiptIssueReportedAt)}
                                                        </p>
                                                    )}
                                                    <p className="text-muted mt-1 text-sm">
                                                        Reported by: {request.receiptIssueReportedBy ?? "Storekeeper"}
                                                    </p>
                                                </div>

                                                <span className="inline-flex self-start rounded-full border border-red-200 bg-red-50 px-3 py-1 text-sm font-medium text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
                                                    Needs Attention
                                                </span>
                                            </div>

                                            <div className="border-t border-[var(--border)] p-5">
                                                <Link
                                                    href={`/storekeeper/receipts/${request.id}`}
                                                    className="secondary-action w-full text-center"
                                                >
                                                    View Request
                                                </Link>
                                            </div>
                                        </article>
                                    ))}
                                </div>
                            )}
                        </section>

                        <section className="mt-12" aria-labelledby="received-heading">
                            <h2 id="received-heading" className="text-xl font-semibold">
                                Recently Received
                            </h2>

                            {receivedRequests.length === 0 ? (
                                <div className="surface-card mt-4 p-8 text-center">
                                    <p className="text-muted">
                                        Confirmed receipts will appear here.
                                    </p>
                                </div>
                            ) : (
                                <div className="mt-4 grid gap-6 lg:grid-cols-2">
                                    {receivedRequests.map((request) => (
                                        <article
                                            key={request.id}
                                            className="surface-card h-full overflow-hidden"
                                        >
                                            <div className="flex flex-col gap-5 p-7 sm:flex-row sm:items-start sm:justify-between">
                                                <div>
                                                    <h3 className="text-xl font-semibold">
                                                        Request #{request.id}
                                                    </h3>
                                                    {request.receivedAt && (
                                                        <p className="text-muted mt-2 text-sm">
                                                            Received: {formatDate(request.receivedAt)}
                                                        </p>
                                                    )}
                                                    <p className="text-muted mt-1 text-sm">
                                                        Received by: {request.receivedBy ?? "Storekeeper"}
                                                    </p>
                                                    <p className="text-muted mt-1 text-sm">
                                                        Approved by: {request.approvedBy}
                                                    </p>
                                                    <p className="text-muted mt-1 text-sm">
                                                        {request.itemCount}{" "}
                                                        {request.itemCount === 1 ? "item" : "items"}
                                                    </p>
                                                </div>

                                                <span className="inline-flex self-start rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
                                                    Received
                                                </span>
                                            </div>

                                            <div className="border-t border-[var(--border)] p-5">
                                                <Link
                                                    href={`/storekeeper/receipts/${request.id}`}
                                                    className="secondary-action w-full text-center"
                                                >
                                                    View Receipt
                                                </Link>
                                            </div>
                                        </article>
                                    ))}
                                </div>
                            )}
                        </section>
                    </>
                )}
            </div>
        </main>
    );
}
