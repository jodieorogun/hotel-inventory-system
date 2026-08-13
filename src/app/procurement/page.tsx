"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/app-header";
import { supabase } from "@/lib/supabase";

type ProcurementRequest = {
    id: number;
    status: string;
    createdAt: string;
    rejectionReason: string | null;
    lines: RequestLine[];
};

type RequestLine = {
    id: number;
    itemName: string;
    quantity: number;
    unit: string;
    unitPrice: number;
};

type RequestRow = {
    id: number;
    status: string;
    created_at: string;
    rejection_reason: string | null;
};

type RequestLineRow = {
    id: number;
    request_id: number;
    item_id: number;
    quantity: number | string;
    unit_price: number | string;
};

type ItemRow = {
    id: number;
    name: string;
    unit: string;
};

const currencyFormatter = new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
});

const statusDetails: Record<
    string,
    { label: string; className: string }
> = {
    pending_accountant: {
        label: "Pending Accountant Approval",
        className:
            "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
    },
    approved: {
        label: "Approved",
        className:
            "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300",
    },
    rejected: {
        label: "Rejected",
        className:
            "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
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

function formatStatus(status: string) {
    return statusDetails[status] ?? {
        label: status.replaceAll("_", " "),
        className:
            "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300",
    };
}

export default function ProcurementRequestsPage() {
    const router = useRouter();

    const [requests, setRequests] = useState<ProcurementRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState("");

    useEffect(() => {
        let ignore = false;

        async function loadRequests() {
            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser();

            if (userError || !user) {
                router.push("/login");
                return;
            }

            const { data: requestData, error: requestsError } =
                await supabase
                    .from("procurement_requests")
                    .select("id, status, created_at, rejection_reason")
                    .eq("requested_by", user.id)
                    .order("created_at", { ascending: false });

            if (requestsError) {
                console.error(
                    "Error loading procurement requests:",
                    requestsError
                );

                if (!ignore) {
                    setErrorMessage("Could not load your purchase requests.");
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

            const { data: lineData, error: linesError } = await supabase
                .from("procurement_requests_items")
                .select("id, request_id, item_id, quantity, unit_price")
                .in("request_id", requestIds)
                .order("id", { ascending: true });

            if (linesError) {
                console.error(
                    "Error loading procurement request items:",
                    linesError
                );

                if (!ignore) {
                    setErrorMessage("Could not load your purchase request items.");
                    setLoading(false);
                }

                return;
            }

            const lineRows = (lineData ?? []) as RequestLineRow[];
            const itemIds = [...new Set(lineRows.map((line) => line.item_id))];
            let itemRows: ItemRow[] = [];

            if (itemIds.length > 0) {
                const { data: itemData, error: itemsError } = await supabase
                    .from("items")
                    .select("id, name, unit")
                    .in("id", itemIds);

                if (itemsError) {
                    console.error(
                        "Error loading items for procurement requests:",
                        itemsError
                    );

                    if (!ignore) {
                        setErrorMessage("Could not load the requested item details.");
                        setLoading(false);
                    }

                    return;
                }

                itemRows = (itemData ?? []) as ItemRow[];
            }

            const itemsById = new Map(
                itemRows.map((item) => [item.id, item])
            );

            const formattedRequests = requestRows.map((request) => ({
                id: request.id,
                status: request.status,
                createdAt: request.created_at,
                rejectionReason: request.rejection_reason,
                lines: lineRows
                    .filter((line) => line.request_id === request.id)
                    .map((line) => {
                        const item = itemsById.get(line.item_id);

                        return {
                            id: line.id,
                            itemName: item?.name ?? "Unknown item",
                            quantity: Number(line.quantity),
                            unit: item?.unit ?? "",
                            unitPrice: Number(line.unit_price),
                        };
                    }),
            }));

            if (!ignore) {
                setRequests(formattedRequests);
                setLoading(false);
            }
        }

        loadRequests();

        return () => {
            ignore = true;
        };
    }, [router]);

    if (loading) {
        return (
            <main className="app-page">
                <div className="mx-auto max-w-7xl">
                    <AppHeader />

                    <p className="text-muted">Loading your requests...</p>
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
                        <h1 className="page-title">My Requests</h1>

                        <p className="page-description mt-2">
                            Track your submitted purchase requests.
                        </p>
                    </div>

                    <Link
                        href="/procurement/new"
                        className="primary-action text-center"
                    >
                        New Purchase Request
                    </Link>
                </div>

                {errorMessage && (
                    <div className="error-message mt-8">
                        {errorMessage}
                    </div>
                )}

                {!errorMessage && requests.length === 0 && (
                    <div className="surface-card mt-8 p-8 text-center">
                        <h2 className="text-xl font-semibold">
                            No purchase requests yet
                        </h2>

                        <p className="text-muted mt-2">
                            Your submitted requests will appear here.
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
                                                {request.lines.length}{" "}
                                                {request.lines.length === 1
                                                    ? "item"
                                                    : "items"}
                                                {" · "}
                                                {formatDate(request.createdAt)}
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

                                    <div className="border-t border-[var(--border)]">
                                        {request.lines.length === 0 ? (
                                            <p className="text-muted px-6 py-4 text-sm">
                                                No items were found for this request.
                                            </p>
                                        ) : (
                                            request.lines.map((line) => (
                                                <div
                                                    key={line.id}
                                                    className="grid gap-2 border-b border-[var(--border)] px-6 py-4 last:border-b-0 sm:grid-cols-[1fr_auto] sm:items-center"
                                                >
                                                    <div>
                                                        <p className="font-medium">
                                                            {line.itemName}
                                                        </p>

                                                        <p className="text-muted mt-1 text-sm">
                                                            {line.quantity}{" "}
                                                            {line.unit} ×{" "}
                                                            {currencyFormatter.format(
                                                                line.unitPrice
                                                            )}
                                                        </p>
                                                    </div>

                                                    <p className="font-medium text-[var(--muted-strong)]">
                                                        {currencyFormatter.format(
                                                            line.quantity *
                                                                line.unitPrice
                                                        )}
                                                    </p>
                                                </div>
                                            ))
                                        )}
                                    </div>

                                    {request.status === "rejected" &&
                                        request.rejectionReason && (
                                            <div className="border-t border-[var(--danger-border)] bg-[var(--danger-soft)] px-6 py-5">
                                                <p className="text-sm font-semibold text-[var(--danger)]">
                                                    Reason for rejection
                                                </p>
                                                <p className="mt-2 whitespace-pre-wrap text-sm">
                                                    {request.rejectionReason}
                                                </p>
                                            </div>
                                        )}
                                </article>
                            );
                        })}
                    </div>
                )}
            </div>
        </main>
    );
}
