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
        className: "border-amber-900 bg-amber-950 text-amber-300",
    },
    approved: {
        label: "Approved",
        className: "border-blue-900 bg-blue-950 text-blue-300",
    },
    rejected: {
        label: "Rejected",
        className: "border-red-900 bg-red-950 text-red-300",
    },
    received: {
        label: "Received",
        className: "border-emerald-900 bg-emerald-950 text-emerald-300",
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
        className: "border-gray-700 bg-gray-900 text-gray-300",
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
                    .select("id, status, created_at")
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
            <main className="min-h-screen bg-black p-8 text-white">
                <div className="mx-auto max-w-5xl">
                    <AppHeader />

                    <p className="text-gray-400">Loading your requests...</p>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-black p-8 text-white">
            <div className="mx-auto max-w-5xl">
                <AppHeader />

                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">My Requests</h1>

                        <p className="mt-2 text-gray-400">
                            Track your submitted purchase requests.
                        </p>
                    </div>

                    <Link
                        href="/procurement/new"
                        className="rounded-lg bg-white px-5 py-3 text-center font-medium text-black hover:bg-gray-200"
                    >
                        New Purchase Request
                    </Link>
                </div>

                {errorMessage && (
                    <div className="mt-8 rounded-xl border border-red-900 bg-red-950 p-5 text-red-300">
                        {errorMessage}
                    </div>
                )}

                {!errorMessage && requests.length === 0 && (
                    <div className="mt-8 rounded-xl border border-gray-800 bg-gray-950 p-8 text-center">
                        <h2 className="text-xl font-semibold">
                            No purchase requests yet
                        </h2>

                        <p className="mt-2 text-gray-400">
                            Your submitted requests will appear here.
                        </p>
                    </div>
                )}

                {!errorMessage && requests.length > 0 && (
                    <div className="mt-8 space-y-5">
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
                                    className="overflow-hidden rounded-xl border border-gray-800 bg-gray-950"
                                >
                                    <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:justify-between">
                                        <div>
                                            <h2 className="text-xl font-semibold">
                                                Request #{request.id}
                                            </h2>

                                            <p className="mt-2 text-sm text-gray-400">
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

                                    <div className="border-t border-gray-800">
                                        {request.lines.length === 0 ? (
                                            <p className="px-6 py-4 text-sm text-gray-500">
                                                No items were found for this request.
                                            </p>
                                        ) : (
                                            request.lines.map((line) => (
                                                <div
                                                    key={line.id}
                                                    className="grid gap-2 border-b border-gray-800 px-6 py-4 last:border-b-0 sm:grid-cols-[1fr_auto] sm:items-center"
                                                >
                                                    <div>
                                                        <p className="font-medium">
                                                            {line.itemName}
                                                        </p>

                                                        <p className="mt-1 text-sm text-gray-400">
                                                            {line.quantity}{" "}
                                                            {line.unit} ×{" "}
                                                            {currencyFormatter.format(
                                                                line.unitPrice
                                                            )}
                                                        </p>
                                                    </div>

                                                    <p className="font-medium text-gray-200">
                                                        {currencyFormatter.format(
                                                            line.quantity *
                                                                line.unitPrice
                                                        )}
                                                    </p>
                                                </div>
                                            ))
                                        )}
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
