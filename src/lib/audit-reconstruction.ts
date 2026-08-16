import { supabase } from "@/lib/supabase";
import { formatQuantity } from "@/lib/units";
import { loadVisibleUserNames } from "@/lib/user-names";
import type { AuditableEvent } from "@/lib/audit-events";

export type ReconstructedAuditEvent = AuditableEvent & {
    action_label: string;
    actor_role: string;
    summary: string;
    quantity_change: number | string | null;
};

type PurchaseRequestRow = {
    id: number;
    storekeeper_verified_by: string | null;
    storekeeper_verified_at: string | null;
};

type PurchaseItemRow = {
    request_id: number;
    item_id: number;
    received_stock_quantity: number | string | null;
};

type StockRequestRow = {
    id: number;
    storekeeper_confirmed_by: string | null;
    storekeeper_confirmed_at: string | null;
};

type StockRequestItemRow = {
    request_id: number;
    item_id: number;
    issued_quantity: number | string | null;
};

type StockCheckRow = {
    id: number;
    completed_by: string;
    completed_at: string;
};

type StockCheckItemRow = {
    stock_check_id: number;
    item_id: number | null;
    item_name: string;
    unit: string;
    expected_quantity: number | string;
    physical_quantity: number | string;
    variance: number | string;
};

type ItemRow = {
    id: number;
    name: string;
    unit: string;
};

function hasRelatedAction(
    events: ReconstructedAuditEvent[],
    tokens: string[],
    relationship: "purchase" | "stock-out" | "stock-check",
    id: number
) {
    return events.some((event) => {
        const relatedId =
            relationship === "purchase"
                ? event.purchase_request_id
                : relationship === "stock-out"
                  ? event.stock_out_request_id
                  : event.stock_check_id;

        return (
            relatedId === id &&
            tokens.some((token) => event.action_type.includes(token))
        );
    });
}

