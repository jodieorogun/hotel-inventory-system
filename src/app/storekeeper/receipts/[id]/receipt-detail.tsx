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
    receiptIssueResolvedBy: string | null;
    accountantReviewedAt: string | null;
    accountantReviewedBy: string | null;
    accountantRejectionReason: string | null;
    ownerEscalatedAt: string | null;
    ownerEscalatedBy: string | null;
    ownerReviewedAt: string | null;
    ownerReviewedBy: string | null;
    ownerDecision: string | null;
    receiptIssueResolution: string | null;
    lines: ReceiptLine[];
};

type ReceiptLine = {
    id: number;
    itemName: string;
    quantity: number;
    receivedQuantity: number | null;
    unit: string;
    purchaseUnit: string;
    unitsPerPurchaseUnit: number;
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
    receipt_issue_resolved_by: string | null;
    receipt_issue_resolved_at: string | null;
    rejection_reason: string | null;
    owner_escalated_by: string | null;
    owner_escalated_at: string | null;
    owner_reviewed_by: string | null;
    owner_reviewed_at: string | null;
    owner_decision: string | null;
    receipt_issue_resolution: string | null;
};

type RequestItemRow = {
    id: number;
    item_id: number;
    quantity: number | string;
    received_quantity: number | string | null;
    purchase_unit: string;
    units_per_purchase_unit: number | string;
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

function formatDateTime(value: string) {
    return new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(value));
}

