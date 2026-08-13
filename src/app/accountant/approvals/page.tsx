"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/app-header";
import { supabase } from "@/lib/supabase";

type ReviewedRequest = {
    id: number;
    status: string;
    createdAt: string;
    reviewedAt: string | null;
    requestedBy: string;
    lines: RequestLine[];
};

type RequestLine = {
    id: number;
    quantity: number;
    unitPrice: number;
};

type RequestRow = {
    id: number;
    status: string;
    created_at: string;
    requested_by: string;
    accountant_approved_at: string | null;
};

type RequestLineRow = {
    id: number;
    request_id: number;
    quantity: number | string;
    unit_price: number | string;
};

type UserRow = {
    id: string;
    name: string;
};

const currencyFormatter = new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
});

const statusDetails: Record<
    string,
    { label: string; className: string }
> = {
    approved: {
        label: "Approved",
        className:
            "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
    },
    rejected: {
        label: "Rejected",
        className:
            "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
    },
    received: {
        label: "Received",
        className:
            "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300",
    },
};

function formatDate(value: string) {
    return new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
    }).format(new Date(value));
}

function formatStatus(status: string) {
    return statusDetails[status] ?? {
        label: status.replaceAll("_", " "),
        className:
            "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300",
    };
}

export default function AccountantApprovalHistoryPage() {
    const router = useRouter();
    const [requests, setRequests] = useState<ReviewedRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState("");

    useEffect(() => {
        let ignore = false;

        async function loadApprovalHistory() {
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
                console.error("Error checking accountant role:", profileError);

                if (!ignore) {
                    setErrorMessage("Could not verify your account permissions.");
                    setLoading(false);
                }

                return;
            }

            if (profile.role !== "accountant") {
                router.replace("/dashboard");
                return;
            }

            const { data: requestData, error: requestsError } = await supabase
                .from("procurement_requests")
                .select(
                    "id, status, created_at, requested_by, accountant_approved_at"
                )
                .eq("accountant_approved_by", user.id)
                .in("status", ["approved", "rejected", "received"])
                .order("accountant_approved_at", { ascending: false });

            if (requestsError) {
                console.error("Error loading approval history:", requestsError);

                if (!ignore) {
                    setErrorMessage("Could not load your approval history.");
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
            const [linesResult, usersResult] = await Promise.all([
                supabase
                    .from("procurement_requests_items")
                    .select("id, request_id, quantity, unit_price")
                    .in("request_id", requestIds),
                supabase
                    .from("users")
                    .select("id, name")
                    .in("id", requesterIds),
            ]);

            if (linesResult.error || usersResult.error) {
                console.error(
                    "Error loading approval history details:",
                    linesResult.error ?? usersResult.error
                );

                if (!ignore) {
                    setErrorMessage("Could not load the reviewed request details.");
                    setLoading(false);
                }

                return;
            }

            const lineRows = (linesResult.data ?? []) as RequestLineRow[];
            const userRows = (usersResult.data ?? []) as UserRow[];
            const usersById = new Map(
                userRows.map((requester) => [requester.id, requester.name])
            );
            const formattedRequests = requestRows.map((request) => ({
                id: request.id,
                status: request.status,
                createdAt: request.created_at,
                reviewedAt: request.accountant_approved_at,
                requestedBy:
                    usersById.get(request.requested_by) ?? "Procurement user",
                lines: lineRows
                    .filter((line) => line.request_id === request.id)
                    .map((line) => ({
                        id: line.id,
                        quantity: Number(line.quantity),
                        unitPrice: Number(line.unit_price),
                    })),
            }));

            if (!ignore) {
                setRequests(formattedRequests);
                setLoading(false);
            }
        }

        loadApprovalHistory();

        return () => {
            ignore = true;
        };
    }, [router]);

    if (loading) {
        return (
            <main className="app-page">
                <div className="mx-auto max-w-7xl">
                    <AppHeader />
                    <p className="text-muted">Loading approval history...</p>
                </div>
            </main>
        );
    }

    return (
        <main className="app-page">
            <div className="mx-auto max-w-7xl">
                <AppHeader />

                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h1 className="page-title">Approval History</h1>
                        <p className="page-description mt-2">
                            View purchase requests you have approved or rejected.
                        </p>
                    </div>

                    <Link
                        href="/accountant/requests"
                        className="secondary-action text-center"
                    >
                        Pending Requests
                    </Link>
                </div>

                {errorMessage && (
                    <div className="error-message mt-8" role="alert">
                        {errorMessage}
                    </div>
                )}

                {!errorMessage && requests.length === 0 && (
                    <div className="surface-card mt-8 p-8 text-center">
                        <h2 className="text-xl font-semibold">
                            No approval history yet
                        </h2>
                        <p className="text-muted mt-2">
                            Requests you approve or reject will appear here.
                        </p>
                    </div>
                )}

                {!errorMessage && requests.length > 0 && (
                    <div className="mt-8 grid gap-6 lg:grid-cols-2">
                        {requests.map((request) => {
                            const status = formatStatus(request.status);
                            const total = request.lines.reduce(
                                (sum, line) =>
                                    sum + line.quantity * line.unitPrice,
                                0
                            );

                            return (
                                <article
                                    key={request.id}
                                    className="surface-card h-full overflow-hidden"
                                >
                                    <div className="flex flex-col gap-5 p-7 sm:flex-row sm:items-start sm:justify-between">
                                        <div>
                                            <h2 className="text-xl font-semibold">
                                                Request #{request.id}
                                            </h2>
                                            <p className="text-muted mt-2 text-sm">
                                                Requested by: {request.requestedBy}
                                            </p>
                                            <p className="text-muted mt-1 text-sm">
                                                Submitted: {formatDate(request.createdAt)}
                                            </p>
                                            {request.reviewedAt && (
                                                <p className="text-muted mt-1 text-sm">
                                                    Reviewed: {formatDate(request.reviewedAt)}
                                                </p>
                                            )}
                                            <p className="text-muted mt-1 text-sm">
                                                {request.lines.length}{" "}
                                                {request.lines.length === 1
                                                    ? "item"
                                                    : "items"}
                                            </p>
                                        </div>

                                        <div className="sm:text-right">
                                            <span
                                                className={`inline-flex rounded-full border px-3 py-1 text-sm font-medium ${status.className}`}
                                            >
                                                {status.label}
                                            </span>
                                            <p className="mt-3 text-xl font-semibold">
                                                {currencyFormatter.format(total)}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="border-t border-[var(--border)] p-5">
                                        <Link
                                            href={`/accountant/requests/${request.id}`}
                                            className="secondary-action w-full text-center"
                                        >
                                            View Request
                                        </Link>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </div>
        </main>
    );
}
