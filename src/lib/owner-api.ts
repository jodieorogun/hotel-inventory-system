import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function requireOwner(request: Request) {
    const authorization = request.headers.get("authorization");
    const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];

    if (!accessToken) {
        return { ok: false, error: "Please sign in again.", status: 401 } as const;
    }

    let admin;

    try {
        admin = getSupabaseAdmin();
    } catch (error) {
        return {
            ok: false,
            error:
                error instanceof Error
                    ? error.message
                    : "User Management has not been configured yet.",
            status: 503,
        } as const;
    }

    const { data: authData, error: authError } =
        await admin.auth.getUser(accessToken);

    if (authError || !authData.user) {
        return { ok: false, error: "Please sign in again.", status: 401 } as const;
    }

    const bannedUntil = authData.user.banned_until
        ? new Date(authData.user.banned_until).getTime()
        : 0;

    if (bannedUntil > Date.now()) {
        return { ok: false, error: "This account is deactivated.", status: 403 } as const;
    }

    const { data: profile, error: profileError } = await admin
        .from("users")
        .select("role")
        .eq("id", authData.user.id)
        .maybeSingle();

    if (profileError || profile?.role !== "owner") {
        return { ok: false, error: "Owner access is required.", status: 403 } as const;
    }

    return { ok: true, admin, user: authData.user } as const;
}

export function errorResponse(error: string, status: number) {
    return Response.json({ error }, { status });
}