export default function ReceiptDetail({
    requestId,
    verifiedViewerRole,
}: {
    requestId: string;
    verifiedViewerRole?: "owner";
}) {
    const router = useRouter();
    const [request, setRequest] = useState<ReceiptRequest | null>(null);
    const [loading, setLoading] = useState(true);
    const [confirming, setConfirming] = useState(false);
    const [receivedQuantities, setReceivedQuantities] = useState<
        Record<number, string>
    >({});
    const [viewerRole, setViewerRole] = useState("");
    const [ownerAction, setOwnerAction] = useState<
        "return" | "accept" | "void" | null
    >(null);
    const [errorMessage, setErrorMessage] = useState("");
    const [historyEntries, setHistoryEntries] = useState<
        RequestHistoryEntry[]
    >([]);

    useEffect(() => {
        let ignore = false;

        async function loadReceipt() {
            if (!/^\d+$/.test(requestId)) {
                setErrorMessage("This receipt request could not be found.");
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

                if (!ignore) {
                    setViewerRole(profile.role);
                }
            }

            const { data: requestData, error: requestError } = await supabase
                .from("purchase_requests")
                .select(
                    "id, status, created_at, requested_by, accountant_approved_by, accountant_approved_at, storekeeper_verified_by, storekeeper_verified_at, receipt_issue_reason, receipt_issue_reported_by, receipt_issue_reported_at, receipt_issue_resolved_by, receipt_issue_resolved_at, receipt_issue_resolution, rejection_reason, owner_escalated_by, owner_escalated_at, owner_reviewed_by, owner_reviewed_at, owner_decision"
                )
                .eq("id", Number(requestId))
                .in("status", ["approved", "received", "receipt_issue"])
                .maybeSingle();

            if (requestError) {
                console.error("Error loading receipt:", requestError);

                if (!ignore) {
                    setErrorMessage("Could not load this receipt request.");
                    setLoading(false);
                }

                return;
            }

            if (!requestData) {
                if (!ignore) {
                    setErrorMessage(
                        "This request could not be found or is not ready for receipt."
                    );
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
            ].filter((id): id is string => Boolean(id));
            const [linesResult, usersResult] = await Promise.all([
                supabase
                    .from("purchase_requests_items")
                    .select("id, item_id, quantity, received_quantity, purchase_unit, units_per_purchase_unit")
                    .eq("request_id", requestRow.id)
                    .order("id", { ascending: true }),
                supabase.from("users").select("id, name").in("id", userIds),
            ]);

            if (linesResult.error || usersResult.error) {
                console.error(
                    "Error loading receipt details:",
                    linesResult.error ?? usersResult.error
                );

                if (!ignore) {
                    setErrorMessage("Could not load the receipt details.");
                    setLoading(false);
                }

                return;
            }

            const lineRows = (linesResult.data ?? []) as RequestItemRow[];
            const itemIds = [...new Set(lineRows.map((line) => line.item_id))];
            let itemRows: ItemRow[] = [];

            if (itemIds.length > 0) {
                const { data: itemData, error: itemsError } = await supabase
                    .from("items")
                    .select("id, name, unit, purchase_unit, units_per_purchase_unit")
                    .in("id", itemIds);

                if (itemsError) {
                    console.error("Error loading receipt items:", itemsError);

                    if (!ignore) {
                        setErrorMessage("Could not load the receipt items.");
                        setLoading(false);
                    }

                    return;
                }

                itemRows = (itemData ?? []) as ItemRow[];
            }

            const itemsById = new Map(itemRows.map((item) => [item.id, item]));
            const usersById = new Map(
                ((usersResult.data ?? []) as UserRow[]).map((profileRow) => [
                    profileRow.id,
                    profileRow.name,
                ])
            );
            const formattedRequest: ReceiptRequest = {
                id: requestRow.id,
                status: requestRow.status,
                createdAt: requestRow.created_at,
                approvedAt:
                    requestRow.owner_decision === "approved"
                        ? requestRow.owner_reviewed_at
                        : requestRow.accountant_approved_at,
                receivedAt: requestRow.storekeeper_verified_at,
                requestedBy:
                    usersById.get(requestRow.requested_by) ?? "Procurement user",
                approvedBy:
                    requestRow.owner_decision === "approved" &&
                    requestRow.owner_reviewed_by
                        ? (usersById.get(requestRow.owner_reviewed_by) ?? "Owner")
                        : requestRow.accountant_approved_by
                          ? (usersById.get(requestRow.accountant_approved_by) ??
                            "Accountant")
                    : "Not recorded",
                receivedBy: requestRow.storekeeper_verified_by
                    ? (usersById.get(requestRow.storekeeper_verified_by) ??
                      "Storekeeper")
                    : null,
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
                accountantReviewedAt: requestRow.accountant_approved_at,
                accountantReviewedBy: requestRow.accountant_approved_by
                    ? (usersById.get(requestRow.accountant_approved_by) ??
                      "Accountant")
                    : null,
                accountantRejectionReason: requestRow.rejection_reason,
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
                receiptIssueResolution: requestRow.receipt_issue_resolution,
                lines: lineRows.map((line) => {
                    const item = itemsById.get(line.item_id);

                    return {
                        id: line.id,
                        itemName: item?.name ?? "Unknown item",
                        quantity: Number(line.quantity),
                        receivedQuantity:
                            line.received_quantity === null
                                ? null
                                : Number(line.received_quantity),
                        unit: item?.unit ?? "",
                        purchaseUnit:
                            line.purchase_unit ?? item?.purchase_unit ?? item?.unit ?? "",
                        unitsPerPurchaseUnit: Number(
                            line.units_per_purchase_unit ??
                                item?.units_per_purchase_unit ??
                                1
                        ),
                    };
                }),
            };
            const durableHistory = await loadRequestHistory(requestRow.id);

            if (!ignore) {
                setRequest(formattedRequest);
                setHistoryEntries(durableHistory);
                setReceivedQuantities(
                    Object.fromEntries(
                        formattedRequest.lines.map((line) => [
                            line.id,
                            line.receivedQuantity === null
                                ? ""
                                : String(line.receivedQuantity),
                        ])
                    )
                );
                setLoading(false);
            }
        }

        loadReceipt();

        return () => {
            ignore = true;
        };
    }, [requestId, router, verifiedViewerRole]);

    async function confirmReceipt() {
        if (
            !request ||
            request.status !== "approved" ||
            confirming
        ) {
            return;
        }

        const receivedItems = request.lines.map((line) => ({
            request_item_id: line.id,
            actual_quantity: Number(receivedQuantities[line.id]),
        }));

        if (
            receivedItems.some(
                (line) =>
                    receivedQuantities[line.request_item_id]?.trim() === "" ||
                    !Number.isFinite(line.actual_quantity) ||
                    line.actual_quantity < 0
            )
        ) {
            setErrorMessage(
                "Enter the actual quantity received for every item. Use 0 if none arrived."
            );
            return;
        }

        const hasMismatch = request.lines.some(
            (line) => Number(receivedQuantities[line.id]) !== line.quantity
        );
        const confirmed = window.confirm(
            hasMismatch
                ? `Submit received quantities for Purchase Request #${request.id}?\n\nOne or more quantities do not match. The request will be flagged as a Receipt Issue and no stock will be added.`
                : `Confirm receipt for Purchase Request #${request.id}?\n\nAll quantities match. The received quantities will be added to inventory.`
        );

        if (!confirmed) {
            return;
        }

        setConfirming(true);
        setErrorMessage("");

        const { data, error } = await supabase.rpc("submit_purchase_receipt", {
            target_request_id: request.id,
            received_items: receivedItems,
        });

        if (error) {
            console.error("Error confirming receipt:", error);
            setErrorMessage(
                error.message.includes("already been received")
                    ? "This receipt has already been confirmed."
                    : "Could not confirm this receipt. No stock was added. Please try again."
            );
            setConfirming(false);
            return;
        }

        const createdIssue = data === "receipt_issue";
        router.push(
            viewerRole === "owner"
                ? createdIssue
                    ? "/owner/needs-attention"
                    : "/owner/recently-completed"
                : "/storekeeper/receipts"
        );
        router.refresh();
    }

    async function handleOwnerIssueAction(
        action: "return" | "accept" | "void"
    ) {
        if (
            !request ||
            request.status !== "receipt_issue" ||
            viewerRole !== "owner" ||
            ownerAction
        ) {
            return;
        }

        const actionDetails = {
            return: {
                question: `Return Purchase Request #${request.id} to the Storekeeper for another count?`,
                rpc: "return_receipt_to_storekeeper",
                destination: "/owner/awaiting-receipt",
            },
            accept: {
                question: `Accept the actual quantities for Purchase Request #${request.id}?\n\nThe actual quantities will be added to inventory and the request will be closed.`,
                rpc: "accept_actual_purchase_receipt",
                destination: "/owner/recently-completed",
            },
            void: {
                question: `Void Purchase Request #${request.id}?\n\nNo stock will be added and this cannot be undone.`,
                rpc: "void_purchase_receipt",
                destination: "/owner/needs-attention",
            },
        }[action];
        const confirmed = window.confirm(
            actionDetails.question
        );

        if (!confirmed) {
            return;
        }

        setOwnerAction(action);
        setErrorMessage("");

        const { error } = await supabase.rpc(actionDetails.rpc, {
            target_request_id: request.id,
        });

        if (error) {
            console.error(`Error performing receipt issue ${action}:`, error);
            setErrorMessage("Could not update this receipt issue. Please try again.");
            setOwnerAction(null);
            return;
        }

        router.push(actionDetails.destination);
        router.refresh();
    }

    if (loading) {
        return (
            <main className="app-page">
                <div className="mx-auto max-w-7xl">
                    <AppHeader />
                    <p className="text-muted">Loading receipt...</p>
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
                        href={
                            viewerRole === "owner"
                                ? "/owner/needs-attention"
                                : "/storekeeper/receipts"
                        }
                        className="secondary-action mt-6"
                    >
                        Back to Incoming Stock
                    </Link>
                </div>
            </main>
        );
    }

    const hasBeenReceived = request.status === "received";
    const hasReceiptIssue = request.status === "receipt_issue";
    const statusDetails = hasBeenReceived
        ? {
              label: "Received",
              className:
                  "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
          }
        : hasReceiptIssue
          ? {
                label: "Receipt Issue",
                className:
                    "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
            }
          : {
                label: "Awaiting Receipt",
                className:
                    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
            };

    return (
        <main className="app-page">
            <div className="mx-auto max-w-7xl">
                <AppHeader />

                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h1 className="page-title">
                            Receipt for Request #{request.id}
                        </h1>
                        <p className="page-description mt-2">
                            Compare these details with the goods that physically arrived.
                        </p>
                    </div>

                    <span
                        className={`inline-flex self-start rounded-full border px-3 py-1 text-sm font-medium ${statusDetails.className}`}
                    >
                        {statusDetails.label}
                    </span>
                </div>

                {errorMessage && (
                    <div className="error-message mt-8" role="alert">
                        {errorMessage}
                    </div>
                )}

                {hasReceiptIssue && (
                    <div className="mt-8 rounded-xl border border-[var(--danger-border)] bg-[var(--danger-soft)] p-5">
                        <h2 className="font-semibold text-[var(--danger)]">
                            Receipt Issue
                        </h2>
                        <p className="mt-2 whitespace-pre-wrap">
                            {request.receiptIssueReason ??
                                "A receipt issue was reported."}
                        </p>
                        <div className="text-muted mt-4 text-sm">
                            <p>
                                Reported by: {request.receiptIssueReportedBy ??
                                    "Storekeeper"}
                            </p>
                            {request.receiptIssueReportedAt && (
                                <p className="mt-1">
                                    Reported: {formatDateTime(
                                        request.receiptIssueReportedAt
                                    )}
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {!hasReceiptIssue &&
                    request.receiptIssueReason &&
                    request.receiptIssueResolvedAt && (
                        <div className="surface-card mt-8 p-5">
                            <h2 className="font-semibold">
                                Previous Receipt Issue — Resolved
                            </h2>
                            <p className="mt-2 whitespace-pre-wrap">
                                {request.receiptIssueReason}
                            </p>
                            <div className="text-muted mt-4 text-sm">
                                <p>
                                    Resolved by: {request.receiptIssueResolvedBy ??
                                        "Owner"}
                                </p>
                                <p className="mt-1">
                                    Resolved: {formatDateTime(
                                        request.receiptIssueResolvedAt
                                    )}
                                </p>
                            </div>
                        </div>
                    )}

                <dl className="surface-card mt-8 grid gap-5 p-6 sm:grid-cols-2 lg:grid-cols-3 lg:p-7">
                    <div>
                        <dt className="text-muted text-sm">Requested by</dt>
                        <dd className="mt-1 font-semibold">{request.requestedBy}</dd>
                    </div>
                    <div>
                        <dt className="text-muted text-sm">Created</dt>
                        <dd className="mt-1 font-semibold">
                            {formatDateTime(request.createdAt)}
                        </dd>
                    </div>
                    <div>
                        <dt className="text-muted text-sm">Approved by</dt>
                        <dd className="mt-1 font-semibold">{request.approvedBy}</dd>
                    </div>
                    <div>
                        <dt className="text-muted text-sm">Approved</dt>
                        <dd className="mt-1 font-semibold">
                            {request.approvedAt
                                ? formatDateTime(request.approvedAt)
                                : "Not recorded"}
                        </dd>
                    </div>
                    {hasBeenReceived && (
                        <>
                            <div>
                                <dt className="text-muted text-sm">Received by</dt>
                                <dd className="mt-1 font-semibold">
                                    {request.receivedBy ?? "Storekeeper"}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-muted text-sm">Received</dt>
                                <dd className="mt-1 font-semibold">
                                    {request.receivedAt
                                        ? formatDateTime(request.receivedAt)
                                        : "Not recorded"}
                                </dd>
                            </div>
                        </>
                    )}
                </dl>

                <RequestHistory
                    entries={historyEntries.length > 0 ? historyEntries : [
                        {
                            action: "Requested",
                            person: request.requestedBy,
                            timestamp: request.createdAt,
                        },
                        ...(request.accountantRejectionReason &&
                        request.accountantReviewedAt &&
                        request.accountantReviewedBy
                            ? [
                                  {
                                      action: "Rejected",
                                      person: request.accountantReviewedBy,
                                      timestamp: request.accountantReviewedAt,
                                      detail: request.accountantRejectionReason,
                                  },
                              ]
                            : []),
                        ...(request.ownerEscalatedAt && request.ownerEscalatedBy
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
                                  },
                              ]
                            : []),
                        ...(!request.ownerReviewedAt && request.approvedAt
                            ? [
                                  {
                                      action: "Approved",
                                      person: request.approvedBy,
                                      timestamp: request.approvedAt,
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
                                      action:
                                          request.receiptIssueResolution ===
                                          "returned_to_storekeeper"
                                              ? "Returned to Storekeeper"
                                              : request.receiptIssueResolution ===
                                                  "accepted_actual"
                                                ? "Actual quantities accepted"
                                                : request.receiptIssueResolution ===
                                                    "voided"
                                                  ? "Request voided"
                                                  : "Receipt issue resolved",
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
                    ]}
                />

                <div className="surface-card mt-8 overflow-hidden">
                    <div className="hidden grid-cols-[minmax(0,1fr)_auto_auto] gap-6 border-b border-[var(--border)] px-6 py-4 text-sm font-semibold text-[var(--muted-strong)] sm:grid">
                        <span>Item</span>
                        <span className="w-44">Ordered</span>
                        <span className="w-40">Actual Received</span>
                    </div>

                    {request.lines.length === 0 ? (
                        <p className="text-muted px-6 py-6">
                            No items were found for this request.
                        </p>
                    ) : (
                        request.lines.map((line) => (
                            <div
                                key={line.id}
                                className="grid gap-3 border-b border-[var(--border)] px-6 py-5 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-6"
                            >
                                <div>
                                    <p className="font-medium">{line.itemName}</p>
                                    <p className="text-muted mt-1 text-sm sm:hidden">
                                        Ordered: {formatQuantity(
                                            line.quantity,
                                            line.purchaseUnit
                                        )}
                                    </p>
                                    {hasPurchaseConversion(
                                        line.unit,
                                        line.purchaseUnit,
                                        line.unitsPerPurchaseUnit
                                    ) && (
                                        <p className="text-muted mt-1 text-sm">
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
                                <p className="hidden w-44 sm:block">
                                    {formatQuantity(
                                        line.quantity,
                                        line.purchaseUnit
                                    )}
                                </p>
                                {request.status === "approved" ? (
                                    <div className="w-full sm:w-40">
                                        <label
                                            htmlFor={`received-${line.id}`}
                                            className="form-label sm:sr-only"
                                        >
                                            Actual quantity received for {line.itemName}
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                id={`received-${line.id}`}
                                                type="number"
                                                min="0"
                                                step="any"
                                                value={
                                                    receivedQuantities[line.id] ??
                                                    ""
                                                }
                                                onChange={(event) =>
                                                    setReceivedQuantities(
                                                        (quantities) => ({
                                                            ...quantities,
                                                            [line.id]:
                                                                event.target.value,
                                                        })
                                                    )
                                                }
                                                disabled={confirming}
                                                className="form-control min-w-0"
                                                placeholder="0"
                                            />
                                            <span className="text-muted text-sm">
                                                {line.purchaseUnit}
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <p
                                        className={`w-40 font-semibold ${
                                            line.receivedQuantity !== null &&
                                            line.receivedQuantity !== line.quantity
                                                ? "text-[var(--danger)]"
                                                : ""
                                        }`}
                                    >
                                        {line.receivedQuantity === null
                                            ? "Not recorded"
                                            : formatQuantity(
                                                  line.receivedQuantity,
                                                  line.purchaseUnit
                                              )}
                                        {line.receivedQuantity !== null &&
                                            hasPurchaseConversion(
                                                line.unit,
                                                line.purchaseUnit,
                                                line.unitsPerPurchaseUnit
                                            ) && (
                                            <span className="text-muted mt-1 block text-xs font-normal">
                                                {formatQuantity(
                                                    stockEquivalent(
                                                        line.receivedQuantity,
                                                        line.unitsPerPurchaseUnit
                                                    ),
                                                    line.unit
                                                )} stock
                                            </span>
                                        )}
                                    </p>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {hasBeenReceived ? (
                    <div className="surface-card mt-6 p-5">
                        <p className="font-semibold">Receipt confirmed</p>
                        <p className="text-muted mt-1 text-sm">
                            This request has already been added to inventory and
                            cannot be confirmed again.
                        </p>
                    </div>
                ) : hasReceiptIssue ? (
                    <div className="surface-card mt-6 p-5">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="font-semibold">
                                    Awaiting resolution
                                </p>
                                <p className="text-muted mt-1 text-sm">
                                    No stock has been added while this receipt issue
                                    remains unresolved.
                                </p>
                            </div>

                            {viewerRole === "owner" && (
                                <div className="grid gap-3 sm:grid-cols-3">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            handleOwnerIssueAction("return")
                                        }
                                        disabled={ownerAction !== null}
                                        className="secondary-action"
                                    >
                                        {ownerAction === "return"
                                            ? "Returning..."
                                            : "Return to Storekeeper"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            handleOwnerIssueAction("accept")
                                        }
                                        disabled={ownerAction !== null}
                                        className="primary-action"
                                    >
                                        {ownerAction === "accept"
                                            ? "Accepting..."
                                            : "Accept Actual Quantity"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            handleOwnerIssueAction("void")
                                        }
                                        disabled={ownerAction !== null}
                                        className="secondary-action border-[var(--danger-border)] text-[var(--danger)]"
                                    >
                                        {ownerAction === "void"
                                            ? "Voiding..."
                                            : "Void Request"}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="surface-card mt-6 p-5">
                            <p className="font-semibold">Before confirming</p>
                            <p className="text-muted mt-1 text-sm">
                                Enter the actual amount received for every item. A
                                mismatch will create a Receipt Issue without changing
                                inventory.
                            </p>
                        </div>

                        <div className="mt-6">
                            <button
                                type="button"
                                onClick={confirmReceipt}
                                disabled={
                                    confirming ||
                                    request.lines.length === 0
                                }
                                className="primary-action w-full"
                            >
                                {confirming
                                    ? "Confirming Receipt..."
                                    : "Confirm Receipt"}
                            </button>
                        </div>
                    </>
                )}
            </div>

        </main>
    );
}
