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
    requestedBy: string;
    itemSummary: string;
    itemCount: number;
};

type RequestRow = {
    id: number;
    status: string;
    created_at: string;
    requested_by: string;
    storekeeper_confirmed_at: string | null;
};

type LineRow = {
    request_id: number;
    item_id: number;
    requested_quantity: number | string;
};

function formatDate(value: string) {
    return new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
    }).format(new Date(value));
}

export default function StorekeeperStockOutPage() {
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
            if (["pending", "issued", "escalated", "all"].includes(requestedTab ?? "")) {
                setActiveTab(requestedTab!);
            }

            const { data: profile } = await supabase
                .from("users")
                .select("role")
                .eq("id", user.id)
                .single();

            if (!profile || !["storekeeper", "owner"].includes(profile.role)) {
                router.replace("/dashboard");
                return;
            }

            const { data: requestData, error: requestError } = await supabase
                .from("stock_out_requests")
                .select("id, status, created_at, requested_by, storekeeper_confirmed_at")
                .order("created_at", { ascending: false });

            if (requestError) {
                console.error("Error loading stock-out requests:", requestError);
                if (!ignore) {
                    setErrorMessage("Could not load stock-out requests.");
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
            const requesterIds = [...new Set(requestRows.map((request) => request.requested_by))];
            const [linesResult, usersResult] = await Promise.all([
                supabase
                    .from("stock_out_request_items")
                    .select("request_id, item_id, requested_quantity")
                    .in("request_id", requestIds),
                supabase.from("users").select("id, name").in("id", requesterIds),
            ]);

            if (linesResult.error || usersResult.error) {
                console.error("Error loading stock-out details:", linesResult.error ?? usersResult.error);
                if (!ignore) {
                    setErrorMessage("Could not load stock-out details.");
                    setLoading(false);
                }
                return;
            }

            const lines = (linesResult.data ?? []) as LineRow[];
            const itemIds = [...new Set(lines.map((line) => line.item_id))];
            const { data: itemData } = await supabase
                .from("items")
                .select("id, name, unit")
                .in("id", itemIds);
            const itemsById = new Map((itemData ?? []).map((item) => [item.id, item]));
            const usersById = new Map((usersResult.data ?? []).map((person) => [person.id, person.name]));

            const formattedRequests = requestRows.map((request) => {
                const requestLines = lines.filter((line) => line.request_id === request.id);
                const shown = requestLines.slice(0, 3).map((line) => {
                    const item = itemsById.get(line.item_id);
                    return `${item?.name ?? "Unknown item"} · ${formatQuantity(
                        Number(line.requested_quantity),
                        item?.unit ?? ""
                    )}`;
                });
                const remaining = requestLines.length - shown.length;

                return {
                    id: request.id,
                    status: request.status,
                    createdAt: request.created_at,
                    confirmedAt: request.storekeeper_confirmed_at,
                    requestedBy: usersById.get(request.requested_by) ?? "Housekeeper",
                    itemSummary: `${shown.join(", ")}${remaining > 0 ? ` + ${remaining} more` : ""}`,
                    itemCount: requestLines.length,
                };
            });

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
                    <p className="text-muted">Loading stock requests...</p>
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
            request.requestedBy.toLowerCase().includes(normalizedSearch) ||
            request.itemSummary.toLowerCase().includes(normalizedSearch);

        return matchesTab && matchesSearch && matchesDateFilter(
            request.confirmedAt ?? request.createdAt,
            dateFilter,
            pickedDate
        );
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
                <h1 className="page-title">Stock Requests</h1>
                <p className="page-description mt-2">
                    Record consumables handed out to Housekeepers.
                </p>

                {errorMessage && <p className="error-message mt-8">{errorMessage}</p>}
                {!errorMessage && (
                    <RequestListFilters
                        tabs={[
                            { value: "pending", label: "Pending" },
                            { value: "issued", label: "Issued" },
                            { value: "escalated", label: "Owner Review" },
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
                        searchPlaceholder="Search by request number, Housekeeper, or item"
                    />
                )}

                {!errorMessage && filteredRequests.length === 0 && (
                    <div className="surface-card mt-8 p-8 text-center">
                        <h2 className="text-lg font-semibold">No matching stock requests</h2>
                        <p className="text-muted mt-2">New Housekeeper requests will appear here.</p>
                    </div>
                )}

                <div className="mt-8 grid gap-6 lg:grid-cols-2">
                    {filteredRequests.map((request) => (
                        <article key={request.id} className="surface-card overflow-hidden">
                            <div className="p-6">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <h2 className="text-xl font-semibold">Request #{request.id}</h2>
                                        <p className="text-muted mt-1 text-sm">{request.requestedBy}</p>
                                        <p className="text-muted mt-1 text-sm">{formatDate(request.createdAt)}</p>
                                    </div>
                                    <span className={`rounded-full border px-3 py-1 text-sm font-medium ${
                                        request.status === "pending_storekeeper"
                                            ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
                                            : request.status === "issued"
                                              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                                              : request.status === "escalated_owner"
                                                ? "border-purple-200 bg-purple-50 text-purple-800 dark:border-purple-900 dark:bg-purple-950 dark:text-purple-300"
                                                : "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
                                    }`}>
                                        {request.status === "pending_storekeeper" ? "Pending" : request.status === "issued" ? "Issued" : request.status === "escalated_owner" ? "Owner Review" : "Voided"}
                                    </span>
                                </div>
                                <p className="mt-4 text-sm font-medium">{request.itemSummary || "No items"}</p>
                                <p className="text-muted mt-1 text-sm">{request.itemCount} {request.itemCount === 1 ? "item" : "items"}</p>
                            </div>
                            <div className="border-t border-[var(--border)] p-5">
                                <Link
                                    href={`/storekeeper/stock-out/${request.id}`}
                                    className={`${request.status === "pending_storekeeper" ? "primary-action" : "secondary-action"} w-full text-center`}
                                >
                                    {request.status === "pending_storekeeper" ? "Review Request" : "View Request"}
                                </Link>
                            </div>
                        </article>
                    ))}
                </div>
            </div>
        </main>
    );
}
