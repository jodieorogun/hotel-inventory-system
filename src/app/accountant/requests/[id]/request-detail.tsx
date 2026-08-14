"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/app-header";
import RequestHistory, {
    type RequestHistoryEntry,
} from "@/components/request-history";
import { loadRequestHistory } from "@/lib/request-history";
import { supabase } from "@/lib/supabase";
import {
    formatQuantity,
    hasPurchaseConversion,
    stockEquivalent,
} from "@/lib/units";

type RequestStatus = "approved" | "rejected";

type PurchaseRequest = {
    id: number;
    status: string;
    createdAt: string;
    requestedBy: string;
    reviewedAt: string | null;
    reviewedBy: string | null;
    receivedAt: string | null;
    receivedBy: string | null;
    rejectionReason: string | null;
    receiptIssueReason: string | null;
    receiptIssueReportedAt: string | null;
    receiptIssueReportedBy: string | null;
    receiptIssueResolvedAt: string | null;
    receiptIssueResolvedBy: string | null;
    ownerEscalatedAt: string | null;
    ownerEscalatedBy: string | null;
    ownerReviewedAt: string | null;
    ownerReviewedBy: string | null;
    ownerDecision: string | null;
    ownerRejectionReason: string | null;
    voidedAt: string | null;
    voidedBy: string | null;
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
    requested_by: string;
    accountant_approved_by: string | null;
    accountant_approved_at: string | null;
    storekeeper_verified_by: string | null;
    storekeeper_verified_at: string | null;
    rejection_reason: string | null;
    receipt_issue_reason: string | null;
    receipt_issue_reported_by: string | null;
    receipt_issue_reported_at: string | null;
    receipt_issue_resolved_by: string | null;
    receipt_issue_resolved_at: string | null;
    owner_escalated_by: string | null;
    owner_escalated_at: string | null;
    owner_reviewed_by: string | null;
    owner_reviewed_at: string | null;
    owner_decision: string | null;
    owner_rejection_reason: string | null;
    voided_by: string | null;
    voided_at: string | null;
};

type RequestLineRow = {
    id: number;
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
    pending_accountant: {
        label: "Pending Accountant Approval",
        className:
            "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
    },
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
    received: {
        label: "Received",
        className:
            "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300",
    },
};

function formatDateTime(value: string) {
    return new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(value));
}

function formatStatus(status: string) {
    return statusDetails[status] ?? {
        label: status.replaceAll("_", " "),
        className:
            "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300",
    };
}

