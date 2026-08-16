"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/app-header";
import RequestListFilters, {
    type DateFilterValue,
    matchesDateFilter,
} from "@/components/request-list-filters";
import { supabase } from "@/lib/supabase";
import { formatQuantity } from "@/lib/units";

type StockRequest = {
    id: number;
    status: string;
    createdAt: string;
    confirmedAt: string | null;
    rejectionReason: string | null;
    lines: StockRequestLine[];
};

type StockRequestLine = {
    id: number;
    itemName: string;
    unit: string;
    requestedQuantity: number;
    issuedQuantity: number | null;
};

type RequestRow = {
    id: number;
    status: string;
    created_at: string;
    storekeeper_confirmed_at: string | null;
    rejection_reason: string | null;
};

type LineRow = {
    id: number;
    request_id: number;
    item_id: number;
    requested_quantity: number | string;
    issued_quantity: number | string | null;
};

function formatDate(value: string) {
    return new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
    }).format(new Date(value));
}

const statusDetails: Record<string, { label: string; className: string }> = {
    pending_storekeeper: {
        label: "Awaiting Storekeeper",
        className: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
    },
    issued: {
        label: "Issued",
        className: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
    },
    rejected: {
        label: "Rejected",
        className: "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
    },
    escalated_owner: {
        label: "Owner Review",
        className: "border-purple-200 bg-purple-50 text-purple-800 dark:border-purple-900 dark:bg-purple-950 dark:text-purple-300",
    },
    cancelled: {
        label: "Cancelled",
        className: "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300",
    },
};

