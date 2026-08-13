"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/app-header";
import RequestHistory from "@/components/request-history";
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
    receiptIssueResolvedBy: string | null;
    lines: ReceiptLine[];
};

type ReceiptLine = {
    id: number;
    itemName: string;
    quantity: number;
    unit: string;
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
};

type RequestItemRow = {
    id: number;
    item_id: number;
    quantity: number | string;
};

type ItemRow = {
    id: number;
    name: string;
    unit: string;
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

export default function ReceiptDetail({ requestId }: { requestId: string }) {
    const router = useRouter();
    const [request, setRequest] = useState<ReceiptRequest | null>(null);
    const [loading, setLoading] = useState(true);
    const [confirming, setConfirming] = useState(false);
    const [reportingIssue, setReportingIssue] = useState(false);
    const [issueDialogOpen, setIssueDialogOpen] = useState(false);
    const [issueReason, setIssueReason] = useState("");
    const [issueError, setIssueError] = useState("");
    const [viewerRole, setViewerRole] = useState("");
    const [resolvingIssue, setResolvingIssue] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    useEffect(() => {
        let ignore = false;

        async function loadReceipt() {
            if (!/^\d+$/.test(requestId)) {
                setErrorMessage("This receipt request could not be found.");
                setLoading(false);
                return;
            }

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

            const { data: requestData, error: requestError } = await supabase
                .from("purchase_requests")
                .select(
                    "id, status, created_at, requested_by, accountant_approved_by, accountant_approved_at, storekeeper_verified_by, storekeeper_verified_at, receipt_issue_reason, receipt_issue_reported_by, receipt_issue_reported_at, receipt_issue_resolved_by, receipt_issue_resolved_at"
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
            ].filter((id): id is string => Boolean(id));
            const [linesResult, usersResult] = await Promise.all([
                supabase
                    .from("purchase_requests_items")
                    .select("id, item_id, quantity")
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
                    .select("id, name, unit")
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
                approvedAt: requestRow.accountant_approved_at,
                receivedAt: requestRow.storekeeper_verified_at,
                requestedBy:
                    usersById.get(requestRow.requested_by) ?? "Procurement user",
                approvedBy: requestRow.accountant_approved_by
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
                lines: lineRows.map((line) => {
                    const item = itemsById.get(line.item_id);

                    return {
                        id: line.id,
                        itemName: item?.name ?? "Unknown item",
                        quantity: Number(line.quantity),
                        unit: item?.unit ?? "",
                    };
                }),
            };

            if (!ignore) {
                setRequest(formattedRequest);
                setLoading(false);
            }
        }

        loadReceipt();

        return () => {
            ignore = true;
        };
    }, [requestId, router]);

    async function confirmReceipt() {
        if (
            !request ||
            request.status !== "approved" ||
            confirming
        ) {
            return;
        }

        const confirmed = window.confirm(
            `Confirm receipt for Purchase Request #${request.id}?\n\nOnly continue if every listed item and quantity was physically received correctly. This will add the quantities to inventory.`
        );

        if (!confirmed) {
            return;
        }

        setConfirming(true);
        setErrorMessage("");

        const { error } = await supabase.rpc("confirm_purchase_delivery", {
            target_request_id: request.id,
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

        router.push("/storekeeper/receipts");
        router.refresh();
    }

    async function resolveReceiptIssue() {
        if (
            !request ||
            request.status !== "receipt_issue" ||
            viewerRole !== "owner" ||
            resolvingIssue
        ) {
            return;
        }

        const confirmed = window.confirm(
            `Mark the receipt issue for Purchase Request #${request.id} as resolved?\n\nThe request will return to Awaiting Receipt. No inventory will be changed until the receipt is confirmed.`
        );

        if (!confirmed) {
            return;
        }

        setResolvingIssue(true);
        setErrorMessage("");

        const { error } = await supabase.rpc("resolve_receipt_issue", {
            target_request_id: request.id,
        });

        if (error) {
            console.error("Error resolving receipt issue:", error);
            setErrorMessage(
                error.message.includes("does not have a receipt issue")
                    ? "This receipt issue has already been resolved."
                    : "Could not resolve this receipt issue. Please try again."
            );
            setResolvingIssue(false);
            return;
        }

        router.push("/owner");
        router.refresh();
    }

    function openIssueDialog() {
        setIssueReason("");
        setIssueError("");
        setIssueDialogOpen(true);
    }

    async function submitReceiptIssue(
        event: React.FormEvent<HTMLFormElement>
    ) {
        event.preventDefault();

        if (!request || request.status !== "approved" || reportingIssue) {
            return;
        }

        const reason = issueReason.trim();

        if (!reason) {
            setIssueError("Please explain the receipt issue.");
            return;
        }

        setReportingIssue(true);
        setIssueError("");

        const { error } = await supabase.rpc("report_receipt_issue", {
            target_request_id: request.id,
            issue_reason: reason,
        });

        if (error) {
            console.error("Error reporting receipt issue:", error);
            setIssueError(
                error.message.includes("not awaiting receipt")
                    ? "This request is no longer awaiting receipt."
                    : "Could not record the receipt issue. Please try again."
            );
            setReportingIssue(false);
            return;
        }

        router.push("/storekeeper/receipts");
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
                        href="/storekeeper/receipts"
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
                    entries={[
                        {
                            action: "Requested",
                            person: request.requestedBy,
                            timestamp: request.createdAt,
                        },
                        ...(request.approvedAt
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
                    ]}
                />

                <div className="surface-card mt-8 overflow-hidden">
                    <div className="hidden grid-cols-[minmax(0,1fr)_auto] gap-6 border-b border-[var(--border)] px-6 py-4 text-sm font-semibold text-[var(--muted-strong)] sm:grid">
                        <span>Item</span>
                        <span className="w-36">Quantity</span>
                    </div>

                    {request.lines.length === 0 ? (
                        <p className="text-muted px-6 py-6">
                            No items were found for this request.
                        </p>
                    ) : (
                        request.lines.map((line) => (
                            <div
                                key={line.id}
                                className="grid gap-3 border-b border-[var(--border)] px-6 py-5 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6"
                            >
                                <div>
                                    <p className="font-medium">{line.itemName}</p>
                                    <p className="text-muted mt-1 text-sm sm:hidden">
                                        {line.quantity} {line.unit}
                                    </p>
                                </div>
                                <p className="hidden w-36 sm:block">
                                    {line.quantity} {line.unit}
                                </p>
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
                                <button
                                    type="button"
                                    onClick={resolveReceiptIssue}
                                    disabled={resolvingIssue}
                                    className="primary-action shrink-0"
                                >
                                    {resolvingIssue
                                        ? "Resolving Issue..."
                                        : "Mark Issue Resolved"}
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="surface-card mt-6 p-5">
                            <p className="font-semibold">Before confirming</p>
                            <p className="text-muted mt-1 text-sm">
                                Confirm only when every item and quantity listed
                                above has been physically received correctly.
                            </p>
                        </div>

                        <div className="mt-6 grid gap-3 sm:grid-cols-2">
                            <button
                                type="button"
                                onClick={openIssueDialog}
                                disabled={confirming}
                                className="secondary-action disabled:cursor-not-allowed disabled:opacity-55"
                            >
                                Receipt Issue
                            </button>
                            <button
                                type="button"
                                onClick={confirmReceipt}
                                disabled={
                                    confirming ||
                                    reportingIssue ||
                                    request.lines.length === 0
                                }
                                className="primary-action"
                            >
                                {confirming
                                    ? "Confirming Receipt..."
                                    : "Confirm Receipt"}
                            </button>
                        </div>
                    </>
                )}
            </div>

            {issueDialogOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
                    role="presentation"
                >
                    <form
                        onSubmit={submitReceiptIssue}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="receipt-issue-title"
                        className="surface-card w-full max-w-lg p-6 sm:p-7"
                    >
                        <h2
                            id="receipt-issue-title"
                            className="text-xl font-semibold"
                        >
                            Report Receipt Issue
                        </h2>
                        <p className="text-muted mt-2 text-sm">
                            Request #{request.id} will be flagged for attention and
                            no stock will be added.
                        </p>

                        <label
                            htmlFor="receipt-issue-reason"
                            className="form-label mt-6"
                        >
                            What is wrong with the receipt?
                        </label>
                        <textarea
                            id="receipt-issue-reason"
                            value={issueReason}
                            onChange={(event) => {
                                setIssueReason(event.target.value);
                                setIssueError("");
                            }}
                            rows={4}
                            maxLength={500}
                            autoFocus
                            disabled={reportingIssue}
                            placeholder="For example: Expected 12 Glade but only 8 were received."
                            className="form-control resize-y"
                        />

                        {issueError && (
                            <p
                                className="mt-3 text-sm text-[var(--danger)]"
                                role="alert"
                            >
                                {issueError}
                            </p>
                        )}

                        <div className="mt-6 grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setIssueDialogOpen(false)}
                                disabled={reportingIssue}
                                className="secondary-action disabled:cursor-not-allowed disabled:opacity-55"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={reportingIssue}
                                className="primary-action bg-[var(--danger)] text-white hover:bg-[var(--danger)] disabled:cursor-not-allowed disabled:opacity-55"
                            >
                                {reportingIssue
                                    ? "Reporting Issue..."
                                    : "Report Issue"}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </main>
    );
}
