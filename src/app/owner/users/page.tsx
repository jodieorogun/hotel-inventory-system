"use client";

import { useEffect, useMemo, useState } from "react";
import AppHeader from "@/components/app-header";
import ListSearch from "@/components/list-search";
import { supabase } from "@/lib/supabase";
import {
    formatStaffRole,
    isStaffRole,
    staffRoleLabels,
    staffRoles,
    type StaffRole,
} from "@/lib/staff-roles";

type ManagedUser = {
    id: string;
    name: string;
    email: string;
    role: string;
    status: "active" | "deactivated" | "invite_pending";
    createdAt: string;
    isCurrentUser: boolean;
};

type ApiResponse = {
    users?: ManagedUser[];
    message?: string;
    error?: string;
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
});

const statusDetails = {
    active: {
        label: "Active",
        className:
            "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
    },
    deactivated: {
        label: "Deactivated",
        className:
            "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
    },
    invite_pending: {
        label: "Invite Sent",
        className:
            "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
    },
};

async function ownerApi(path: string, init?: RequestInit) {
    const {
        data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
        throw new Error("Please sign in again.");
    }

    const response = await fetch(path, {
        ...init,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            ...init?.headers,
        },
    });
    const result = (await response.json()) as ApiResponse;

    if (!response.ok) {
        throw new Error(result.error ?? "The user action could not be completed.");
    }

    return result;
}