export default function HousekeeperRequestsPage() {
    const router = useRouter();
    const [requests, setRequests] = useState<StockRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState("");
    const [activeTab, setActiveTab] = useState("pending");
    const [dateFilter, setDateFilter] = useState<DateFilterValue>("any");
    const [pickedDate, setPickedDate] = useState("");
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        let ignore = false;

        async function loadRequests() {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                router.replace("/login");
                return;
            }

            const requestedTab = new URLSearchParams(window.location.search).get("tab");
            if (["pending", "issued", "escalated", "cancelled", "all"].includes(requestedTab ?? "")) {
                setActiveTab(requestedTab!);
            }

            const { data: profile } = await supabase
                .from("users")
                .select("role")
                .eq("id", user.id)
                .single();

            if (profile?.role !== "housekeeper") {
                router.replace("/dashboard");
                return;
            }

            const { data: requestData, error: requestError } = await supabase
                .from("stock_out_requests")
                .select("id, status, created_at, storekeeper_confirmed_at, rejection_reason")
                .eq("requested_by", user.id)
                .order("created_at", { ascending: false });

            if (requestError) {
                console.error("Error loading stock requests:", requestError);
                if (!ignore) {
                    setErrorMessage("Could not load your stock requests.");
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
            const { data: lineData, error: lineError } = await supabase
                .from("stock_out_request_items")
                .select("id, request_id, item_id, requested_quantity, issued_quantity")
                .in("request_id", requestIds)
                .order("id");

            if (lineError) {
                console.error("Error loading stock request items:", lineError);
                if (!ignore) {
                    setErrorMessage("Could not load your requested items.");
                    setLoading(false);
                }
                return;
            }

            const lineRows = (lineData ?? []) as LineRow[];
            const itemIds = [...new Set(lineRows.map((line) => line.item_id))];
            const { data: itemData, error: itemError } = await supabase
                .from("items")
                .select("id, name, unit")
                .in("id", itemIds);

            if (itemError) {
                console.error("Error loading stock item names:", itemError);
            }

            const itemsById = new Map(
                (itemData ?? []).map((item) => [item.id, item])
            );
            const formattedRequests = requestRows.map((request) => ({
                id: request.id,
                status: request.status,
                createdAt: request.created_at,
                confirmedAt: request.storekeeper_confirmed_at,
                rejectionReason: request.rejection_reason,
                lines: lineRows
                    .filter((line) => line.request_id === request.id)
                    .map((line) => {
                        const item = itemsById.get(line.item_id);
                        return {
                            id: line.id,
                            itemName: item?.name ?? "Unknown item",
                            unit: item?.unit ?? "",
                            requestedQuantity: Number(line.requested_quantity),
                            issuedQuantity:
                                line.issued_quantity === null
                                    ? null
                                    : Number(line.issued_quantity),
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
                    <p className="text-muted">Loading requests...</p>
                </div>
            </main>
        );
    }

    const normalizedSearch = searchQuery.trim().toLowerCase();
    const filteredRequests = requests.filter((request) => {
        const matchesTab =
            activeTab === "all" ||
            (activeTab === "pending" && request.status === "pending_storekeeper") ||
            (activeTab === "escalated" && request.status === "escalated_owner") ||
            request.status === activeTab;
        const matchesSearch =
            !normalizedSearch ||
            String(request.id).includes(normalizedSearch.replace(/^#/, "")) ||
            request.lines.some((line) =>
                line.itemName.toLowerCase().includes(normalizedSearch)
            );
        const eventDate = request.confirmedAt ?? request.createdAt;

        return matchesTab && matchesSearch && matchesDateFilter(eventDate, dateFilter, pickedDate);
    });

    function changeTab(tab: string) {
        setActiveTab(tab);
        const url = new URL(window.location.href);
        url.searchParams.set("tab", tab);
        window.history.replaceState(null, "", url);
    }

    return (
        <main className="app-page">
            <div className="mx-auto max-w-7xl">
                <AppHeader />
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h1 className="page-title">My Stock Requests</h1>
                        <p className="page-description mt-2">
                            Track consumables requested from the Storekeeper.
                        </p>
                    </div>
                    <Link href="/housekeeper/requests/new" className="primary-action text-center">
                        New Stock Request
                    </Link>
                </div>

                {errorMessage && <p className="error-message mt-8">{errorMessage}</p>}

                {!errorMessage && (
                    <RequestListFilters
                        tabs={[
                            { value: "pending", label: "Pending" },
                            { value: "issued", label: "Issued" },
                            { value: "escalated", label: "Owner Review" },
                            { value: "cancelled", label: "Voided" },
                            { value: "all", label: "All" },
                        ]}
                        activeTab={activeTab}
                        onTabChange={changeTab}
                        dateFilter={dateFilter}
                        onDateFilterChange={setDateFilter}
                        pickedDate={pickedDate}
                        onPickedDateChange={setPickedDate}
                        searchQuery={searchQuery}
                        onSearchQueryChange={setSearchQuery}
                        searchPlaceholder="Search by request number or item"
                    />
                )}

                {!errorMessage && filteredRequests.length === 0 && (
                    <div className="surface-card mt-8 p-8 text-center">
                        <h2 className="text-lg font-semibold">No matching requests</h2>
                        <p className="text-muted mt-2">Your submitted requests will appear here.</p>
                    </div>
                )}

                <div className="mt-8 grid gap-6 lg:grid-cols-2">
                    {filteredRequests.map((request) => {
                        const status = statusDetails[request.status] ?? statusDetails.cancelled;
                        return (
                            <article key={request.id} className="surface-card overflow-hidden">
                                <div className="flex items-start justify-between gap-4 p-6">
                                    <div>
                                        <h2 className="text-xl font-semibold">Request #{request.id}</h2>
                                        <p className="text-muted mt-1 text-sm">{formatDate(request.createdAt)}</p>
                                    </div>
                                    <span className={`rounded-full border px-3 py-1 text-sm font-medium ${status.className}`}>
                                        {status.label}
                                    </span>
                                </div>
                                <div className="border-t border-[var(--border)]">
                                    {request.lines.map((line) => (
                                        <div key={line.id} className="border-b border-[var(--border)] px-6 py-4 last:border-b-0">
                                            <p className="font-medium">{line.itemName}</p>
                                            <p className="text-muted mt-1 text-sm">
                                                Requested: {formatQuantity(line.requestedQuantity, line.unit)}
                                            </p>
                                            {line.issuedQuantity !== null && (
                                                <p className="mt-1 text-sm">
                                                    Issued: {formatQuantity(line.issuedQuantity, line.unit)}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                {request.rejectionReason && (
                                    <div className="border-t border-[var(--danger-border)] bg-[var(--danger-soft)] px-6 py-4">
                                        <p className="text-sm font-semibold text-[var(--danger)]">Reason</p>
                                        <p className="mt-1 text-sm">{request.rejectionReason}</p>
                                    </div>
                                )}
                            </article>
                        );
                    })}
                </div>
            </div>
        </main>
    );
}
