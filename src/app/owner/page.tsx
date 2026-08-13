"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/app-header";
import { supabase } from "@/lib/supabase";

type OwnerRequest = {
    id: number;
    status: string;
    createdAt: string;
    receivedAt: string | null;
    requestedBy: string;
    receiptIssueReason: string | null;
    itemCount: number;
};

type RequestRow = {
    id: number;
    status: string;
    created_at: string;
    requested_by: string;
    storekeeper_verified_at: string | null;
    receipt_issue_reason: string | null;
};

type RequestItemRow = {
    request_id: number;
};

type UserRow = {
    id: string;
    name: string;
};

const statusDetails: Record<
    string,
    { label: string; className: string }
> = {
    pending_accountant: {
        label: "Awaiting Accountant",
        className:
            "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
    },
    approved: {
        label: "Awaiting Receipt",
        className:
            "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300",
    },
    rejected: {
        label: "Rejected",
        className:
            "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
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
                            <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--danger)]">
                                {request.receiptIssueReason}
                            </p>
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

export type OwnerWorkflowView =
    | "needs-attention"
    | "awaiting-accountant"
    | "awaiting-receipt"
    | "recently-completed";

export function OwnerWorkflow({ view }: { view?: OwnerWorkflowView }) {
    const router = useRouter();
    const [requests, setRequests] = useState<OwnerRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState("");

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
                    "id, status, created_at, requested_by, storekeeper_verified_at, receipt_issue_reason"
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
                        Loading owner {view ? "requests" : "overview"}...
                    </p>
                </div>
            </main>
        );
    }

    const needsAttention = requests.filter((request) =>
        ["rejected", "receipt_issue", "cancelled"].includes(request.status)
    );
    const awaitingAccountant = requests.filter(
        (request) => request.status === "pending_accountant"
    );
    const awaitingReceipt = requests.filter(
        (request) => request.status === "approved"
    );
    const recentlyCompleted = requests
        .filter((request) => request.status === "received")
        .sort((first, second) =>
            (second.receivedAt ?? second.createdAt).localeCompare(
                first.receivedAt ?? first.createdAt
            )
        );
    const pageDetails = view
        ? {
              "needs-attention": {
                  title: "Needs Attention",
                  description: "Rejected, cancelled, and receipt-issue requests.",
              },
              "awaiting-accountant": {
                  title: "Awaiting Accountant",
                  description: "Requests waiting for approval or rejection.",
              },
              "awaiting-receipt": {
                  title: "Awaiting Receipt",
                  description:
                      "Approved requests waiting to be received into stock.",
              },
              "recently-completed": {
                  title: "Recently Completed",
                  description:
                      "Purchase requests recently received into inventory.",
              },
          }[view]
        : {
              title: "Owner Overview",
              description: "View and manage the complete stock-in workflow.",
          };

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
                        {view && (
                            <Link
                                href="/owner"
                                className="secondary-action text-center"
                            >
                                Owner Overview
                            </Link>
                        )}
                        <Link
                            href="/inventory"
                            className="secondary-action text-center"
                        >
                            View Inventory
                        </Link>
                        <Link
                            href="/procurement/new"
                            className="primary-action text-center"
                        >
                            New Purchase Request
                        </Link>
                    </div>
                </div>

                {errorMessage && (
                    <div className="error-message mt-8" role="alert">
                        {errorMessage}
                    </div>
                )}

                {!errorMessage && (
                    <>
                        {(!view || view === "needs-attention") && (
                            <RequestSection
                                id="needs-attention"
                                title="Needs Attention"
                                description="Rejected, cancelled, and receipt-issue requests."
                                emptyMessage="No requests currently need attention."
                                requests={needsAttention}
                            />
                        )}
                        {(!view || view === "awaiting-accountant") && (
                            <RequestSection
                                id="awaiting-accountant"
                                title="Awaiting Accountant"
                                description="Requests waiting for approval or rejection."
                                emptyMessage="No requests are awaiting accountant review."
                                requests={awaitingAccountant}
                            />
                        )}
                        {(!view || view === "awaiting-receipt") && (
                            <RequestSection
                                id="awaiting-receipt"
                                title="Awaiting Receipt"
                                description="Approved requests waiting to be received into stock."
                                emptyMessage="No approved requests are awaiting receipt."
                                requests={awaitingReceipt}
                            />
                        )}
                        {(!view || view === "recently-completed") && (
                            <RequestSection
                                id="recently-completed"
                                title="Recently Completed"
                                description="Purchase requests recently received into inventory."
                                emptyMessage="No purchase requests have been completed yet."
                                requests={recentlyCompleted}
                            />
                        )}
                    </>
                )}
            </div>
        </main>
    );
}

export default function OwnerPage() {
    return <OwnerWorkflow />;
}
