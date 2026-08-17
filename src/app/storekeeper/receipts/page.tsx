"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/app-header";
import RequestListFilters, {
    DateFilterValue,
    matchesDateFilter,
} from "@/components/request-list-filters";
import { supabase } from "@/lib/supabase";

type ReceiptRequest = {
    id: number;
    status: string;
    createdAt: string;
    approvedAt: string | null;
    receivedAt: string | null;
    requestedBy: string;
    approvedBy: string;
    receivedBy: string | null;
    receiptIssueReason: string | null;
    receiptIssueReportedAt: string | null;
    receiptIssueReportedBy: string | null;
    receiptIssueResolvedAt: string | null;
    itemCount: number;
    itemSummary: string;
};

type RequestRow = {
    id: number;
    status: string;
    created_at: string;
    requested_by: string;
    accountant_approved_by: string | null;
    accountant_approved_at: string | null;
    storekeeper_verified_by: string | null;
    storekeeper_verified_at: string | null;
    receipt_issue_reason: string | null;
    receipt_issue_reported_by: string | null;
    receipt_issue_reported_at: string | null;
    receipt_issue_resolved_at: string | null;
};

type RequestItemRow = {
    request_id: number;
    item_id: number;
};

type UserRow = {
    id: string;
    name: string;
};

type ItemRow = {
    id: number;
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
    const [activeTab, setActiveTab] = useState("awaiting");
    const [dateFilter, setDateFilter] = useState<DateFilterValue>("any");
    const [pickedDate, setPickedDate] = useState("");
    const [searchQuery, setSearchQuery] = useState("");

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

            const requestedTab = new URLSearchParams(
                window.location.search
            ).get("tab");

            if (
                ["awaiting", "issues", "received", "all"].includes(
                    requestedTab ?? ""
                )
            ) {
                setActiveTab(requestedTab!);
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

            if (!["storekeeper", "owner"].includes(profile.role)) {
                router.replace("/dashboard");
                return;
            }

            const { data: requestData, error: requestsError } = await supabase
                .from("purchase_requests")
                .select(
                    "id, status, created_at, requested_by, accountant_approved_by, accountant_approved_at, storekeeper_verified_by, storekeeper_verified_at, receipt_issue_reason, receipt_issue_reported_by, receipt_issue_reported_at, receipt_issue_resolved_at"
                )
                .or(
                    "status.in.(approved,received,receipt_issue),receipt_issue_reason.not.is.null"
                )
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
                    .select("request_id, item_id")
                    .in("request_id", requestIds),
                supabase
                    .from("users")
                    .select("id, name")
                    .in("id", userIds),
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
            const itemIds = [...new Set(itemRows.map((item) => item.item_id))];
            let inventoryItems: ItemRow[] = [];

            if (itemIds.length > 0) {
                const { data: itemData, error: itemNamesError } = await supabase
                    .from("items")
                    .select("id, name")
                    .in("id", itemIds);

                if (itemNamesError) {
                    console.error(
                        "Error loading receipt item names:",
                        itemNamesError
                    );

                    if (!ignore) {
                        setErrorMessage("Could not load the receipt item summary.");
                        setLoading(false);
                    }

                    return;
                }

                inventoryItems = (itemData ?? []) as ItemRow[];
            }

            const userRows = (usersResult.data ?? []) as UserRow[];
            const usersById = new Map(
                userRows.map((profileRow) => [profileRow.id, profileRow.name])
            );
            const itemsById = new Map(
                inventoryItems.map((item) => [item.id, item])
            );
            const formattedRequests = requestRows.map((request) => {
                const requestItems = itemRows.filter(
                    (item) => item.request_id === request.id
                );
                const shownItems = requestItems
                    .slice(0, 3)
                    .map(
                        (item) =>
                            itemsById.get(item.item_id)?.name ?? "Unknown item"
                    );
                const remainingItems = requestItems.length - shownItems.length;

                return {
                    id: request.id,
                    status: request.status,
                    createdAt: request.created_at,
                    approvedAt: request.accountant_approved_at,
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
                    receiptIssueResolvedAt: request.receipt_issue_resolved_at,
                    itemCount: requestItems.length,
                    itemSummary: `${shownItems.join(", ")}${
                        remainingItems > 0
                            ? ` + ${remainingItems} more ${remainingItems === 1 ? "item" : "items"}`
                            : ""
                    }`,
                };
            });

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

    const hasUnresolvedIssue = (request: ReceiptRequest) =>
        request.status === "receipt_issue" ||
        (Boolean(request.receiptIssueReason) &&
            !request.receiptIssueResolvedAt &&
            request.status !== "received");
    const normalizedSearch = searchQuery.trim().toLowerCase();
    const matchesSearch = (request: ReceiptRequest) =>
        !normalizedSearch ||
        String(request.id).includes(normalizedSearch.replace(/^#/, "")) ||
        request.itemSummary.toLowerCase().includes(normalizedSearch) ||
        request.requestedBy.toLowerCase().includes(normalizedSearch) ||
        request.approvedBy.toLowerCase().includes(normalizedSearch) ||
        request.receiptIssueReason?.toLowerCase().includes(normalizedSearch);
    const waitingRequests = requests.filter(
        (request) =>
            request.status === "approved" &&
            !hasUnresolvedIssue(request) &&
            matchesSearch(request) &&
            matchesDateFilter(
                request.approvedAt ?? request.createdAt,
                dateFilter,
                pickedDate
            )
    );
    const receivedRequests = requests.filter(
        (request) =>
            request.status === "received" &&
            matchesSearch(request) &&
            matchesDateFilter(
                request.receivedAt ?? request.createdAt,
                dateFilter,
                pickedDate
            )
    );
    const issueRequests = requests.filter(
        (request) =>
            hasUnresolvedIssue(request) &&
            matchesSearch(request) &&
            matchesDateFilter(
                request.receiptIssueReportedAt ?? request.createdAt,
                dateFilter,
                pickedDate
            )
    );

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
                    <RequestListFilters
                        tabs={[
                            { value: "awaiting", label: "To Receive" },
                            { value: "issues", label: "Issues" },
                            { value: "received", label: "Received" },
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
                        searchPlaceholder="Search by request number, item, or person"
                    />
                )}

                {!errorMessage && (
                    <>
                        {(activeTab === "awaiting" || activeTab === "all") && (
                        <section
                            id="awaiting-receipt"
                            className="mt-8 scroll-mt-6"
                            aria-labelledby="waiting-heading"
                        >
                            <h2 id="waiting-heading" className="text-xl font-semibold">
                                To Receive
                            </h2>

                            {waitingRequests.length === 0 ? (
                                <div className="surface-card mt-4 p-8 text-center">
                                    <h3 className="text-lg font-semibold">
                                        No purchases to receive
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
                                                        {formatDate(request.createdAt)}
                                                    </p>
                                                    <p className="mt-3 text-sm font-medium">
                                                        {request.itemSummary || "No items"}
                                                    </p>
                                                    <p className="text-muted mt-2 text-sm">
                                                        {request.itemCount}{" "}
                                                        {request.itemCount === 1
                                                            ? "item total"
                                                            : "items total"}
                                                    </p>
                                                </div>

                                                <span className="inline-flex self-start rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm font-medium text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
                                                    To Receive
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
                        )}

                        {(activeTab === "issues" || activeTab === "all") && (
                        <section
                            id="receipt-issues"
                            className="mt-12 scroll-mt-6"
                            aria-labelledby="issues-heading"
                        >
                            <h2 id="issues-heading" className="text-xl font-semibold">
                                Issues
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
                                                        The counted quantities did not match the approved request.
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
                        )}

                        {(activeTab === "received" || activeTab === "all") && (
                        <section
                            id="recently-received"
                            className="mt-12 scroll-mt-6"
                            aria-labelledby="received-heading"
                        >
                            <h2 id="received-heading" className="text-xl font-semibold">
                                Received
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
                        )}
                    </>
                )}
            </div>
        </main>
    );
}
