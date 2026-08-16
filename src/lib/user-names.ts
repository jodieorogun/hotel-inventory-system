import { supabase } from "@/lib/supabase";

type UserNameRow = {
    id: string;
    name: string;
};

type AuditNameRow = {
    actor_id: string | null;
    actor_name: string;
};

export async function loadVisibleUserNames(userIds: Array<string | null>) {
    const uniqueIds = [
        ...new Set(userIds.filter((id): id is string => Boolean(id))),
    ];
    const namesById = new Map<string, string>();

    if (uniqueIds.length === 0) {
        return namesById;
    }

    const { data: users, error: usersError } = await supabase
        .from("users")
        .select("id, name")
        .in("id", uniqueIds);

    if (usersError) {
        console.warn("Could not load all user profiles:", usersError);
    } else {
        for (const user of (users ?? []) as UserNameRow[]) {
            namesById.set(user.id, user.name);
        }
    }

    const missingIds = uniqueIds.filter((id) => !namesById.has(id));

    if (missingIds.length === 0) {
        return namesById;
    }

    const { data: auditNames, error: auditError } = await supabase
        .from("audit_events")
        .select("actor_id, actor_name")
        .in("actor_id", missingIds)
        .order("created_at", { ascending: false });

    if (auditError) {
        console.warn("Could not load audit name snapshots:", auditError);
        return namesById;
    }

    for (const event of (auditNames ?? []) as AuditNameRow[]) {
        if (event.actor_id && !namesById.has(event.actor_id)) {
            namesById.set(event.actor_id, event.actor_name);
        }
    }

    return namesById;
}
