import type { RequestHistoryEntry } from "@/components/request-history";
import { supabase } from "@/lib/supabase";

type RequestEventRow = {
    action: string;
    actor_id: string | null;
    created_at: string;
    detail: string | null;
};

type AuditEventRow = {
    action_label: string;
    actor_name: string;
    created_at: string;
    details: string | null;
};

type UserRow = {
    id: string;
    name: string;
};

const actionLabels: Record<string, string> = {
    requested: "Requested",
    approved: "Approved",
    rejected: "Rejected",
    modified_and_resubmitted: "Modified and resubmitted",
    escalated_to_owner: "Escalated to Owner",
    owner_approved: "Approved by Owner",
    owner_rejected: "Rejected by Owner",
    receipt_issue_reported: "Receipt issue reported",
    returned_to_storekeeper: "Returned to Storekeeper",
    actual_quantity_accepted: "Actual quantity accepted",
    received: "Received",
    voided: "Voided",
};

export async function loadRequestHistory(
    requestId: number
): Promise<RequestHistoryEntry[]> {
    const { data: auditData, error: auditError } = await supabase
        .from("audit_events")
        .select("action_label, actor_name, created_at, details")
        .eq("purchase_request_id", requestId)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true });

    if (!auditError && auditData && auditData.length > 0) {
        return (auditData as AuditEventRow[]).map((event) => ({
            action: event.action_label,
            person: event.actor_name,
            timestamp: event.created_at,
            detail: event.details,
        }));
    }

    if (auditError) {
        console.warn("Could not load the request audit trail:", auditError);
    }

    const { data, error } = await supabase
        .from("purchase_request_events")
        .select("action, actor_id, created_at, detail")
        .eq("request_id", requestId)
        .order("created_at", { ascending: true });

    if (error) {
        console.warn("Could not load durable request history:", error);
        return [];
    }

    const events = (data ?? []) as RequestEventRow[];
    const actorIds = [
        ...new Set(
            events
                .map((event) => event.actor_id)
                .filter((id): id is string => Boolean(id))
        ),
    ];
    const usersById = new Map<string, string>();

    if (actorIds.length > 0) {
        const { data: users, error: usersError } = await supabase
            .from("users")
            .select("id, name")
            .in("id", actorIds);

        if (usersError) {
            console.warn("Could not load request history names:", usersError);
        } else {
            for (const user of (users ?? []) as UserRow[]) {
                usersById.set(user.id, user.name);
            }
        }
    }

    return events.map((event) => ({
        action:
            actionLabels[event.action] ?? event.action.replaceAll("_", " "),
        person: event.actor_id
            ? (usersById.get(event.actor_id) ?? "Hotel staff")
            : "System",
        timestamp: event.created_at,
        detail: event.detail,
    }));
}
