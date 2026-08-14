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
import {
    formatQuantity,
    hasPurchaseConversion,
    stockEquivalent,
} from "@/lib/units";

type ProcurementRequest = {
    id: number;
    status: string;
    createdAt: string;
    reviewedAt: string | null;
    receivedAt: string | null;
    rejectionReason: string | null;
    ownerRejectionReason: string | null;
    lines: RequestLine[];
};

type RequestLine = {
    id: number;
    itemId: number;
    itemName: string;
    quantity: number;
    unit: string;
    purchaseUnit: string;
    unitsPerPurchaseUnit: number;
    unitPrice: number;
};

type RequestRow = {
    id: number;
    status: string;
    created_at: string;
    accountant_approved_at: string | null;
    owner_reviewed_at: string | null;
    storekeeper_verified_at: string | null;
    rejection_reason: string | null;
    owner_rejection_reason: string | null;
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
    purchase_unit: string;
    units_per_purchase_unit: number | string;
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
    receipt_issue: {
        label: "Receipt Issue",
        className:
            "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
    },
    escalated_owner: {
        label: "Escalated to Owner",
        className:
            "border-purple-200 bg-purple-50 text-purple-800 dark:border-purple-900 dark:bg-purple-950 dark:text-purple-300",
    },
    cancelled: {
        label: "Voided",
        className:
            "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300",
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
    const [availableItems, setAvailableItems] = useState<ItemRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState("");
    const [editingRequest, setEditingRequest] =
        useState<ProcurementRequest | null>(null);
    const [editLines, setEditLines] = useState<RequestLine[]>([]);
    const [savingRequest, setSavingRequest] = useState(false);
    const [escalatingRequestId, setEscalatingRequestId] = useState<number | null>(
        null
    );
    const [activeTab, setActiveTab] = useState("active");
    const [dateFilter, setDateFilter] = useState<DateFilterValue>("any");
    const [pickedDate, setPickedDate] = useState("");
    const [searchQuery, setSearchQuery] = useState("");

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

            const requestedTab = new URLSearchParams(
                window.location.search
            ).get("tab");

            if (
                ["active", "rejected", "completed", "all"].includes(
                    requestedTab ?? ""
                )
            ) {
                setActiveTab(requestedTab!);
            }

            const { data: requestData, error: requestsError } =
                await supabase
                    .from("purchase_requests")
                    .select(
                        "id, status, created_at, accountant_approved_at, owner_reviewed_at, storekeeper_verified_at, rejection_reason, owner_rejection_reason"
                    )
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
                .from("purchase_requests_items")
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
            let itemRows: ItemRow[] = [];

            const { data: itemData, error: itemsError } = await supabase
                .from("items")
                .select("id, name, unit, purchase_unit, units_per_purchase_unit")
                .order("name");

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

            const itemsById = new Map(
                itemRows.map((item) => [item.id, item])
            );

            const formattedRequests = requestRows.map((request) => ({
                id: request.id,
                status: request.status,
                createdAt: request.created_at,
                reviewedAt:
                    request.owner_reviewed_at ??
                    request.accountant_approved_at,
                receivedAt: request.storekeeper_verified_at,
                rejectionReason: request.rejection_reason,
                ownerRejectionReason: request.owner_rejection_reason,
                lines: lineRows
                    .filter((line) => line.request_id === request.id)
                    .map((line) => {
                        const item = itemsById.get(line.item_id);

                        return {
                            id: line.id,
                            itemId: line.item_id,
                            itemName: item?.name ?? "Unknown item",
                            quantity: Number(line.quantity),
                            unit: item?.unit ?? "",
                            purchaseUnit: item?.purchase_unit ?? item?.unit ?? "",
                            unitsPerPurchaseUnit: Number(
                                item?.units_per_purchase_unit ?? 1
                            ),
                            unitPrice: Number(line.unit_price),
                        };
                    }),
            }));

            if (!ignore) {
                setAvailableItems(itemRows);
                setRequests(formattedRequests);
                setLoading(false);
            }
        }

        loadRequests();

        return () => {
            ignore = true;
        };
    }, [router]);

    function openEditRequest(request: ProcurementRequest) {
        setEditingRequest(request);
        setEditLines(request.lines.map((line) => ({ ...line })));
        setErrorMessage("");
    }

    function updateEditLine(
        lineId: number,
        field: "quantity" | "unitPrice",
        value: string
    ) {
        const numericValue = Number(value);

        setEditLines((lines) =>
            lines.map((line) =>
                line.id === lineId
                    ? {
                          ...line,
                          [field]: Number.isNaN(numericValue)
                              ? 0
                              : numericValue,
                      }
                    : line
            )
        );
    }

    function updateEditItem(lineId: number, itemId: number) {
        const item = availableItems.find(
            (availableItem) => availableItem.id === itemId
        );

        if (!item) {
            return;
        }

        setEditLines((lines) =>
            lines.map((line) =>
                line.id === lineId
                    ? {
                          ...line,
                          itemId: item.id,
                          itemName: item.name,
                          unit: item.unit,
                          purchaseUnit: item.purchase_unit,
                          unitsPerPurchaseUnit: Number(
                              item.units_per_purchase_unit
                          ),
                      }
                    : line
            )
        );
    }

    async function saveModifiedRequest() {
        if (!editingRequest || savingRequest) {
            return;
        }

        if (
            editLines.length === 0 ||
            editLines.some(
                (line) => line.quantity <= 0 || line.unitPrice < 0
            )
        ) {
            setErrorMessage(
                "Every item needs a quantity above zero and a valid unit price."
            );
            return;
        }

        const selectedItemIds = editLines.map((line) => line.itemId);

        if (new Set(selectedItemIds).size !== selectedItemIds.length) {
            setErrorMessage(
                "Each inventory item can only appear once in a purchase request."
            );
            return;
        }

        setSavingRequest(true);
        setErrorMessage("");

        const { error } = await supabase.rpc("resubmit_purchase_request", {
            target_request_id: editingRequest.id,
            updated_items: editLines.map((line) => ({
                request_item_id: line.id,
                item_id: line.itemId,
                quantity: line.quantity,
                unit_price: line.unitPrice,
            })),
        });

        if (error) {
            console.error("Error resubmitting purchase request:", error);
            setErrorMessage("Could not resubmit the modified request.");
            setSavingRequest(false);
            return;
        }

        setRequests((currentRequests) =>
            currentRequests.map((request) =>
                request.id === editingRequest.id
                    ? {
                          ...request,
                          status: "pending_accountant",
                          rejectionReason: null,
                          ownerRejectionReason: null,
                          lines: editLines,
                      }
                    : request
            )
        );
        setEditingRequest(null);
        setSavingRequest(false);
    }

    async function escalateToOwner(request: ProcurementRequest) {
        const confirmed = window.confirm(
            `Escalate Purchase Request #${request.id} to the Owner?\n\nThe Owner will be able to approve or reject the request.`
        );

        if (!confirmed) {
            return;
        }

        setEscalatingRequestId(request.id);
        setErrorMessage("");

        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
            router.replace("/login");
            return;
        }

        const { data: escalatedRequest, error } = await supabase
            .from("purchase_requests")
            .update({
                status: "escalated_owner",
                owner_escalated_by: user.id,
                owner_escalated_at: new Date().toISOString(),
                owner_reviewed_by: null,
                owner_reviewed_at: null,
                owner_decision: null,
                owner_rejection_reason: null,
            })
            .eq("id", request.id)
            .eq("status", "rejected")
            .select("id")
            .maybeSingle();

        if (error || !escalatedRequest) {
            console.error("Error escalating purchase request:", error);
            setErrorMessage("Could not escalate this request to the Owner.");
            setEscalatingRequestId(null);
            return;
        }

        setRequests((currentRequests) =>
            currentRequests.map((currentRequest) =>
                currentRequest.id === request.id
                    ? { ...currentRequest, status: "escalated_owner" }
                    : currentRequest
            )
        );
        setEscalatingRequestId(null);
    }

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

    const filteredRequests = requests.filter((request) => {
        const matchesTab =
            activeTab === "all" ||
            (activeTab === "active" &&
                [
                    "pending_accountant",
                    "approved",
                    "receipt_issue",
                    "escalated_owner",
                ].includes(request.status)) ||
            (activeTab === "rejected" && request.status === "rejected") ||
            (activeTab === "completed" && request.status === "received");
        const eventDate =
            activeTab === "completed"
                ? request.receivedAt ?? request.createdAt
                : activeTab === "rejected"
                  ? request.reviewedAt ?? request.createdAt
                  : request.createdAt;

        const normalizedSearch = searchQuery.trim().toLowerCase();
        const matchesSearch =
            !normalizedSearch ||
            String(request.id).includes(normalizedSearch.replace(/^#/, "")) ||
            request.lines.some((line) =>
                line.itemName.toLowerCase().includes(normalizedSearch)
            ) ||
            request.rejectionReason?.toLowerCase().includes(normalizedSearch) ||
            request.ownerRejectionReason
                ?.toLowerCase()
                .includes(normalizedSearch);

        return (
            matchesTab &&
            matchesSearch &&
            matchesDateFilter(eventDate, dateFilter, pickedDate)
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

                {!errorMessage && (
                    <RequestListFilters
                        tabs={[
                            { value: "active", label: "Active" },
                            { value: "rejected", label: "Rejected" },
                            { value: "completed", label: "Completed" },
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
                        searchPlaceholder="Search by request number, item, or rejection reason"
                    />
                )}

                {!errorMessage && filteredRequests.length === 0 && (
                    <div className="surface-card mt-8 p-8 text-center">
                        <h2 className="text-xl font-semibold">
                            No matching purchase requests
                        </h2>

                        <p className="text-muted mt-2">
                            Try another status or date filter.
                        </p>
                    </div>
                )}

                {!errorMessage && filteredRequests.length > 0 && (
                    <div className="mt-8 grid gap-6 lg:grid-cols-2">
                        {filteredRequests.map((request) => {
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
                                                            {formatQuantity(
                                                                line.quantity,
                                                                line.purchaseUnit
                                                            )} ×{" "}
                                                            {currencyFormatter.format(
                                                                line.unitPrice
                                                            )}
                                                        </p>
                                                        {hasPurchaseConversion(
                                                            line.unit,
                                                            line.purchaseUnit,
                                                            line.unitsPerPurchaseUnit
                                                        ) && (
                                                            <p className="text-muted mt-1 text-xs">
                                                                Equivalent stock: {formatQuantity(
                                                                    stockEquivalent(
                                                                        line.quantity,
                                                                        line.unitsPerPurchaseUnit
                                                                    ),
                                                                    line.unit
                                                                )}
                                                            </p>
                                                        )}
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
                                        (request.ownerRejectionReason ||
                                            request.rejectionReason) && (
                                            <div className="border-t border-[var(--danger-border)] bg-[var(--danger-soft)] px-6 py-5">
                                                <p className="text-sm font-semibold text-[var(--danger)]">
                                                    Reason for rejection
                                                </p>
                                                <p className="mt-2 whitespace-pre-wrap text-sm">
                                                    {request.ownerRejectionReason ??
                                                        request.rejectionReason}
                                                </p>
                                            </div>
                                        )}

                                    {request.status === "rejected" && (
                                        <div className="grid gap-3 border-t border-[var(--border)] p-5 sm:grid-cols-2">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    openEditRequest(request)
                                                }
                                                className="secondary-action"
                                            >
                                                Modify and Resubmit
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    escalateToOwner(request)
                                                }
                                                disabled={
                                                    escalatingRequestId ===
                                                    request.id
                                                }
                                                className="primary-action"
                                            >
                                                {escalatingRequestId === request.id
                                                    ? "Escalating..."
                                                    : "Escalate to Owner"}
                                            </button>
                                        </div>
                                    )}
                                </article>
                            );
                        })}
                    </div>
                )}
            </div>

            {editingRequest && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
                    role="presentation"
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="modify-request-title"
                        className="surface-card max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6 sm:p-7"
                    >
                        <h2
                            id="modify-request-title"
                            className="text-xl font-semibold"
                        >
                            Modify Purchase Request #{editingRequest.id}
                        </h2>
                        <p className="text-muted mt-2 text-sm">
                            Update the quantities or prices, then send the request
                            back to the Accountant.
                        </p>

                        <div className="mt-6 space-y-4">
                            {editLines.map((line) => (
                                <div
                                    key={line.id}
                                    className="rounded-xl border border-[var(--border)] p-4"
                                >
                                    <label
                                        htmlFor={`item-${line.id}`}
                                        className="form-label"
                                    >
                                        Item
                                    </label>
                                    <select
                                        id={`item-${line.id}`}
                                        value={line.itemId}
                                        onChange={(event) =>
                                            updateEditItem(
                                                line.id,
                                                Number(event.target.value)
                                            )
                                        }
                                        className="form-control"
                                    >
                                        {availableItems.map((item) => (
                                            <option key={item.id} value={item.id}>
                                                {item.name} ({item.purchase_unit})
                                            </option>
                                        ))}
                                    </select>
                                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                                        <div>
                                            <label
                                                htmlFor={`quantity-${line.id}`}
                                                className="form-label"
                                            >
                                                Quantity ({line.purchaseUnit})
                                            </label>
                                            <input
                                                id={`quantity-${line.id}`}
                                                type="number"
                                                min="0.01"
                                                step="any"
                                                value={line.quantity}
                                                onChange={(event) =>
                                                    updateEditLine(
                                                        line.id,
                                                        "quantity",
                                                        event.target.value
                                                    )
                                                }
                                                className="form-control"
                                            />
                                        </div>
                                        <div>
                                            <label
                                                htmlFor={`price-${line.id}`}
                                                className="form-label"
                                            >
                                                Price per {line.purchaseUnit}
                                            </label>
                                            <input
                                                id={`price-${line.id}`}
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={line.unitPrice}
                                                onChange={(event) =>
                                                    updateEditLine(
                                                        line.id,
                                                        "unitPrice",
                                                        event.target.value
                                                    )
                                                }
                                                className="form-control"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-6 grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setEditingRequest(null)}
                                disabled={savingRequest}
                                className="secondary-action"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={saveModifiedRequest}
                                disabled={savingRequest}
                                className="primary-action"
                            >
                                {savingRequest
                                    ? "Resubmitting..."
                                    : "Save and Resubmit"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