export default function OwnerUsersPage() {
    const [users, setUsers] = useState<ManagedUser[]>([]);
    const [draftRoles, setDraftRoles] = useState<Record<string, StaffRole>>({});
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [role, setRole] = useState<StaffRole>("housekeeper");
    const [workingAction, setWorkingAction] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    async function loadUsers() {
        setLoading(true);
        setErrorMessage("");

        try {
            const result = await ownerApi("/api/owner/users");
            const loadedUsers = result.users ?? [];
            setUsers(loadedUsers);
            setDraftRoles(
                Object.fromEntries(
                    loadedUsers.map((user) => [
                        user.id,
                        isStaffRole(user.role) ? user.role : "housekeeper",
                    ])
                )
            );
        } catch (error) {
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : "Could not load staff accounts."
            );
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        async function initialLoad() {
            await loadUsers();
        }

        initialLoad();
    }, []);

    const filteredUsers = useMemo(() => {
        const search = searchQuery.trim().toLowerCase();

        return users.filter(
            (user) =>
                !search ||
                user.name.toLowerCase().includes(search) ||
                user.email.toLowerCase().includes(search) ||
                formatStaffRole(user.role).toLowerCase().includes(search)
        );
    }, [searchQuery, users]);

    function clearMessages() {
        setErrorMessage("");
        setSuccessMessage("");
    }

    async function addUser(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        clearMessages();
        setWorkingAction("add");

        try {
            const result = await ownerApi("/api/owner/users", {
                method: "POST",
                body: JSON.stringify({ name, email, role }),
            });
            setSuccessMessage(result.message ?? "Staff invitation sent.");
            setName("");
            setEmail("");
            setRole("housekeeper");
            setShowAddForm(false);
            await loadUsers();
        } catch (error) {
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : "Could not add this staff member."
            );
        } finally {
            setWorkingAction("");
        }
    }

    async function runUserAction(
        user: ManagedUser,
        action: "change_role" | "deactivate" | "reactivate" | "resend_invite"
    ) {
        clearMessages();

        if (
            action === "deactivate" &&
            !window.confirm(
                `Deactivate ${user.name}? They will no longer be able to access the system.`
            )
        ) {
            return;
        }

        if (
            action === "change_role" &&
            !window.confirm(
                `Change ${user.name}'s role to ${staffRoleLabels[draftRoles[user.id]]}?`
            )
        ) {
            return;
        }

        const actionKey = `${action}:${user.id}`;
        setWorkingAction(actionKey);

        try {
            const result = await ownerApi("/api/owner/users", {
                method: "PATCH",
                body: JSON.stringify({
                    userId: user.id,
                    action,
                    role:
                        action === "change_role"
                            ? draftRoles[user.id]
                            : undefined,
                }),
            });
            setSuccessMessage(result.message ?? "Staff account updated.");
            await loadUsers();
        } catch (error) {
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : "Could not update this staff account."
            );
        } finally {
            setWorkingAction("");
        }
    }

    return (
        <main className="app-page">
            <div className="mx-auto max-w-7xl">
                <AppHeader />

                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h1 className="page-title">Staff</h1>
                        <p className="page-description mt-2 max-w-2xl">
                            Add staff, change their access, or deactivate accounts when someone leaves.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            clearMessages();
                            setShowAddForm((visible) => !visible);
                        }}
                        className="primary-action"
                    >
                        {showAddForm ? "Cancel" : "Add Staff"}
                    </button>
                </div>

                {errorMessage && (
                    <p className="error-message mt-7" role="alert">
                        {errorMessage}
                    </p>
                )}
                {successMessage && (
                    <p
                        className="mt-7 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                        role="status"
                    >
                        {successMessage}
                    </p>
                )}

                {showAddForm && (
                    <form onSubmit={addUser} className="surface-card mt-7 p-6 lg:p-7">
                        <h2 className="text-xl font-semibold">Add Staff Member</h2>
                        <p className="text-muted mt-1 text-sm">
                            They will receive an email to set up their own password.
                        </p>
                        <div className="mt-5 grid gap-5 md:grid-cols-3">
                            <div>
                                <label className="form-label" htmlFor="staff-name">Name</label>
                                <input
                                    id="staff-name"
                                    type="text"
                                    value={name}
                                    onChange={(event) => setName(event.target.value)}
                                    className="form-control"
                                    autoComplete="name"
                                    required
                                />
                            </div>
                            <div>
                                <label className="form-label" htmlFor="staff-email">Email</label>
                                <input
                                    id="staff-email"
                                    type="email"
                                    value={email}
                                    onChange={(event) => setEmail(event.target.value)}
                                    className="form-control"
                                    autoComplete="email"
                                    required
                                />
                            </div>
                            <div>
                                <label className="form-label" htmlFor="staff-role">Role</label>
                                <select
                                    id="staff-role"
                                    value={role}
                                    onChange={(event) => setRole(event.target.value as StaffRole)}
                                    className="form-control"
                                >
                                    {staffRoles.map((option) => (
                                        <option key={option} value={option}>
                                            {staffRoleLabels[option]}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={workingAction === "add"}
                            className="primary-action mt-5"
                        >
                            {workingAction === "add" ? "Sending Invitation..." : "Send Invitation"}
                        </button>
                    </form>
                )}

                <ListSearch
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Search staff by name, email or role"
                    className="mt-8 max-w-xl"
                />

                {loading ? (
                    <p className="text-muted mt-8">Loading staff accounts...</p>
                ) : filteredUsers.length === 0 ? (
                    <div className="surface-card mt-6 p-8 text-center">
                        <h2 className="text-xl font-semibold">No staff found</h2>
                        <p className="text-muted mt-2">Try another search or add a user.</p>
                    </div>
                ) : (
                    <section className="mt-6 space-y-4" aria-label="Staff accounts">
                        {filteredUsers.map((user) => {
                            const status = statusDetails[user.status];
                            const roleChanged = draftRoles[user.id] !== user.role;

                            return (
                                <article key={user.id} className="surface-card p-6 lg:p-7">
                                    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_11rem_13rem_12rem] lg:items-center xl:grid-cols-[minmax(0,1fr)_14rem_16rem_14rem]">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-3">
                                                <h2 className="truncate text-lg font-semibold">{user.name}</h2>
                                                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${status.className}`}>
                                                    {status.label}
                                                </span>
                                                {user.isCurrentUser && (
                                                    <span className="text-muted text-xs">Your account</span>
                                                )}
                                            </div>
                                            <p className="text-muted mt-1 break-all text-sm">{user.email}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted text-xs">Date added</p>
                                            <p className="mt-1 text-sm font-medium">{dateFormatter.format(new Date(user.createdAt))}</p>
                                        </div>
                                        <div>
                                            {user.isCurrentUser ? (
                                                <>
                                                    <p className="form-label">Role</p>
                                                    <div
                                                        className="form-control flex items-center bg-[var(--surface-subtle)] font-medium"
                                                        aria-label={`Role: ${formatStaffRole(user.role)}`}
                                                    >
                                                        {formatStaffRole(user.role)}
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <label className="form-label" htmlFor={`role-${user.id}`}>Role</label>
                                                    <select
                                                        id={`role-${user.id}`}
                                                        value={draftRoles[user.id]}
                                                        onChange={(event) =>
                                                            setDraftRoles((current) => ({
                                                                ...current,
                                                                [user.id]: event.target.value as StaffRole,
                                                            }))
                                                        }
                                                        className="form-control"
                                                    >
                                                        {staffRoles.map((option) => (
                                                            <option key={option} value={option}>
                                                                {staffRoleLabels[option]}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap gap-2 lg:min-h-[4.75rem] lg:max-w-64 lg:content-start lg:justify-end">
                                            {roleChanged && !user.isCurrentUser && (
                                                <button
                                                    type="button"
                                                    onClick={() => runUserAction(user, "change_role")}
                                                    disabled={Boolean(workingAction)}
                                                    className="primary-action"
                                                >
                                                    {workingAction === `change_role:${user.id}` ? "Saving..." : "Save Role"}
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => runUserAction(user, "resend_invite")}
                                                disabled={Boolean(workingAction)}
                                                className="secondary-action"
                                            >
                                                {workingAction === `resend_invite:${user.id}` ? "Sending..." : "Send Password Link"}
                                            </button>
                                            {!user.isCurrentUser && (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        runUserAction(
                                                            user,
                                                            user.status === "deactivated" ? "reactivate" : "deactivate"
                                                        )
                                                    }
                                                    disabled={Boolean(workingAction)}
                                                    className={user.status === "deactivated" ? "secondary-action" : "text-sm font-semibold text-[var(--danger)] hover:underline"}
                                                >
                                                    {workingAction === `${user.status === "deactivated" ? "reactivate" : "deactivate"}:${user.id}`
                                                        ? "Updating..."
                                                        : user.status === "deactivated"
                                                          ? "Reactivate"
                                                          : "Deactivate"}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </section>
                )}
            </div>
        </main>
    );
}