function lineDetails(
    lines: Array<{ item_id: number; quantity: number }>,
    itemsById: Map<number, ItemRow>,
    sign = ""
) {
    return lines
        .filter((line) => line.quantity !== 0)
        .map((line) => {
            const item = itemsById.get(line.item_id);
            return `${item?.name ?? `Item #${line.item_id}`}: ${sign}${formatQuantity(
                line.quantity,
                item?.unit ?? "unit"
            )}`;
        })
        .join("\n");
}

export async function reconstructHistoricalAuditEvents(
    existingEvents: ReconstructedAuditEvent[]
) {
    const [purchaseResult, stockOutResult, stockCheckResult] = await Promise.all([
        supabase
            .from("purchase_requests")
            .select("id, storekeeper_verified_by, storekeeper_verified_at")
            .not("storekeeper_verified_at", "is", null),
        supabase
            .from("stock_out_requests")
            .select("id, storekeeper_confirmed_by, storekeeper_confirmed_at")
            .not("storekeeper_confirmed_at", "is", null),
        supabase
            .from("stock_checks")
            .select("id, completed_by, completed_at"),
    ]);

    if (purchaseResult.error || stockOutResult.error || stockCheckResult.error) {
        console.warn(
            "Could not reconstruct older audit activity:",
            purchaseResult.error ?? stockOutResult.error ?? stockCheckResult.error
        );
        return [];
    }

    const purchases = (purchaseResult.data ?? []) as PurchaseRequestRow[];
    const stockOutRequests = (stockOutResult.data ?? []) as StockRequestRow[];
    const stockChecks = (stockCheckResult.data ?? []) as StockCheckRow[];
    const purchaseIds = purchases.map((request) => request.id);
    const stockOutIds = stockOutRequests.map((request) => request.id);
    const stockCheckIds = stockChecks.map((check) => check.id);

    const [purchaseItemsResult, stockOutItemsResult, stockCheckItemsResult] =
        await Promise.all([
            purchaseIds.length > 0
                ? supabase
                      .from("purchase_requests_items")
                      .select("request_id, item_id, received_stock_quantity")
                      .in("request_id", purchaseIds)
                : Promise.resolve({ data: [], error: null }),
            stockOutIds.length > 0
                ? supabase
                      .from("stock_out_request_items")
                      .select("request_id, item_id, issued_quantity")
                      .in("request_id", stockOutIds)
                : Promise.resolve({ data: [], error: null }),
            stockCheckIds.length > 0
                ? supabase
                      .from("stock_check_items")
                      .select(
                          "stock_check_id, item_id, item_name, unit, expected_quantity, physical_quantity, variance"
                      )
                      .in("stock_check_id", stockCheckIds)
                : Promise.resolve({ data: [], error: null }),
        ]);

    if (
        purchaseItemsResult.error ||
        stockOutItemsResult.error ||
        stockCheckItemsResult.error
    ) {
        console.warn(
            "Could not reconstruct older audit quantities:",
            purchaseItemsResult.error ??
                stockOutItemsResult.error ??
                stockCheckItemsResult.error
        );
        return [];
    }

    const purchaseItems = (purchaseItemsResult.data ?? []) as PurchaseItemRow[];
    const stockOutItems = (stockOutItemsResult.data ?? []) as StockRequestItemRow[];
    const stockCheckItems = (stockCheckItemsResult.data ?? []) as StockCheckItemRow[];
    const itemIds = [
        ...new Set([
            ...purchaseItems.map((line) => line.item_id),
            ...stockOutItems.map((line) => line.item_id),
        ]),
    ];
    const { data: itemData, error: itemError } = itemIds.length
        ? await supabase.from("items").select("id, name, unit").in("id", itemIds)
        : { data: [], error: null };

    if (itemError) {
        console.warn("Could not load item names for older audit activity:", itemError);
    }

    const itemsById = new Map(
        ((itemData ?? []) as ItemRow[]).map((item) => [item.id, item])
    );
    const actorIds = [
        ...purchases.map((request) => request.storekeeper_verified_by),
        ...stockOutRequests.map((request) => request.storekeeper_confirmed_by),
        ...stockChecks.map((check) => check.completed_by),
    ];
    const namesById = await loadVisibleUserNames(actorIds);
    const rolesById = new Map<string, string>();

    for (const event of existingEvents) {
        if (event.actor_id && !rolesById.has(event.actor_id)) {
            rolesById.set(event.actor_id, event.actor_role);
        }
    }

    const reconstructed: ReconstructedAuditEvent[] = [];

    function addEvent(event: ReconstructedAuditEvent) {
        reconstructed.push(event);
    }

    for (const request of purchases) {
        if (!request.storekeeper_verified_at) continue;
        const actorName = request.storekeeper_verified_by
            ? (namesById.get(request.storekeeper_verified_by) ?? "Storekeeper")
            : "Storekeeper";
        const actorRole = request.storekeeper_verified_by
            ? (rolesById.get(request.storekeeper_verified_by) ?? "storekeeper")
            : "storekeeper";
        const lines = purchaseItems
            .filter((line) => line.request_id === request.id)
            .map((line) => ({
                item_id: line.item_id,
                quantity: Number(line.received_stock_quantity ?? 0),
            }));

        if (
            !hasRelatedAction(
                existingEvents,
                ["receipt_confirmed", "request_received", "received"],
                "purchase",
                request.id
            )
        ) {
            addEvent({
                id: `reconstructed:receipt:${request.id}`,
                created_at: request.storekeeper_verified_at,
                actor_id: request.storekeeper_verified_by,
                actor_name: actorName,
                actor_role: actorRole,
                action_type: "receipt_confirmed",
                action_label: "Receipt confirmed",
                entity_type: "purchase_request",
                entity_id: request.id,
                purchase_request_id: request.id,
                stock_out_request_id: null,
                stock_check_id: null,
                item_id: null,
                summary: `Receipt confirmed for Purchase Request #${request.id}`,
                details: lineDetails(lines, itemsById, "+"),
                quantity_change: null,
            });
        }

        if (
            lines.some((line) => line.quantity > 0) &&
            !hasRelatedAction(existingEvents, ["stock_added"], "purchase", request.id)
        ) {
            addEvent({
                id: `reconstructed:stock-added:${request.id}`,
                created_at: request.storekeeper_verified_at,
                actor_id: request.storekeeper_verified_by,
                actor_name: actorName,
                actor_role: actorRole,
                action_type: "stock_added",
                action_label: "Stock added to inventory",
                entity_type: "purchase_request",
                entity_id: request.id,
                purchase_request_id: request.id,
                stock_out_request_id: null,
                stock_check_id: null,
                item_id: null,
                summary: `Stock added from Purchase Request #${request.id}`,
                details: lineDetails(lines, itemsById, "+"),
                quantity_change: lines.reduce((sum, line) => sum + line.quantity, 0),
            });
        }
    }

    for (const request of stockOutRequests) {
        if (!request.storekeeper_confirmed_at) continue;
        const actorName = request.storekeeper_confirmed_by
            ? (namesById.get(request.storekeeper_confirmed_by) ?? "Storekeeper")
            : "Storekeeper";
        const actorRole = request.storekeeper_confirmed_by
            ? (rolesById.get(request.storekeeper_confirmed_by) ?? "storekeeper")
            : "storekeeper";
        const lines = stockOutItems
            .filter((line) => line.request_id === request.id)
            .map((line) => ({
                item_id: line.item_id,
                quantity: Number(line.issued_quantity ?? 0),
            }));
        const details = lineDetails(lines, itemsById);

        if (
            !hasRelatedAction(
                existingEvents,
                ["handed_out", "stock_out_confirmed"],
                "stock-out",
                request.id
            )
        ) {
            addEvent({
                id: `reconstructed:handed-out:${request.id}`,
                created_at: request.storekeeper_confirmed_at,
                actor_id: request.storekeeper_confirmed_by,
                actor_name: actorName,
                actor_role: actorRole,
                action_type: "stock_handed_out",
                action_label: "Stock handed out",
                entity_type: "stock_out_request",
                entity_id: request.id,
                purchase_request_id: null,
                stock_out_request_id: request.id,
                stock_check_id: null,
                item_id: null,
                summary: `Stock handed out for Stock Request #${request.id}`,
                details,
                quantity_change: null,
            });
        }

        if (
            lines.some((line) => line.quantity > 0) &&
            !hasRelatedAction(existingEvents, ["stock_removed"], "stock-out", request.id)
        ) {
            addEvent({
                id: `reconstructed:stock-removed:${request.id}`,
                created_at: request.storekeeper_confirmed_at,
                actor_id: request.storekeeper_confirmed_by,
                actor_name: actorName,
                actor_role: actorRole,
                action_type: "stock_removed",
                action_label: "Stock removed from inventory",
                entity_type: "stock_out_request",
                entity_id: request.id,
                purchase_request_id: null,
                stock_out_request_id: request.id,
                stock_check_id: null,
                item_id: null,
                summary: `Stock removed for Stock Request #${request.id}`,
                details: lineDetails(lines, itemsById, "−"),
                quantity_change: -lines.reduce(
                    (sum, line) => sum + line.quantity,
                    0
                ),
            });
        }
    }

    for (const check of stockChecks) {
        const actorName = namesById.get(check.completed_by) ?? "Owner";
        const differences = stockCheckItems.filter(
            (item) =>
                item.stock_check_id === check.id && Number(item.variance) !== 0
        );

        if (
            !hasRelatedAction(existingEvents, ["stock_check_completed"], "stock-check", check.id)
        ) {
            addEvent({
                id: `reconstructed:stock-check:${check.id}`,
                created_at: check.completed_at,
                actor_id: check.completed_by,
                actor_name: actorName,
                actor_role: "owner",
                action_type: "stock_check_completed",
                action_label: "Stock check completed",
                entity_type: "stock_check",
                entity_id: check.id,
                purchase_request_id: null,
                stock_out_request_id: null,
                stock_check_id: check.id,
                item_id: null,
                summary: `Stock Check #${check.id} completed`,
                details: `${differences.length} ${differences.length === 1 ? "discrepancy" : "discrepancies"} found.`,
                quantity_change: null,
            });
        }

        if (
            differences.length > 0 &&
            !hasRelatedAction(existingEvents, ["discrepancy"], "stock-check", check.id)
        ) {
            const details = differences
                .map(
                    (item) =>
                        `${item.item_name}: expected ${formatQuantity(Number(item.expected_quantity), item.unit)}, counted ${formatQuantity(Number(item.physical_quantity), item.unit)}, variance ${Number(item.variance) > 0 ? "+" : ""}${Number(item.variance)}`
                )
                .join("\n");
            addEvent({
                id: `reconstructed:discrepancy:${check.id}`,
                created_at: check.completed_at,
                actor_id: check.completed_by,
                actor_name: actorName,
                actor_role: "owner",
                action_type: "stock_discrepancy_found",
                action_label: "Stock discrepancy found",
                entity_type: "stock_check",
                entity_id: check.id,
                purchase_request_id: null,
                stock_out_request_id: null,
                stock_check_id: check.id,
                item_id: null,
                summary: `${differences.length} ${differences.length === 1 ? "stock discrepancy" : "stock discrepancies"} found in Stock Check #${check.id}`,
                details,
                quantity_change: null,
            });
        }

        if (
            differences.length > 0 &&
            !hasRelatedAction(existingEvents, ["inventory_corrected"], "stock-check", check.id)
        ) {
            addEvent({
                id: `reconstructed:corrected:${check.id}`,
                created_at: check.completed_at,
                actor_id: check.completed_by,
                actor_name: actorName,
                actor_role: "owner",
                action_type: "inventory_corrected",
                action_label: "Inventory corrected after stock check",
                entity_type: "stock_check",
                entity_id: check.id,
                purchase_request_id: null,
                stock_out_request_id: null,
                stock_check_id: check.id,
                item_id: null,
                summary: `Inventory corrected after Stock Check #${check.id}`,
                details: differences
                    .map(
                        (item) =>
                            `${item.item_name}: ${formatQuantity(Number(item.expected_quantity), item.unit)} → ${formatQuantity(Number(item.physical_quantity), item.unit)}`
                    )
                    .join("\n"),
                quantity_change: differences.reduce(
                    (sum, item) => sum + Number(item.variance),
                    0
                ),
            });
        }
    }

    return reconstructed;
}