export default function RequestDetail({
    requestId,
    verifiedViewerRole,
}: {
    requestId: string;
    verifiedViewerRole?: "owner";
}) {
    const router = useRouter();
    const [request, setRequest] = useState<PurchaseRequest | null>(null);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState<RequestStatus | null>(null);
    const [errorMessage, setErrorMessage] = useState("");
    const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
    const [rejectionReason, setRejectionReason] = useState("");
    const [rejectionError, setRejectionError] = useState("");
    const [viewerRole, setViewerRole] = useState("");
    const [availableItems, setAvailableItems] = useState<ItemRow[]>([]);
    const [ownerEditOpen, setOwnerEditOpen] = useState(false);
    const [ownerEditLines, setOwnerEditLines] = useState<RequestLine[]>([]);
    const [ownerAction, setOwnerAction] = useState<
        "approve" | "resubmit" | "void" | null
    >(null);
    const [historyEntries, setHistoryEntries] = useState<
        RequestHistoryEntry[]
    >([]);

    useEffect(() => {
        let ignore = false;

        async function loadRequest() {
            if (!/^\d+$/.test(requestId)) {
                setErrorMessage("This purchase request could not be found.");
                setLoading(false);
                return;
            }

            if (verifiedViewerRole) {
                setViewerRole(verifiedViewerRole);
            } else {
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

                if (!["accountant", "owner"].includes(profile.role)) {
                    router.replace("/dashboard");
                    return;
                }

                if (!ignore) {
                    setViewerRole(profile.role);
                }
            }

            const { data: requestData, error: requestError } = await supabase
                .from("purchase_requests")
                .select(
                    "id, status, created_at, requested_by, accountant_approved_by, accountant_approved_at, storekeeper_verified_by, storekeeper_verified_at, rejection_reason, receipt_issue_reason, receipt_issue_reported_by, receipt_issue_reported_at, receipt_issue_resolved_by, receipt_issue_resolved_at, owner_escalated_by, owner_escalated_at, owner_reviewed_by, owner_reviewed_at, owner_decision, owner_rejection_reason, voided_by, voided_at"
                )
                .eq("id", Number(requestId))
                .maybeSingle();

            if (requestError) {
                console.error("Error loading purchase request:", requestError);

                if (!ignore) {
                    setErrorMessage("Could not load this purchase request.");
                    setLoading(false);
                }

                return;
            }

            if (!requestData) {
                if (!ignore) {
                    setErrorMessage("This purchase request could not be found.");
                    setLoading(false);
                }

                return;
            }

            const requestRow = requestData as RequestRow;
            const userIds = [
                requestRow.requested_by,
                requestRow.accountant_approved_by,
                requestRow.storekeeper_verified_by,
                requestRow.receipt_issue_reported_by,
                requestRow.receipt_issue_resolved_by,
                requestRow.owner_escalated_by,
                requestRow.owner_reviewed_by,
                requestRow.voided_by,
            ].filter((id): id is string => Boolean(id));
            const [linesResult, usersResult] = await Promise.all([
                supabase
                    .from("purchase_requests_items")
                    .select("id, item_id, quantity, unit_price")
                    .eq("request_id", requestRow.id)
                    .order("id", { ascending: true }),
                supabase
                    .from("users")
                    .select("id, name")
                    .in("id", userIds),
            ]);

            if (linesResult.error || usersResult.error) {
                console.error(
                    "Error loading purchase request details:",
                    linesResult.error ?? usersResult.error
                );

                if (!ignore) {
                    setErrorMessage("Could not load the purchase request details.");
                    setLoading(false);
                }

                return;
            }

            const lineRows = (linesResult.data ?? []) as RequestLineRow[];
            let itemRows: ItemRow[] = [];

            const { data: itemData, error: itemsError } = await supabase
                .from("items")
                .select("id, name, unit, purchase_unit, units_per_purchase_unit")
                .order("name");

            if (itemsError) {
                console.error("Error loading requested items:", itemsError);

                if (!ignore) {
                    setErrorMessage("Could not load the requested items.");
                    setLoading(false);
                }

                return;
            }

            itemRows = (itemData ?? []) as ItemRow[];

            const itemsById = new Map(itemRows.map((item) => [item.id, item]));
            const usersById = new Map(
                ((usersResult.data ?? []) as UserRow[]).map((profileRow) => [
                    profileRow.id,
                    profileRow.name,
                ])
            );
            const formattedRequest: PurchaseRequest = {
                id: requestRow.id,
                status: requestRow.status,
                createdAt: requestRow.created_at,
                requestedBy:
                    usersById.get(requestRow.requested_by) ?? "Procurement user",
                reviewedAt: requestRow.accountant_approved_at,
                reviewedBy: requestRow.accountant_approved_by
                    ? (usersById.get(requestRow.accountant_approved_by) ??
                      "Accountant")
                    : null,
                receivedAt: requestRow.storekeeper_verified_at,
                receivedBy: requestRow.storekeeper_verified_by
                    ? (usersById.get(requestRow.storekeeper_verified_by) ??
                      "Storekeeper")
                    : null,
                rejectionReason: requestRow.rejection_reason,
                receiptIssueReason: requestRow.receipt_issue_reason,
                receiptIssueReportedAt: requestRow.receipt_issue_reported_at,
                receiptIssueReportedBy: requestRow.receipt_issue_reported_by
                    ? (usersById.get(requestRow.receipt_issue_reported_by) ??
                      "Storekeeper")
                    : null,
                receiptIssueResolvedAt: requestRow.receipt_issue_resolved_at,
                receiptIssueResolvedBy: requestRow.receipt_issue_resolved_by
                    ? (usersById.get(requestRow.receipt_issue_resolved_by) ??
                      "Owner")
                    : null,
                ownerEscalatedAt: requestRow.owner_escalated_at,
                ownerEscalatedBy: requestRow.owner_escalated_by
                    ? (usersById.get(requestRow.owner_escalated_by) ??
                      "Procurement user")
                    : null,
                ownerReviewedAt: requestRow.owner_reviewed_at,
                ownerReviewedBy: requestRow.owner_reviewed_by
                    ? (usersById.get(requestRow.owner_reviewed_by) ?? "Owner")
                    : null,
                ownerDecision: requestRow.owner_decision,
                ownerRejectionReason: requestRow.owner_rejection_reason,
                voidedAt: requestRow.voided_at,
                voidedBy: requestRow.voided_by
                    ? (usersById.get(requestRow.voided_by) ?? "Owner")
                    : null,
                lines: lineRows.map((line) => {
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
            };
            const durableHistory = await loadRequestHistory(requestRow.id);

            if (!ignore) {
                setAvailableItems(itemRows);
                setRequest(formattedRequest);
                setHistoryEntries(durableHistory);
                setLoading(false);
            }
        }

        loadRequest();

        return () => {
            ignore = true;
        };
    }, [requestId, router, verifiedViewerRole]);

    async function updateRequestStatus(
        status: RequestStatus,
        reason?: string
    ) {
        const ownerReview =
            viewerRole === "owner" && request?.status === "escalated_owner";

        if (
            !request ||
            (request.status !== "pending_accountant" && !ownerReview)
        ) {
            return;
        }

        if (status === "approved") {
            const total = request.lines.reduce(
                (sum, line) => sum + line.quantity * line.unitPrice,
                0
            );
            const confirmed = window.confirm(
                `Approve Purchase Request #${request.id}?\n\nTotal: ${currencyFormatter.format(total)}`
            );

            if (!confirmed) {
                return;
            }
        }

        setUpdating(status);
        setErrorMessage("");

        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
            setUpdating(null);
            router.replace("/login");
            return;
        }

        const auditFields = ownerReview
            ? {
                  owner_reviewed_by: user.id,
                  owner_reviewed_at: new Date().toISOString(),
                  owner_decision: status,
              }
            : {
                  accountant_approved_by: user.id,
                  accountant_approved_at: new Date().toISOString(),
                  accountant_decision: status,
              };
        const currentStatus = request.status;
        const { data, error } = await supabase
            .from("purchase_requests")
            .update({
                status,
                ...auditFields,
                storekeeper_verified_by: null,
                storekeeper_verified_at: null,
                rejection_reason: ownerReview
                    ? request.rejectionReason
                    : status === "rejected"
                      ? reason?.trim()
                      : null,
                owner_rejection_reason:
                    ownerReview && status === "rejected"
                        ? reason?.trim()
                        : null,
            })
            .eq("id", request.id)
            .eq("status", currentStatus)
            .select("id")
            .maybeSingle();

        if (error || !data) {
            console.error("Error updating purchase request:", error);
            const message = error
                ? `Could not ${status === "approved" ? "approve" : "reject"} the request. Please try again.`
                : "This request has already been reviewed.";

            if (status === "rejected") {
                setRejectionError(message);
            } else {
                setErrorMessage(message);
            }

            setUpdating(null);
            return;
        }

        router.push(
            viewerRole === "owner"
                ? "/owner/needs-attention"
                : "/accountant/requests"
        );
        router.refresh();
    }

    function openOwnerEdit() {
        if (!request) {
            return;
        }

        setOwnerEditLines(request.lines.map((line) => ({ ...line })));
        setOwnerEditOpen(true);
        setErrorMessage("");
    }

    function updateOwnerEditLine(
        lineId: number,
        field: "itemId" | "quantity" | "unitPrice",
        value: number
    ) {
        setOwnerEditLines((lines) =>
            lines.map((line) => {
                if (line.id !== lineId) {
                    return line;
                }

                if (field === "itemId") {
                    const item = availableItems.find(
                        (availableItem) => availableItem.id === value
                    );

                    return item
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
                        : line;
                }

                return { ...line, [field]: value };
            })
        );
    }

    async function resubmitAsOwner() {
        if (
            !request ||
            request.status !== "rejected" ||
            viewerRole !== "owner" ||
            ownerAction
        ) {
            return;
        }

        if (
            ownerEditLines.length === 0 ||
            ownerEditLines.some(
                (line) => line.quantity <= 0 || line.unitPrice < 0
            )
        ) {
            setErrorMessage(
                "Every item needs a quantity above zero and a valid unit price."
            );
            return;
        }

        const selectedItemIds = ownerEditLines.map((line) => line.itemId);

        if (new Set(selectedItemIds).size !== selectedItemIds.length) {
            setErrorMessage(
                "Each inventory item can only appear once in a purchase request."
            );
            return;
        }

        setOwnerAction("resubmit");
        setErrorMessage("");

        const { error } = await supabase.rpc("owner_resubmit_rejected_request", {
            target_request_id: request.id,
            updated_items: ownerEditLines.map((line) => ({
                request_item_id: line.id,
                item_id: line.itemId,
                quantity: line.quantity,
                unit_price: line.unitPrice,
            })),
        });

        if (error) {
            console.error("Error resubmitting rejected request as Owner:", error);
            setErrorMessage("Could not modify and resubmit this request.");
            setOwnerAction(null);
            return;
        }

        router.push("/owner/awaiting-accountant");
        router.refresh();
    }

    async function decideRejectedRequestAsOwner(
        action: "approve" | "void"
    ) {
        if (
            !request ||
            request.status !== "rejected" ||
            viewerRole !== "owner" ||
            ownerAction
        ) {
            return;
        }

        const confirmed = window.confirm(
            action === "approve"
                ? `Approve rejected Purchase Request #${request.id} as the Owner?\n\nIt will move to Awaiting Receipt.`
                : `Void rejected Purchase Request #${request.id}?\n\nNo stock will be added and this cannot be undone.`
        );

        if (!confirmed) {
            return;
        }

        setOwnerAction(action);
        setErrorMessage("");

        const { error } = await supabase.rpc(
            action === "approve"
                ? "owner_approve_rejected_request"
                : "owner_void_rejected_request",
            { target_request_id: request.id }
        );

        if (error) {
            console.error(`Error performing Owner ${action}:`, error);
            setErrorMessage(`Could not ${action} this rejected request.`);
            setOwnerAction(null);
            return;
        }

        router.push(
            action === "approve"
                ? "/owner/awaiting-receipt"
                : "/owner/needs-attention"
        );
        router.refresh();
    }

    function openRejectDialog() {
        setRejectionReason("");
        setRejectionError("");
        setRejectDialogOpen(true);
    }

    async function confirmRejection(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (!rejectionReason.trim()) {
            setRejectionError("Please enter a reason for rejecting this request.");
            return;
        }

        await updateRequestStatus("rejected", rejectionReason);
    }

    if (loading) {
        return (
            <main className="app-page">
                <div className="mx-auto max-w-7xl">
                    <AppHeader />
                    <p className="text-muted">Loading purchase request...</p>
                </div>
            </main>
        );
    }

    if (!request) {
        return (
            <main className="app-page">
                <div className="mx-auto max-w-7xl">
                    <AppHeader />
                    <div className="error-message" role="alert">
                        {errorMessage}
                    </div>
                    <Link
                        href="/accountant/requests"
                        className="secondary-action mt-6"
                    >
                        Back to Purchase Approvals
                    </Link>
                </div>
            </main>
        );
    }

    const status = formatStatus(request.status);
    const total = request.lines.reduce(
        (sum, line) => sum + line.quantity * line.unitPrice,
        0
    );
    const isPending =
        request.status === "pending_accountant" ||
        (viewerRole === "owner" && request.status === "escalated_owner");
    const isOwnerRejected =
        viewerRole === "owner" && request.status === "rejected";

    return (
        <main className="app-page">
            <div className="mx-auto max-w-7xl">
                <AppHeader />

                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h1 className="page-title">
                            Purchase Request #{request.id}
                        </h1>
                        <p className="page-description mt-2">
                            Requested by: {request.requestedBy}
                        </p>
                        <p className="text-muted mt-1 text-sm">
                            Submitted: {formatDateTime(request.createdAt)}
                        </p>
                    </div>

                    <span
                        className={`inline-flex self-start rounded-full border px-3 py-1 text-sm font-medium ${status.className}`}
                    >
                        {status.label}
                    </span>
                </div>

                {errorMessage && (
                    <div className="error-message mt-8" role="alert">
                        {errorMessage}
                    </div>
                )}

                {request.status === "rejected" &&
                    (request.ownerRejectionReason || request.rejectionReason) && (
                    <div className="mt-8 rounded-xl border border-[var(--danger-border)] bg-[var(--danger-soft)] p-5">
                        <h2 className="font-semibold text-[var(--danger)]">
                            Reason for rejection
                        </h2>
                        <p className="mt-2 whitespace-pre-wrap text-[var(--foreground)]">
                            {request.ownerRejectionReason ??
                                request.rejectionReason}
                        </p>
                    </div>
                )}

                <RequestHistory
                    entries={historyEntries.length > 0 ? historyEntries : [
                        {
                            action: "Requested",
                            person: request.requestedBy,
                            timestamp: request.createdAt,
                        },
                        ...(request.reviewedAt && request.reviewedBy
                            ? [
                                  {
                                      action:
                                          Boolean(request.rejectionReason)
                                              ? "Rejected"
                                              : "Approved",
                                      person: request.reviewedBy,
                                      timestamp: request.reviewedAt,
                                      detail:
                                          request.rejectionReason
                                              ? request.rejectionReason
                                              : null,
                                  },
                              ]
                            : []),
                        ...(request.ownerEscalatedAt &&
                        request.ownerEscalatedBy
                            ? [
                                  {
                                      action: "Escalated to Owner",
                                      person: request.ownerEscalatedBy,
                                      timestamp: request.ownerEscalatedAt,
                                  },
                              ]
                            : []),
                        ...(request.ownerReviewedAt && request.ownerReviewedBy
                            ? [
                                  {
                                      action:
                                          request.ownerDecision === "approved"
                                              ? "Approved"
                                              : request.ownerDecision ===
                                                  "resubmitted"
                                                ? "Modified and resubmitted"
                                              : "Rejected",
                                      person: request.ownerReviewedBy,
                                      timestamp: request.ownerReviewedAt,
                                      detail:
                                          request.ownerDecision === "rejected"
                                              ? request.ownerRejectionReason
                                              : null,
                                  },
                              ]
                            : []),
                        ...(request.receiptIssueReportedAt &&
                        request.receiptIssueReportedBy
                            ? [
                                  {
                                      action: "Receipt issue reported",
                                      person: request.receiptIssueReportedBy,
                                      timestamp:
                                          request.receiptIssueReportedAt,
                                      detail: request.receiptIssueReason,
                                  },
                              ]
                            : []),
                        ...(request.receiptIssueResolvedAt &&
                        request.receiptIssueResolvedBy
                            ? [
                                  {
                                      action: "Receipt issue resolved",
                                      person: request.receiptIssueResolvedBy,
                                      timestamp:
                                          request.receiptIssueResolvedAt,
                                  },
                              ]
                            : []),
                        ...(request.receivedAt && request.receivedBy
                            ? [
                                  {
                                      action: "Received",
                                      person: request.receivedBy,
                                      timestamp: request.receivedAt,
                                  },
                              ]
                            : []),
                        ...(request.voidedAt && request.voidedBy
                            ? [
                                  {
                                      action: "Voided",
                                      person: request.voidedBy,
                                      timestamp: request.voidedAt,
                                  },
                              ]
                            : []),
                    ]}
                />

                <div className="surface-card mt-8 overflow-hidden">
                    <div className="hidden grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-6 border-b border-[var(--border)] px-6 py-4 text-sm font-semibold text-[var(--muted-strong)] sm:grid">
                        <span>Item</span>
                        <span className="w-28">Quantity</span>
                        <span className="w-36 text-right">Unit Price</span>
                        <span className="w-36 text-right">Total</span>
                    </div>

                    {request.lines.length === 0 ? (
                        <p className="text-muted px-6 py-6">
                            No items were found for this request.
                        </p>
                    ) : (
                        request.lines.map((line) => (
                            <div
                                key={line.id}
                                className="grid gap-3 border-b border-[var(--border)] px-6 py-5 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-center sm:gap-6"
                            >
                                <div>
                                    <p className="font-medium">{line.itemName}</p>
                                    <p className="text-muted mt-1 text-sm sm:hidden">
                                        {formatQuantity(
                                            line.quantity,
                                            line.purchaseUnit
                                        )} ×{" "}
                                        {currencyFormatter.format(line.unitPrice)}
                                    </p>
                                    {hasPurchaseConversion(
                                        line.unit,
                                        line.purchaseUnit,
                                        line.unitsPerPurchaseUnit
                                    ) && (
                                        <p className="text-muted mt-1 text-xs sm:hidden">
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
                                <p className="hidden w-28 sm:block">
                                    {formatQuantity(
                                        line.quantity,
                                        line.purchaseUnit
                                    )}
                                    {hasPurchaseConversion(
                                        line.unit,
                                        line.purchaseUnit,
                                        line.unitsPerPurchaseUnit
                                    ) && (
                                        <span className="text-muted mt-1 block text-xs">
                                            {formatQuantity(
                                                stockEquivalent(
                                                    line.quantity,
                                                    line.unitsPerPurchaseUnit
                                                ),
                                                line.unit
                                            )} stock
                                        </span>
                                    )}
                                </p>
                                <p className="hidden w-36 text-right sm:block">
                                    {currencyFormatter.format(line.unitPrice)}
                                </p>
                                <p className="font-semibold sm:w-36 sm:text-right">
                                    {currencyFormatter.format(
                                        line.quantity * line.unitPrice
                                    )}
                                </p>
                            </div>
                        ))
                    )}

                    <div className="flex items-center justify-between gap-6 border-t border-[var(--border)] bg-[var(--surface-subtle)] px-6 py-5">
                        <span className="font-semibold">Total</span>
                        <span className="text-xl font-semibold">
                            {currencyFormatter.format(total)}
                        </span>
                    </div>
                </div>

                {isPending ? (
                    <div className="mt-6 grid gap-3 sm:grid-cols-2">
                        <button
                            type="button"
                            onClick={openRejectDialog}
                            disabled={updating !== null}
                            className="secondary-action border-[var(--danger-border)] text-[var(--danger)] hover:border-[var(--danger)] hover:bg-[var(--danger-soft)] disabled:cursor-not-allowed disabled:opacity-55"
                        >
                            Reject Request
                        </button>
                        <button
                            type="button"
                            onClick={() => updateRequestStatus("approved")}
                            disabled={updating !== null}
                            className="primary-action"
                        >
                            {updating === "approved"
                                ? "Approving..."
                                : "Approve Request"}
                        </button>
                    </div>
                ) : isOwnerRejected ? (
                    <div className="surface-card mt-6 p-5">
                        <p className="font-semibold">Owner decision required</p>
                        <p className="text-muted mt-1 text-sm">
                            Modify and return this request to the Accountant,
                            approve it as an Owner override, or permanently void it.
                        </p>
                        <div className="mt-5 grid gap-3 sm:grid-cols-3">
                            <button
                                type="button"
                                onClick={openOwnerEdit}
                                disabled={ownerAction !== null}
                                className="secondary-action"
                            >
                                Modify and Resubmit
                            </button>
                            <button
                                type="button"
                                onClick={() =>
                                    decideRejectedRequestAsOwner("approve")
                                }
                                disabled={ownerAction !== null}
                                className="primary-action"
                            >
                                {ownerAction === "approve"
                                    ? "Approving..."
                                    : "Approve Request"}
                            </button>
                            <button
                                type="button"
                                onClick={() =>
                                    decideRejectedRequestAsOwner("void")
                                }
                                disabled={ownerAction !== null}
                                className="secondary-action border-[var(--danger-border)] text-[var(--danger)]"
                            >
                                {ownerAction === "void"
                                    ? "Voiding..."
                                    : "Void Request"}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="surface-card mt-6 p-5">
                        <p className="text-muted">
                            This request has already been {request.status} and
                            cannot be reviewed again.
                        </p>
                    </div>
                )}
            </div>

            {ownerEditOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
                    role="presentation"
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="owner-modify-title"
                        className="surface-card max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6 sm:p-7"
                    >
                        <h2
                            id="owner-modify-title"
                            className="text-xl font-semibold"
                        >
                            Modify Purchase Request #{request.id}
                        </h2>
                        <p className="text-muted mt-2 text-sm">
                            Update the rejected request and send it back to the
                            Accountant for another review.
                        </p>

                        <div className="mt-6 space-y-4">
                            {ownerEditLines.map((line) => (
                                <div
                                    key={line.id}
                                    className="rounded-xl border border-[var(--border)] p-4"
                                >
                                    <label
                                        htmlFor={`owner-item-${line.id}`}
                                        className="form-label"
                                    >
                                        Item
                                    </label>
                                    <select
                                        id={`owner-item-${line.id}`}
                                        value={line.itemId}
                                        onChange={(event) =>
                                            updateOwnerEditLine(
                                                line.id,
                                                "itemId",
                                                Number(event.target.value)
                                            )
                                        }
                                        disabled={ownerAction === "resubmit"}
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
                                                htmlFor={`owner-quantity-${line.id}`}
                                                className="form-label"
                                            >
                                                Quantity ({line.purchaseUnit})
                                            </label>
                                            <input
                                                id={`owner-quantity-${line.id}`}
                                                type="number"
                                                min="0.01"
                                                step="any"
                                                value={line.quantity}
                                                onChange={(event) =>
                                                    updateOwnerEditLine(
                                                        line.id,
                                                        "quantity",
                                                        Number(event.target.value)
                                                    )
                                                }
                                                disabled={
                                                    ownerAction === "resubmit"
                                                }
                                                className="form-control"
                                            />
                                        </div>
                                        <div>
                                            <label
                                                htmlFor={`owner-price-${line.id}`}
                                                className="form-label"
                                            >
                                                Price per {line.purchaseUnit}
                                            </label>
                                            <input
                                                id={`owner-price-${line.id}`}
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={line.unitPrice}
                                                onChange={(event) =>
                                                    updateOwnerEditLine(
                                                        line.id,
                                                        "unitPrice",
                                                        Number(event.target.value)
                                                    )
                                                }
                                                disabled={
                                                    ownerAction === "resubmit"
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
                                onClick={() => setOwnerEditOpen(false)}
                                disabled={ownerAction === "resubmit"}
                                className="secondary-action"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={resubmitAsOwner}
                                disabled={ownerAction === "resubmit"}
                                className="primary-action"
                            >
                                {ownerAction === "resubmit"
                                    ? "Resubmitting..."
                                    : "Save and Resubmit"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {rejectDialogOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
                    role="presentation"
                >
                    <form
                        onSubmit={confirmRejection}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="reject-dialog-title"
                        className="surface-card w-full max-w-lg p-6 sm:p-7"
                    >
                        <h2
                            id="reject-dialog-title"
                            className="text-xl font-semibold"
                        >
                            Reject Purchase Request #{request.id}?
                        </h2>
                        <p className="text-muted mt-2 text-sm">
                            Procurement will be able to see this reason.
                        </p>

                        <label
                            htmlFor="rejection-reason"
                            className="form-label mt-6"
                        >
                            Reason for rejection
                        </label>
                        <textarea
                            id="rejection-reason"
                            value={rejectionReason}
                            onChange={(event) => {
                                setRejectionReason(event.target.value);
                                setRejectionError("");
                            }}
                            rows={4}
                            maxLength={500}
                            autoFocus
                            disabled={updating === "rejected"}
                            placeholder="Explain why this request cannot be approved."
                            className="form-control resize-y"
                        />

                        {rejectionError && (
                            <p
                                className="mt-3 text-sm text-[var(--danger)]"
                                role="alert"
                            >
                                {rejectionError}
                            </p>
                        )}

                        <div className="mt-6 grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setRejectDialogOpen(false)}
                                disabled={updating === "rejected"}
                                className="secondary-action disabled:cursor-not-allowed disabled:opacity-55"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={updating === "rejected"}
                                className="primary-action bg-[var(--danger)] text-white hover:bg-[var(--danger)] disabled:cursor-not-allowed disabled:opacity-55"
                            >
                                {updating === "rejected"
                                    ? "Rejecting..."
                                    : "Confirm Rejection"}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </main>
    );
}
