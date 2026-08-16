export type AuditableEvent = {
    id: number | string;
    created_at: string;
    actor_id: string | null;
    actor_name: string;
    action_type: string;
    entity_type: string;
    entity_id: number | null;
    purchase_request_id: number | null;
    stock_out_request_id: number | null;
    stock_check_id: number | null;
    item_id: number | null;
    details: string | null;
};

export type AuditRequestType = "all" | "purchase" | "stock-out";

function eventIdentity(event: AuditableEvent) {
    return [
        event.action_type.trim().toLowerCase(),
        event.actor_id ?? event.actor_name.trim().toLowerCase(),
        event.created_at,
        event.entity_type,
        event.entity_id ?? "",
        event.purchase_request_id ?? "",
        event.stock_out_request_id ?? "",
        event.stock_check_id ?? "",
        event.item_id ?? "",
    ].join("|");
}

export function deduplicateAuditEvents<T extends AuditableEvent>(events: T[]) {
    const uniqueEvents = new Map<string, T>();

    for (const event of events) {
        const key = eventIdentity(event);
        const existing = uniqueEvents.get(key);

        if (
            !existing ||
            (event.details?.trim().length ?? 0) >
                (existing.details?.trim().length ?? 0)
        ) {
            uniqueEvents.set(key, event);
        }
    }

    return [...uniqueEvents.values()].sort(
        (first, second) =>
            new Date(second.created_at).getTime() -
                new Date(first.created_at).getTime() ||
            String(second.id).localeCompare(String(first.id), undefined, {
                numeric: true,
            })
    );
}

export function matchesAuditRequest(
    event: Pick<AuditableEvent, "purchase_request_id" | "stock_out_request_id">,
    value: string,
    requestType: AuditRequestType
) {
    const normalized = value.trim().replace(/^#/, "");

    if (!normalized) {
        return true;
    }

    const prefixedMatch = normalized.match(/^(pr|sr)\s*[-#]?\s*(\d+)$/i);
    const id = prefixedMatch?.[2] ?? normalized;
    const explicitType = prefixedMatch?.[1]?.toLowerCase();
    const effectiveType =
        explicitType === "pr"
            ? "purchase"
            : explicitType === "sr"
              ? "stock-out"
              : requestType;

    if (!/^\d+$/.test(id)) {
        return false;
    }

    return (
        (effectiveType !== "stock-out" &&
            String(event.purchase_request_id ?? "") === id) ||
        (effectiveType !== "purchase" &&
            String(event.stock_out_request_id ?? "") === id)
    );
}
