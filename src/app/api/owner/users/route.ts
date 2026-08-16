import { errorResponse, requireOwner } from "@/lib/owner-api";
import { isStaffRole } from "@/lib/staff-roles";
import type { SupabaseClient, User } from "@supabase/supabase-js";

type ProfileRow = {
    id: string;
    name: string;
    email: string;
    role: string;
};

type UserActionBody = {
    userId?: unknown;
    action?: unknown;
    role?: unknown;
};

function normalizeEmail(value: unknown) {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isDeactivated(bannedUntil?: string) {
    return Boolean(
        bannedUntil && new Date(bannedUntil).getTime() > Date.now()
    );
}

function redirectUrl(request: Request) {
    return `${new URL(request.url).origin}/setup-password`;
}

async function listAllAuthUsers(admin: SupabaseClient) {
    const users: User[] = [];
    const perPage = 1000;

    for (let page = 1; ; page += 1) {
        const result = await admin.auth.admin.listUsers({ page, perPage });

        if (result.error) {
            throw result.error;
        }

        users.push(...result.data.users);

        if (result.data.users.length < perPage) {
            break;
        }
    }

    return users;
}

export async function GET(request: Request) {
    const owner = await requireOwner(request);

    if (!owner.ok) {
        return errorResponse(owner.error, owner.status);
    }

    try {
        const [authUsers, profilesResult] = await Promise.all([
            listAllAuthUsers(owner.admin),
            owner.admin.from("users").select("id, name, email, role"),
        ]);

        if (profilesResult.error) {
            return errorResponse("Could not load staff profiles.", 500);
        }

        const profilesById = new Map(
            ((profilesResult.data ?? []) as ProfileRow[]).map((profile) => [
                profile.id,
                profile,
            ])
        );

        // Earlier versions could save the selected role in Auth metadata but
        // leave the public profile on its trigger default. Reconcile those
        // accounts from the server-controlled metadata when the Owner opens
        // User Management.
        for (const authUser of authUsers) {
            const savedRole = authUser.app_metadata?.staff_role;
            const profile = profilesById.get(authUser.id);

            if (
                isStaffRole(savedRole) &&
                authUser.email &&
                profile?.role !== savedRole
            ) {
                const repairedName =
                    profile?.name ??
                    (typeof authUser.user_metadata?.name === "string"
                        ? authUser.user_metadata.name
                        : authUser.email?.split("@")[0] ?? "Staff member");
                const { data: repairedProfile, error: repairError } =
                    await owner.admin
                        .from("users")
                        .upsert({
                            id: authUser.id,
                            name: repairedName,
                            email: authUser.email,
                            role: savedRole,
                        })
                        .select("id, name, email, role")
                        .single();

                if (repairError) {
                    console.error(
                        "Could not reconcile staff profile role:",
                        repairError
                    );
                } else {
                    profilesById.set(
                        authUser.id,
                        repairedProfile as ProfileRow
                    );
                }
            }
        }

        const users = authUsers
            .map((user) => {
                const profile = profilesById.get(user.id);
                const deactivated = isDeactivated(user.banned_until);

                return {
                    id: user.id,
                    name:
                        profile?.name ??
                        (typeof user.user_metadata?.name === "string"
                            ? user.user_metadata.name
                            : user.email?.split("@")[0] ?? "Staff member"),
                    email: user.email ?? "Email unavailable",
                    role: profile?.role ?? "unassigned",
                    status: deactivated
                        ? "deactivated"
                        : user.email_confirmed_at
                          ? "active"
                          : "invite_pending",
                    createdAt: user.created_at,
                    isCurrentUser: user.id === owner.user.id,
                };
            })
            .sort((first, second) => first.name.localeCompare(second.name));

        return Response.json({ users });
    } catch (error) {
        console.error("Error listing staff accounts:", error);
        return errorResponse("Could not load staff accounts.", 500);
    }
}

export async function POST(request: Request) {
    const owner = await requireOwner(request);

    if (!owner.ok) {
        return errorResponse(owner.error, owner.status);
    }

    let body: { name?: unknown; email?: unknown; role?: unknown };

    try {
        body = await request.json();
    } catch {
        return errorResponse("Enter the new staff member's details.", 400);
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = normalizeEmail(body.email);

    if (name.length < 2 || name.length > 80) {
        return errorResponse("Enter the staff member's full name.", 400);
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
        return errorResponse("Enter a valid email address.", 400);
    }

    if (!isStaffRole(body.role)) {
        return errorResponse("Choose a valid staff role.", 400);
    }

    const { data, error } = await owner.admin.auth.admin.inviteUserByEmail(
        email,
        {
            data: { name, role: body.role },
            redirectTo: redirectUrl(request),
        }
    );

    if (error || !data.user) {
        console.error("Error inviting staff member:", error);
        const authMessage = error?.message.toLowerCase() ?? "";

        if (authMessage.includes("already")) {
            return errorResponse(
                "An account with this email address already exists.",
                400
            );
        }

        if (
            authMessage.includes("sending invite email") ||
            authMessage.includes("smtp")
        ) {
            return errorResponse(
                "Supabase could not send the invitation email. Ask the system administrator to check the SMTP username, SMTP key and verified sender address.",
                502
            );
        }

        return errorResponse("Could not send the staff invitation.", 502);
    }

    const { error: metadataError } =
        await owner.admin.auth.admin.updateUserById(data.user.id, {
            app_metadata: {
                ...data.user.app_metadata,
                staff_role: body.role,
            },
            user_metadata: { ...data.user.user_metadata, name },
        });

    if (metadataError) {
        console.error("Could not save staff role metadata:", metadataError);
        return errorResponse(
            "The invitation was sent, but the selected role could not be saved.",
            500
        );
    }

    const { data: savedProfile, error: profileError } = await owner.admin
        .from("users")
        .upsert({
            id: data.user.id,
            name,
            email,
            role: body.role,
        })
        .select("role")
        .single();

    if (profileError || savedProfile?.role !== body.role) {
        console.error("Error creating staff profile:", profileError);
        return errorResponse(
            "The invitation was sent, but the selected role was not saved. Open the user and save their role again.",
            500
        );
    }

    return Response.json(
        { message: `Invitation sent to ${email}.` },
        { status: 201 }
    );
}

export async function PATCH(request: Request) {
    const owner = await requireOwner(request);

    if (!owner.ok) {
        return errorResponse(owner.error, owner.status);
    }

    let body: UserActionBody;

    try {
        body = await request.json();
    } catch {
        return errorResponse("Choose a valid user action.", 400);
    }

    const userId = typeof body.userId === "string" ? body.userId : "";
    const action = typeof body.action === "string" ? body.action : "";

    if (!userId) {
        return errorResponse("The staff account could not be identified.", 400);
    }

    if (
        userId === owner.user.id &&
        ["change_role", "deactivate"].includes(action)
    ) {
        return errorResponse(
            "You cannot change your own Owner access or deactivate your own account.",
            400
        );
    }

    const { data: targetResult, error: targetError } =
        await owner.admin.auth.admin.getUserById(userId);

    if (targetError || !targetResult.user) {
        return errorResponse("This staff account could not be found.", 404);
    }

    if (action === "change_role") {
        if (!isStaffRole(body.role)) {
            return errorResponse("Choose a valid staff role.", 400);
        }

        if (!targetResult.user.email) {
            return errorResponse(
                "This staff account does not have an email address.",
                400
            );
        }

        const { data: currentProfile } = await owner.admin
            .from("users")
            .select("role")
            .eq("id", userId)
            .maybeSingle();
        const previousRole = currentProfile?.role;
        const { error: metadataError } =
            await owner.admin.auth.admin.updateUserById(userId, {
                app_metadata: {
                    ...targetResult.user.app_metadata,
                    staff_role: body.role,
                },
            });

        if (metadataError) {
            console.error("Error updating staff metadata:", metadataError);
            return errorResponse("Could not change this staff member's role.", 500);
        }

        const { data: savedProfile, error: profileError } = await owner.admin
            .from("users")
            .upsert({
                id: userId,
                name:
                    typeof targetResult.user.user_metadata?.name === "string"
                        ? targetResult.user.user_metadata.name
                        : targetResult.user.email?.split("@")[0] ?? "Staff member",
                email: targetResult.user.email,
                role: body.role,
            })
            .select("role")
            .single();

        if (profileError || savedProfile?.role !== body.role) {
            if (isStaffRole(previousRole)) {
                await owner.admin.auth.admin.updateUserById(userId, {
                    app_metadata: {
                        ...targetResult.user.app_metadata,
                        staff_role: previousRole,
                    },
                });
            }
            console.error("Error updating staff profile:", profileError);
            return errorResponse("Could not change this staff member's role.", 500);
        }

        return Response.json({ message: "Role updated." });
    }

    if (action === "deactivate" || action === "reactivate") {
        const { error } = await owner.admin.auth.admin.updateUserById(userId, {
            ban_duration: action === "deactivate" ? "876000h" : "none",
        });

        if (error) {
            console.error(`Error trying to ${action} staff account:`, error);
            return errorResponse(`Could not ${action} this staff account.`, 500);
        }

        return Response.json({
            message:
                action === "deactivate"
                    ? "Staff account deactivated."
                    : "Staff account reactivated.",
        });
    }

    if (action === "resend_invite") {
        const email = targetResult.user.email;

        if (!email) {
            return errorResponse("This account does not have an email address.", 400);
        }

        let sendError = null;

        if (!targetResult.user.email_confirmed_at) {
            const result = await owner.admin.auth.admin.inviteUserByEmail(
                email,
                { redirectTo: redirectUrl(request) }
            );
            sendError = result.error;
        } else {
            const result = await owner.admin.auth.resetPasswordForEmail(email, {
                redirectTo: redirectUrl(request),
            });
            sendError = result.error;
        }

        if (sendError) {
            console.error("Error resending password setup email:", sendError);
            return errorResponse("Could not send the password setup email.", 500);
        }

        return Response.json({ message: `Password setup email sent to ${email}.` });
    }

    return errorResponse("Choose a valid user action.", 400);
}
