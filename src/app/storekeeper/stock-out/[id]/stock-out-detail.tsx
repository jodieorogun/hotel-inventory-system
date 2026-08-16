"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/app-header";
import { supabase } from "@/lib/supabase";
import { formatQuantity } from "@/lib/units";
import { loadVisibleUserNames } from "@/lib/user-names";

type StockRequest = {
    id: number;
    status: string;
    createdAt: string;
    requestedBy: string;
    confirmedAt: string | null;
    confirmedBy: string | null;
    rejectionReason: string | null;
    lines: StockLine[];
};

type StockLine = {
    id: number;
    itemName: string;
    unit: string;
    availableQuantity: number;
    requestedQuantity: number;
    issuedQuantity: number | null;
};

type RequestRow = {
    id: number;
    status: string;
    created_at: string;
    requested_by: string;
    storekeeper_confirmed_by: string | null;
    storekeeper_confirmed_at: string | null;
    rejection_reason: string | null;
};

type LineRow = {
    id: number;
    item_id: number;
    requested_quantity: number | string;
    issued_quantity: number | string | null;
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

export default function StockOutDetail({ requestId }: { requestId: string }) {
    const router = useRouter();
    const [request, setRequest] = useState<StockRequest | null>(null);
    const [viewerRole, setViewerRole] = useState("");
    const [issuedQuantities, setIssuedQuantities] = useState<Record<number, string>>({});
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [rejecting, setRejecting] = useState(false);
    const [rejectionReason, setRejectionReason] = useState("");
    const [errorMessage, setErrorMessage] = useState("");

    useEffect(() => {
        let ignore = false;

        async function loadRequest() {
            if (!/^\d+$/.test(requestId)) {
                setErrorMessage("This stock request could not be found.");
                setLoading(false);
                return;
            }

            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                router.replace("/login");
                return;
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

            if (!ignore) {
                setViewerRole(profile.role);
            }

            const { data: requestData, error: requestError } = await supabase
                .from("stock_out_requests")
                .select("id, status, created_at, requested_by, storekeeper_confirmed_by, storekeeper_confirmed_at, rejection_reason")
                .eq("id", Number(requestId))
                .maybeSingle();

            if (requestError || !requestData) {
                console.error("Error loading stock-out request:", requestError);
                if (!ignore) {
                    setErrorMessage("This stock request could not be found.");
                    setLoading(false);
                }
                return;
            }

            const requestRow = requestData as RequestRow;
            const userIds = [requestRow.requested_by, requestRow.storekeeper_confirmed_by].filter(
                (id): id is string => Boolean(id)
            );
            const [linesResult, usersById] = await Promise.all([
                supabase
                    .from("stock_out_request_items")
                    .select("id, item_id, requested_quantity, issued_quantity")
                    .eq("request_id", requestRow.id)
                    .order("id"),
                loadVisibleUserNames(userIds),
            ]);

            if (linesResult.error) {
                console.error("Error loading stock-out details:", linesResult.error);
                if (!ignore) {
                    setErrorMessage("Could not load the requested items.");
                    setLoading(false);
                }
                return;
            }

            const lineRows = (linesResult.data ?? []) as LineRow[];
            const itemIds = [...new Set(lineRows.map((line) => line.item_id))];
            const { data: itemData, error: itemError } = await supabase
                .from("items")
                .select("id, name, unit, current_quantity")
                .in("id", itemIds);

            if (itemError) {
                console.error("Error loading current inventory:", itemError);
            }

            const itemsById = new Map((itemData ?? []).map((item) => [item.id, item]));
            const formattedRequest: StockRequest = {
                id: requestRow.id,
                status: requestRow.status,
                createdAt: requestRow.created_at,
                requestedBy: usersById.get(requestRow.requested_by) ?? "Housekeeper",
                confirmedAt: requestRow.storekeeper_confirmed_at,
                confirmedBy: requestRow.storekeeper_confirmed_by
                    ? usersById.get(requestRow.storekeeper_confirmed_by) ?? "Storekeeper"
                    : null,
                rejectionReason: requestRow.rejection_reason,
                lines: lineRows.map((line) => {
                    const item = itemsById.get(line.item_id);
                    return {
                        id: line.id,
                        itemName: item?.name ?? "Unknown item",
                        unit: item?.unit ?? "",
                        availableQuantity: Number(item?.current_quantity ?? 0),
                        requestedQuantity: Number(line.requested_quantity),
                        issuedQuantity:
                            line.issued_quantity === null ? null : Number(line.issued_quantity),
                    };
                }),
            };

            if (!ignore) {
                setRequest(formattedRequest);
                setIssuedQuantities(
                    Object.fromEntries(
                        formattedRequest.lines.map((line) => [
                            line.id,
                            String(line.issuedQuantity ?? Math.min(line.requestedQuantity, line.availableQuantity)),
                        ])
                    )
                );
                setLoading(false);
            }
        }

        loadRequest();
        return () => {
            ignore = true;
        };
    }, [requestId, router]);

    async function confirmIssue() {
        const canConfirm =
            request &&
            (request.status === "pending_storekeeper" ||
                (viewerRole === "owner" && request.status === "escalated_owner"));

        if (!request || !canConfirm || updating) return;

        const issuedItems = request.lines.map((line) => ({
            request_item_id: line.id,
            issued_quantity: Number(issuedQuantities[line.id]),
        }));

        if (
            issuedItems.some((issuedLine) => {
                const requestLine = request.lines.find((line) => line.id === issuedLine.request_item_id);
                return (
                    !requestLine ||
                    issuedQuantities[issuedLine.request_item_id]?.trim() === "" ||
                    !Number.isInteger(issuedLine.issued_quantity) ||
                    issuedLine.issued_quantity < 0 ||
                    issuedLine.issued_quantity > requestLine.requestedQuantity ||
                    issuedLine.issued_quantity > requestLine.availableQuantity
                );
            }) ||
            !issuedItems.some((line) => line.issued_quantity > 0)
        ) {
            setErrorMessage(
                "Enter whole quantities within the requested and available amounts. At least one item must be issued."
            );
            return;
        }

        const hasShortfall = request.lines.some(
            (line) => Number(issuedQuantities[line.id]) < line.requestedQuantity
        );
        const confirmed = window.confirm(
            hasShortfall
                ? `Confirm stock issued for Request #${request.id}?\n\nSome quantities are lower than requested. Only the actual quantities entered will leave inventory.`
                : `Confirm stock issued for Request #${request.id}?\n\nThe quantities entered will be removed from inventory.`
        );

        if (!confirmed) return;

        setUpdating(true);
        setErrorMessage("");
        const { error } = await supabase.rpc("confirm_stock_out_request", {
            target_request_id: request.id,
            issued_items: issuedItems,
        });

        if (error) {
            console.error("Error confirming stock out:", error);
            setErrorMessage(error.message.includes("available")
                ? "Stock changed before confirmation. Refresh and check the available quantities."
                : "Could not confirm this stock issue. No inventory was changed.");
            setUpdating(false);
            return;
        }

        router.push("/storekeeper/stock-out?tab=issued");
        router.refresh();
    }

    async function escalateRequest() {
        if (!request || !rejectionReason.trim() || updating) return;
        setUpdating(true);
        setErrorMessage("");

        const { error } = await supabase.rpc("escalate_stock_out_request", {
            target_request_id: request.id,
            reason: rejectionReason.trim(),
        });

        if (error) {
            console.error("Error escalating stock request:", error);
            setErrorMessage("Could not escalate this request to the Owner.");
            setUpdating(false);
            return;
        }

        router.push("/storekeeper/stock-out?tab=escalated");
        router.refresh();
    }

    async function handleOwnerAction(action: "return" | "void") {
        if (!request || viewerRole !== "owner" || updating) return;

        if (action === "return" && request.status !== "escalated_owner") return;
        if (
            action === "void" &&
            !["pending_storekeeper", "escalated_owner"].includes(request.status)
        ) return;

        const confirmed = window.confirm(
            action === "return"
                ? `Return Stock Request #${request.id} to the Storekeeper?`
                : `Void Stock Request #${request.id}?\n\nNo inventory will be removed and the request will be permanently closed.`
        );

        if (!confirmed) return;

        setUpdating(true);
        setErrorMessage("");
        const { error } = await supabase.rpc(
            action === "return"
                ? "return_stock_out_to_storekeeper"
                : "owner_void_stock_out_request",
            { target_request_id: request.id }
        );

        if (error) {
            console.error(`Error performing Owner stock-out ${action}:`, error);
            setErrorMessage(`Could not ${action} this stock request.`);
            setUpdating(false);
            return;
        }

        router.push(
            action === "return"
                ? "/storekeeper/stock-out?tab=pending"
                : "/storekeeper/stock-out?tab=all"
        );
        router.refresh();
    }

    if (loading) {
        return <main className="app-page"><div className="mx-auto max-w-6xl"><AppHeader /><p className="text-muted">Loading request...</p></div></main>;
    }

    if (!request) {
        return <main className="app-page"><div className="mx-auto max-w-6xl"><AppHeader /><p className="error-message">{errorMessage}</p><Link href="/storekeeper/stock-out" className="secondary-action mt-6">Back to Stock Requests</Link></div></main>;
    }

    return (
        <main className="app-page">
            <div className="mx-auto max-w-6xl">
                <AppHeader />
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="page-title">Stock Request #{request.id}</h1>
                        <p className="page-description mt-2">Requested by {request.requestedBy}</p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-sm font-medium ${
                        request.status === "pending_storekeeper"
                            ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
                            : request.status === "issued"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                              : request.status === "escalated_owner"
                                ? "border-purple-200 bg-purple-50 text-purple-800 dark:border-purple-900 dark:bg-purple-950 dark:text-purple-300"
                                : "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                    }`}>
                        {request.status === "pending_storekeeper" ? "Pending" : request.status === "issued" ? "Issued" : request.status === "escalated_owner" ? "Owner Review" : "Voided"}
                    </span>
                </div>

                <div className="surface-card mt-8 grid gap-5 p-6 sm:grid-cols-3">
                    <div><p className="text-muted text-sm">Requested</p><p className="mt-1 font-medium">{formatDateTime(request.createdAt)}</p></div>
                    <div><p className="text-muted text-sm">Handled by</p><p className="mt-1 font-medium">{request.confirmedBy ?? "Not yet handled"}</p></div>
                    <div><p className="text-muted text-sm">Handled</p><p className="mt-1 font-medium">{request.confirmedAt ? formatDateTime(request.confirmedAt) : "—"}</p></div>
                </div>

                {errorMessage && <p className="error-message mt-6">{errorMessage}</p>}
                {request.rejectionReason && (
                    <div className="mt-6 rounded-xl border border-[var(--danger-border)] bg-[var(--danger-soft)] p-5">
                        <p className="font-semibold text-[var(--danger)]">Storekeeper&apos;s reason</p>
                        <p className="mt-2">{request.rejectionReason}</p>
                    </div>
                )}

                <div className="surface-card mt-8 overflow-hidden">
                    <div className="hidden grid-cols-[1fr_11rem_11rem_13rem] gap-5 border-b border-[var(--border)] px-6 py-4 text-sm font-semibold text-[var(--muted-strong)] sm:grid">
                        <span>Item</span><span>Available</span><span>Requested</span><span>Actual Issued</span>
                    </div>
                    {request.lines.map((line) => (
                        <div key={line.id} className="grid gap-3 border-b border-[var(--border)] px-6 py-5 last:border-b-0 sm:grid-cols-[1fr_11rem_11rem_13rem] sm:items-center sm:gap-5">
                            <p className="font-medium">{line.itemName}</p>
                            <p className="text-sm">{formatQuantity(line.availableQuantity, line.unit)}</p>
                            <p className="text-sm">{formatQuantity(line.requestedQuantity, line.unit)}</p>
                            {request.status === "pending_storekeeper" ||
                            (viewerRole === "owner" && request.status === "escalated_owner") ? (
                                <div>
                                    <label htmlFor={`issued-${line.id}`} className="form-label sm:sr-only">Actual {line.itemName} issued</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            id={`issued-${line.id}`}
                                            type="number"
                                            min="0"
                                            step="1"
                                            max={Math.min(line.requestedQuantity, line.availableQuantity)}
                                            value={issuedQuantities[line.id] ?? ""}
                                            onChange={(event) => setIssuedQuantities((current) => ({ ...current, [line.id]: event.target.value }))}
                                            disabled={updating}
                                            className="form-control"
                                        />
                                        <span className="text-muted text-sm">{line.unit}</span>
                                    </div>
                                </div>
                            ) : (
                                <p className="font-semibold">{line.issuedQuantity === null ? "Not issued" : formatQuantity(line.issuedQuantity, line.unit)}</p>
                            )}
                        </div>
                    ))}
                </div>

                {request.status === "pending_storekeeper" && (
                    <div className="mt-6 grid gap-3 sm:grid-cols-2">
                        <button
                            type="button"
                            onClick={() =>
                                viewerRole === "owner"
                                    ? handleOwnerAction("void")
                                    : setRejecting(true)
                            }
                            disabled={updating}
                            className="secondary-action border-[var(--danger-border)] text-[var(--danger)]"
                        >
                            {viewerRole === "owner" ? "Void Request" : "Escalate to Owner"}
                        </button>
                        <button type="button" onClick={confirmIssue} disabled={updating} className="primary-action">{updating ? "Confirming..." : "Confirm Stock Issued"}</button>
                    </div>
                )}

                {request.status === "escalated_owner" && viewerRole === "owner" && (
                    <div className="mt-6 grid gap-3 sm:grid-cols-3">
                        <button type="button" onClick={() => handleOwnerAction("return")} disabled={updating} className="secondary-action">
                            Return to Storekeeper
                        </button>
                        <button type="button" onClick={confirmIssue} disabled={updating} className="primary-action">
                            {updating ? "Updating..." : "Confirm Stock Issued"}
                        </button>
                        <button type="button" onClick={() => handleOwnerAction("void")} disabled={updating} className="secondary-action border-[var(--danger-border)] text-[var(--danger)]">
                            Void Request
                        </button>
                    </div>
                )}

                {request.status === "escalated_owner" && viewerRole === "storekeeper" && (
                    <div className="surface-card mt-6 p-5">
                        <p className="font-semibold">Awaiting Owner decision</p>
                        <p className="text-muted mt-1 text-sm">The Owner can issue, return, or void this request.</p>
                    </div>
                )}
            </div>

            {rejecting && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                    <div role="dialog" aria-modal="true" aria-labelledby="reject-stock-title" className="surface-card w-full max-w-lg p-6">
                        <h2 id="reject-stock-title" className="text-xl font-semibold">Escalate to Owner</h2>
                        <p className="text-muted mt-2 text-sm">Explain why the request cannot currently be issued.</p>
                        <textarea value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} rows={4} className="form-control mt-5" placeholder="Reason for escalation" autoFocus />
                        <div className="mt-5 grid grid-cols-2 gap-3">
                            <button type="button" onClick={() => setRejecting(false)} disabled={updating} className="secondary-action">Cancel</button>
                            <button type="button" onClick={escalateRequest} disabled={updating || !rejectionReason.trim()} className="primary-action">{updating ? "Escalating..." : "Escalate Request"}</button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
