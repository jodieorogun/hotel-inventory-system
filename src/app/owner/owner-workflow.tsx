"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/app-header";
import ListSearch from "@/components/list-search";
import { supabase } from "@/lib/supabase";
import { loadVisibleUserNames } from "@/lib/user-names";

type OwnerRequest = {
    id: number;
    status: string;
    createdAt: string;
    receivedAt: string | null;
    requestedBy: string;
    receiptIssueReason: string | null;
    ownerEscalationReason: string | null;
    itemCount: number;
};

type RequestRow = {
    id: number;
    status: string;
    created_at: string;
    requested_by: string;
    storekeeper_verified_at: string | null;
    receipt_issue_reason: string | null;
    owner_escalation_reason: string | null;
};

type RequestItemRow = {
    request_id: number;
};

type UserRow = {
    id: string;
    name: string;
};

type OwnerStockRequest = {
    id: number;
    createdAt: string;
    requestedBy: string;
    itemCount: number;
};

type StockRequestRow = {
    id: number;
    created_at: string;
    requested_by: string;
};

type StockRequestItemRow = {
    request_id: number;
};

const statusDetails: Record<
    string,
    { label: string; className: string }
> = {
    pending_accountant: {
        label: "Waiting for Approval",
        className:
            "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
    },
    approved: {
        label: "Ready to Receive",
        className:
            "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300",
    },
    rejected: {
        label: "Rejected",
        className:
            "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
    },
    escalated_owner: {
        label: "Escalated to Owner",
        className:
            "border-purple-200 bg-purple-50 text-purple-800 dark:border-purple-900 dark:bg-purple-950 dark:text-purple-300",
    },
    receipt_issue: {
        label: "Receipt Issue",
        className:
            "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
    },
    cancelled: {
        label: "Cancelled",
        className:
            "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300",
    },
    received: {
        label: "Received",
        className:
            "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
    },
};

function formatDate(value: string) {
    return new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
    }).format(new Date(value));
}

function RequestCard({ request }: { request: OwnerRequest }) {
    const status = statusDetails[request.status] ?? {
        label: request.status.replaceAll("_", " "),
        className:
            "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300",
    };

    return (
        <article className="surface-card h-full overflow-hidden">
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
                    {request.status === "received" && request.receivedAt && (
                        <p className="text-muted mt-1 text-sm">
                            Received: {formatDate(request.receivedAt)}
                        </p>
                    )}
                    <p className="text-muted mt-1 text-sm">
                        {request.itemCount}{" "}
                        {request.itemCount === 1 ? "item" : "items"}
                    </p>
                    {request.status === "receipt_issue" &&
                        request.receiptIssueReason && (
                            <div className="mt-4 rounded-xl border border-[var(--danger-border)] bg-[var(--danger-soft)] p-4">
                                <p className="text-sm font-semibold text-[var(--danger)]">
                                    Receipt issue
                                </p>
                                <p className="mt-2 whitespace-pre-wrap text-sm">
                                    {request.receiptIssueReason}
                                </p>
                            </div>
                        )}
                    {request.status === "escalated_owner" &&
                        request.ownerEscalationReason && (
                            <div className="mt-4 rounded-xl border border-purple-200 bg-purple-50 p-4 dark:border-purple-900 dark:bg-purple-950">
                                <p className="text-sm font-semibold text-purple-800 dark:text-purple-300">
                                    Reason for escalation
                                </p>
                                <p className="mt-2 whitespace-pre-wrap text-sm">
                                    {request.ownerEscalationReason}
                                </p>
                            </div>
                        )}
                </div>

                <span
                    className={`inline-flex self-start rounded-full border px-3 py-1 text-sm font-medium capitalize ${status.className}`}
                >
                    {status.label}
                </span>
            </div>

            <div className="border-t border-[var(--border)] p-5">
                <Link
                    href={`/owner/requests/${request.id}`}
                    className="secondary-action w-full text-center"
                >
                    Open Request
                </Link>
            </div>
        </article>
    );
}

function RequestSection({
    id,
    title,
    description,
    emptyMessage,
    requests,
}: {
    id: string;
    title: string;
    description: string;
    emptyMessage: string;
    requests: OwnerRequest[];
}) {
    return (
        <section className="mt-12" aria-labelledby={id}>
            <h2 id={id} className="text-xl font-semibold">
                {title}
            </h2>
            <p className="text-muted mt-1 text-sm">{description}</p>

            {requests.length === 0 ? (
                <div className="surface-card mt-4 p-7 text-center">
                    <p className="text-muted">{emptyMessage}</p>
                </div>
            ) : (
                <div className="mt-4 grid gap-6 lg:grid-cols-2">
                    {requests.map((request) => (
                        <RequestCard key={request.id} request={request} />
                    ))}
                </div>
            )}
        </section>
    );
}

function StockEscalationsSection({ searchQuery }: { searchQuery: string }) {
    const [requests, setRequests] = useState<OwnerStockRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState("");

    useEffect(() => {
        let ignore = false;

        async function loadEscalations() {
            const { data, error } = await supabase
                .from("stock_out_requests")
                .select("id, created_at, requested_by")
                .eq("status", "escalated_owner")
                .order("created_at", { ascending: false });

            if (error) {
                console.error("Error loading stock request escalations:", error);
                if (!ignore) {
                    setErrorMessage("Could not load escalated stock requests.");
                    setLoading(false);
                }
                return;
            }

            const rows = (data ?? []) as StockRequestRow[];
            if (rows.length === 0) {
                if (!ignore) {
                    setRequests([]);
                    setLoading(false);
                }
                return;
            }

            const requestIds = rows.map((request) => request.id);
            const requesterIds = [
                ...new Set(rows.map((request) => request.requested_by)),
            ];
            const [itemsResult, usersById] = await Promise.all([
                supabase
                    .from("stock_out_request_items")
                    .select("request_id")
                    .in("request_id", requestIds),
                loadVisibleUserNames(requesterIds),
            ]);

            if (itemsResult.error) {
                console.error(
                    "Error loading escalated stock request items:",
                    itemsResult.error
                );
                if (!ignore) {
                    setErrorMessage("Could not load escalated stock request details.");
                    setLoading(false);
                }
                return;
            }

            const items = (itemsResult.data ?? []) as StockRequestItemRow[];
            const formattedRequests = rows.map((request) => ({
                id: request.id,
                createdAt: request.created_at,
                requestedBy:
                    usersById.get(request.requested_by) ?? "Housekeeper",
                itemCount: items.filter(
                    (item) => item.request_id === request.id
                ).length,
            }));

            if (!ignore) {
                setRequests(formattedRequests);
                setLoading(false);
            }
        }

        loadEscalations();

        return () => {
            ignore = true;
        };
    }, []);

    const normalizedSearch = searchQuery.trim().toLowerCase();
    const filteredRequests = requests.filter(
        (request) =>
            !normalizedSearch ||
            String(request.id).includes(normalizedSearch.replace(/^#/, "")) ||
            request.requestedBy.toLowerCase().includes(normalizedSearch)
    );

    return (
        <section className="mt-12" aria-labelledby="stock-request-escalations">
            <h2 id="stock-request-escalations" className="text-xl font-semibold">
                Stock Requests
            </h2>
            <p className="text-muted mt-1 text-sm">
                Consumable requests escalated by the Storekeeper.
            </p>

            {loading ? (
                <div className="surface-card mt-4 p-7 text-center">
                    <p className="text-muted">Loading stock requests...</p>
                </div>
            ) : errorMessage ? (
                <div className="error-message mt-4" role="alert">
                    {errorMessage}
                </div>
            ) : filteredRequests.length === 0 ? (
                <div className="surface-card mt-4 p-7 text-center">
                    <p className="text-muted">
                        No stock requests currently need attention.
                    </p>
                </div>
            ) : (
                <div className="mt-4 grid gap-6 lg:grid-cols-2">
                    {filteredRequests.map((request) => (
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
                                        {request.itemCount}{" "}
                                        {request.itemCount === 1 ? "item" : "items"}
                                    </p>
                                </div>

                                <span className="inline-flex self-start rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-sm font-medium text-purple-800 dark:border-purple-900 dark:bg-purple-950 dark:text-purple-300">
                                    Owner Review
                                </span>
                            </div>

                            <div className="border-t border-[var(--border)] p-5">
                                <Link
                                    href={`/storekeeper/stock-out/${request.id}`}
                                    className="secondary-action w-full text-center"
                                >
                                    Open Request
                                </Link>
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </section>
    );
}

export type OwnerWorkflowView =
    | "needs-attention"
    | "awaiting-accountant"
    | "awaiting-receipt"
    | "recently-completed"
    | "all-purchase-requests";

export default function OwnerWorkflow({
    view,
}: {
    view: OwnerWorkflowView;
}) {
    const router = useRouter();
    const [requests, setRequests] = useState<OwnerRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState("");
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        let ignore = false;

        async function loadOwnerWorkflow() {
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
                console.error("Error checking owner role:", profileError);

                if (!ignore) {
                    setErrorMessage("Could not verify your account permissions.");
                    setLoading(false);
                }

                return;
            }

            if (profile.role !== "owner") {
                router.replace("/dashboard");
                return;
            }

            const { data: requestData, error: requestsError } = await supabase
                .from("purchase_requests")
                .select(
                    "id, status, created_at, requested_by, storekeeper_verified_at, receipt_issue_reason, owner_escalation_reason"
                )
                .order("created_at", { ascending: false });

            if (requestsError) {
                console.error("Error loading owner workflow:", requestsError);

                if (!ignore) {
                    setErrorMessage("Could not load the purchase request workflow.");
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
            const requesterIds = [
                ...new Set(requestRows.map((request) => request.requested_by)),
            ];
            const [itemsResult, usersResult] = await Promise.all([
                supabase
                    .from("purchase_requests_items")
                    .select("request_id")
                    .in("request_id", requestIds),
                supabase
                    .from("users")
                    .select("id, name")
                    .in("id", requesterIds),
            ]);

            if (itemsResult.error || usersResult.error) {
                console.error(
                    "Error loading owner request details:",
                    itemsResult.error ?? usersResult.error
                );

                if (!ignore) {
                    setErrorMessage("Could not load the purchase request details.");
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
                receiptIssueReason: request.receipt_issue_reason,
                ownerEscalationReason: request.owner_escalation_reason,
                itemCount: itemRows.filter(
                    (item) => item.request_id === request.id
                ).length,
            }));

            if (!ignore) {
                setRequests(formattedRequests);
                setLoading(false);
            }
        }

        loadOwnerWorkflow();

        return () => {
            ignore = true;
        };
    }, [router]);

    if (loading) {
        return (
            <main className="app-page">
                <div className="mx-auto max-w-7xl">
                    <AppHeader />
                    <p className="text-muted">
                        Loading owner requests...
                    </p>
                </div>
            </main>
        );
    }

    const normalizedSearch = searchQuery.trim().toLowerCase();
    const matchesSearch = (request: OwnerRequest) =>
        !normalizedSearch ||
        String(request.id).includes(normalizedSearch.replace(/^#/, "")) ||
        request.requestedBy.toLowerCase().includes(normalizedSearch) ||
        request.receiptIssueReason?.toLowerCase().includes(normalizedSearch) ||
        request.ownerEscalationReason
            ?.toLowerCase()
            .includes(normalizedSearch);
    const needsAttention = requests.filter(
        (request) =>
            ["rejected", "receipt_issue", "escalated_owner"].includes(
                request.status
            ) && matchesSearch(request)
    );
    const awaitingAccountant = requests.filter(
        (request) =>
            request.status === "pending_accountant" && matchesSearch(request)
    );
    const awaitingReceipt = requests.filter(
        (request) => request.status === "approved" && matchesSearch(request)
    );
    const recentlyCompleted = requests
        .filter(
            (request) => request.status === "received" && matchesSearch(request)
        )
        .sort((first, second) =>
            (second.receivedAt ?? second.createdAt).localeCompare(
                first.receivedAt ?? first.createdAt
            )
        );
    const allPurchaseRequests = requests.filter(matchesSearch);
    const pageDetails = {
              "needs-attention": {
                  title: "Needs Attention",
                  description:
                      "Escalations, Accountant rejections, and receipt issues.",
              },
              "awaiting-accountant": {
                  title: "Waiting for Approval",
                  description: "Purchase requests waiting for a decision.",
              },
              "awaiting-receipt": {
                  title: "Ready to Receive",
                  description:
                      "Approved requests waiting to be received into stock.",
              },
              "recently-completed": {
                  title: "Completed",
                  description:
                      "Purchase requests recently received into inventory.",
              },
              "all-purchase-requests": {
                  title: "Purchase Requests",
                  description:
                      "Every purchase request in the system, from creation to completion.",
              },
          }[view];

    return (
        <main className="app-page">
            <div className="mx-auto max-w-7xl">
                <AppHeader />

                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h1 className="page-title">{pageDetails.title}</h1>
                        <p className="page-description mt-2">
                            {pageDetails.description}
                        </p>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row">
                        <Link
                            href="/dashboard"
                            className="secondary-action text-center"
                        >
                            Dashboard
                        </Link>
                        <Link
                            href="/inventory"
                            className="secondary-action text-center"
                        >
                            View Inventory
                        </Link>
                        {view !== "needs-attention" && (
                            <Link
                                href="/procurement/new"
                                className="primary-action text-center"
                            >
                                New Purchase Request
                            </Link>
                        )}
                    </div>
                </div>

                {errorMessage && (
                    <div className="error-message mt-8" role="alert">
                        {errorMessage}
                    </div>
                )}

                {!errorMessage && (
                    <ListSearch
                        value={searchQuery}
                        onChange={setSearchQuery}
                        placeholder="Search by request number or requester"
                        className="mt-8 max-w-xl"
                    />
                )}

                {!errorMessage && (
                    <>
                        {view === "needs-attention" && (
                            <>
                                <RequestSection
                                    id="purchase-request-attention"
                                    title="Purchase Requests"
                                    description="Escalations, Accountant rejections, and receipt issues."
                                    emptyMessage="No purchase requests currently need attention."
                                    requests={needsAttention}
                                />
                                <StockEscalationsSection
                                    searchQuery={searchQuery}
                                />
                            </>
                        )}
                        {view === "awaiting-accountant" && (
                            <RequestSection
                                id="awaiting-accountant"
                                title="Waiting for Approval"
                                description="Purchase requests waiting for a decision."
                                emptyMessage="No purchase requests are waiting for approval."
                                requests={awaitingAccountant}
                            />
                        )}
                        {view === "awaiting-receipt" && (
                            <RequestSection
                                id="awaiting-receipt"
                                title="Ready to Receive"
                                description="Approved requests waiting to be received into stock."
                                emptyMessage="No approved requests are awaiting receipt."
                                requests={awaitingReceipt}
                            />
                        )}
                        {view === "recently-completed" && (
                            <RequestSection
                                id="recently-completed"
                                title="Completed"
                                description="Purchase requests recently received into inventory."
                                emptyMessage="No purchase requests have been completed yet."
                                requests={recentlyCompleted}
                            />
                        )}
                        {view === "all-purchase-requests" && (
                            <RequestSection
                                id="all-purchase-requests"
                                title="Purchase Requests"
                                description="Every purchase request in the system."
                                emptyMessage="No purchase requests have been created yet."
                                requests={allPurchaseRequests}
                            />
                        )}
                    </>
                )}
            </div>
        </main>
    );
}
