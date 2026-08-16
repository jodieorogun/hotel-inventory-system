"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/app-header";
import {
    matchesDateFilter,
    type DateFilterValue,
} from "@/components/request-list-filters";
import { supabase } from "@/lib/supabase";
import {
    deduplicateAuditEvents,
    matchesAuditRequest,
    type AuditRequestType,
} from "@/lib/audit-events";
import {
    reconstructHistoricalAuditEvents,
    type ReconstructedAuditEvent,
} from "@/lib/audit-reconstruction";
import { formatStaffRole } from "@/lib/staff-roles";

type AuditEvent = ReconstructedAuditEvent & {
    action_label: string;
};

const dateOptions: { value: DateFilterValue; label: string }[] = [
    { value: "any", label: "Any Date" },
    { value: "today", label: "Today" },
    { value: "yesterday", label: "Yesterday" },
    { value: "last7", label: "Last 7 Days" },
    { value: "date", label: "Pick Date" },
];

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
});

function roleLabel(role: string) {
    return formatStaffRole(role);
}

function eventLink(event: AuditEvent) {
    if (event.purchase_request_id) {
        return {
            href: `/owner/requests/${event.purchase_request_id}`,
            label: `Purchase Request #${event.purchase_request_id}`,
        };
    }

    if (event.stock_out_request_id) {
        return {
            href: `/storekeeper/stock-out/${event.stock_out_request_id}`,
            label: `Stock Request #${event.stock_out_request_id}`,
        };
    }

    if (event.stock_check_id) {
        return {
            href: `/owner/stock-checks/${event.stock_check_id}`,
            label: `Stock Check #${event.stock_check_id}`,
        };
    }

    if (event.item_id) {
        return {
            href: `/inventory/${event.item_id}`,
            label: `Inventory Item #${event.item_id}`,
        };
    }

    return null;
}

function eventColour(actionType: string) {
    if (
        actionType.includes("rejected") ||
        actionType.includes("voided") ||
        actionType.includes("issue") ||
        actionType.includes("discrepancy")
    ) {
        return "bg-red-500 dark:bg-red-400";
    }

    if (
        actionType.includes("approved") ||
        actionType.includes("confirmed") ||
        actionType.includes("completed") ||
        actionType.includes("added") ||
        actionType.includes("handed_out")
    ) {
        return "bg-emerald-500 dark:bg-emerald-400";
    }

    if (
        actionType.includes("removed") ||
        actionType.includes("corrected") ||
        actionType.includes("returned")
    ) {
        return "bg-amber-400 dark:bg-amber-300";
    }

    return "bg-sky-500 dark:bg-sky-400";
}

export default function AuditTrailPage() {
    const router = useRouter();
    const [events, setEvents] = useState<AuditEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState("");
    const [dateFilter, setDateFilter] = useState<DateFilterValue>("last7");
    const [pickedDate, setPickedDate] = useState("");
    const [selectedUser, setSelectedUser] = useState("all");
    const [selectedAction, setSelectedAction] = useState("all");
    const [requestType, setRequestType] =
        useState<AuditRequestType>("all");
    const [requestId, setRequestId] = useState("");

    useEffect(() => {
        let ignore = false;

        async function loadAuditTrail() {
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
                console.error("Error checking audit permissions:", profileError);
                if (!ignore) {
                    setErrorMessage("Could not verify your account permissions.");
                    setLoading(false);
                }
                return;
            }

            if (profile.role !== "owner") {
                router.replace("/dashboard");
                return;
            }

            const pageSize = 1000;
            const auditRows: AuditEvent[] = [];

            for (let from = 0; ; from += pageSize) {
                const { data, error } = await supabase
                    .from("audit_events")
                    .select(
                        "id, created_at, actor_id, actor_name, actor_role, action_type, action_label, entity_type, entity_id, purchase_request_id, stock_out_request_id, stock_check_id, item_id, summary, details, quantity_change"
                    )
                    .order("created_at", { ascending: false })
                    .order("id", { ascending: false })
                    .range(from, from + pageSize - 1);

                if (error) {
                    console.error("Error loading audit trail:", error);
                    if (!ignore) {
                        setErrorMessage("Could not load the audit trail.");
                        setLoading(false);
                    }
                    return;
                }

                const page = (data ?? []) as AuditEvent[];
                auditRows.push(...page);

                if (page.length < pageSize) {
                    break;
                }
            }

            if (!ignore) {
                const uniqueRows = deduplicateAuditEvents(auditRows);
                const reconstructed = await reconstructHistoricalAuditEvents(
                    uniqueRows
                );

                if (ignore) {
                    return;
                }

                setEvents(
                    deduplicateAuditEvents([...uniqueRows, ...reconstructed])
                );
                setLoading(false);
            }
        }

        loadAuditTrail();

        return () => {
            ignore = true;
        };
    }, [router]);

    const userOptions = useMemo(() => {
        const options = new Map<string, string>();
        for (const event of events) {
            options.set(
                event.actor_id ?? `${event.actor_role}:${event.actor_name}`,
                `${event.actor_name} · ${roleLabel(event.actor_role)}`
            );
        }
        return [...options.entries()].sort((first, second) =>
            first[1].localeCompare(second[1])
        );
    }, [events]);

    const actionOptions = useMemo(() => {
        const options = new Map<string, string>();
        for (const event of events) {
            options.set(event.action_type, event.action_label);
        }
        return [...options.entries()].sort((first, second) =>
            first[1].localeCompare(second[1])
        );
    }, [events]);

    const filteredEvents = events.filter((event) => {
        const eventUserKey =
            event.actor_id ?? `${event.actor_role}:${event.actor_name}`;
        const matchesUser =
            selectedUser === "all" || eventUserKey === selectedUser;
        const matchesAction =
            selectedAction === "all" || event.action_type === selectedAction;
        const matchesRequest = matchesAuditRequest(
            event,
            requestId,
            requestType
        );

        return (
            matchesUser &&
            matchesAction &&
            matchesRequest &&
            matchesDateFilter(event.created_at, dateFilter, pickedDate)
        );
    });

    if (loading) {
        return (
            <main className="app-page">
                <div className="mx-auto max-w-6xl">
                    <AppHeader />
                    <p className="text-muted">Loading activity history...</p>
                </div>
            </main>
        );
    }

    return (
        <main className="app-page">
            <div className="mx-auto max-w-6xl">
                <AppHeader />

                <div>
                    <h1 className="page-title">Activity History</h1>
                    <p className="page-description mt-2 max-w-2xl">
                        A permanent, read-only record of important inventory and workflow activity.
                    </p>
                </div>

                {errorMessage && (
                    <p className="error-message mt-8" role="alert">
                        {errorMessage}
                    </p>
                )}

                {!errorMessage && (
                    <>
                        <section className="surface-card mt-8 p-5" aria-label="Activity filters">
                            <div className="flex flex-wrap gap-2">
                                {dateOptions.map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => setDateFilter(option.value)}
                                        aria-pressed={dateFilter === option.value}
                                        className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                                            dateFilter === option.value
                                                ? "border-[var(--foreground)] bg-[var(--surface-subtle)] text-[var(--foreground)]"
                                                : "border-[var(--border)] text-[var(--muted-strong)] hover:bg-[var(--surface-hover)]"
                                        }`}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                                {dateFilter === "date" && (
                                    <input
                                        type="date"
                                        value={pickedDate}
                                        onChange={(event) => setPickedDate(event.target.value)}
                                        aria-label="Choose audit date"
                                        className="form-control w-auto"
                                        autoFocus
                                    />
                                )}
                            </div>

                            <div className="mt-5 grid gap-4 border-t border-[var(--border)] pt-5 md:grid-cols-2 xl:grid-cols-4">
                                <div>
                                    <label className="form-label" htmlFor="audit-user">User</label>
                                    <select
                                        id="audit-user"
                                        value={selectedUser}
                                        onChange={(event) => setSelectedUser(event.target.value)}
                                        className="form-control"
                                    >
                                        <option value="all">All users</option>
                                        {userOptions.map(([value, label]) => (
                                            <option key={value} value={value}>{label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="form-label" htmlFor="audit-action">Action</label>
                                    <select
                                        id="audit-action"
                                        value={selectedAction}
                                        onChange={(event) => setSelectedAction(event.target.value)}
                                        className="form-control"
                                    >
                                        <option value="all">All actions</option>
                                        {actionOptions.map(([value, label]) => (
                                            <option key={value} value={value}>{label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="form-label" htmlFor="audit-request-type">Request type</label>
                                    <select
                                        id="audit-request-type"
                                        value={requestType}
                                        onChange={(event) =>
                                            setRequestType(event.target.value as AuditRequestType)
                                        }
                                        className="form-control"
                                    >
                                        <option value="all">Purchase or stock request</option>
                                        <option value="purchase">Purchase request</option>
                                        <option value="stock-out">Stock request</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="form-label" htmlFor="audit-request">Request ID</label>
                                    <input
                                        id="audit-request"
                                        type="text"
                                        inputMode="numeric"
                                        value={requestId}
                                        onChange={(event) => setRequestId(event.target.value)}
                                        className="form-control"
                                        placeholder="e.g. 17, PR-17 or SR-17"
                                    />
                                </div>
                            </div>
                        </section>

                        <div className="mt-8 flex items-center justify-between gap-4">
                            <h2 className="text-xl font-semibold">Activity</h2>
                            <p className="text-muted text-sm">
                                {filteredEvents.length} {filteredEvents.length === 1 ? "entry" : "entries"}
                            </p>
                        </div>

                        {filteredEvents.length === 0 ? (
                            <div className="surface-card mt-4 p-8 text-center">
                                <p className="font-medium">No activity matches these filters.</p>
                                <p className="text-muted mt-2 text-sm">Try another date, user, action or request number.</p>
                            </div>
                        ) : (
                            <ol className="surface-card mt-4 overflow-hidden">
                                {filteredEvents.map((event) => {
                                    const relatedLink = eventLink(event);
                                    return (
                                        <li key={event.id} className="border-b border-[var(--border)] p-6 last:border-b-0">
                                            <div className="flex gap-4">
                                                <span aria-hidden="true" className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${eventColour(event.action_type)}`} />
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                                                        <p className="text-sm font-semibold">
                                                            {roleLabel(event.actor_role)} — {event.actor_name}
                                                        </p>
                                                        <time className="text-muted shrink-0 text-sm" dateTime={event.created_at}>
                                                            {dateTimeFormatter.format(new Date(event.created_at))}
                                                        </time>
                                                    </div>
                                                    <h3 className="mt-2 text-lg font-semibold">{event.summary}</h3>
                                                    {event.details && (
                                                        <p className="text-muted mt-2 whitespace-pre-wrap text-sm">{event.details}</p>
                                                    )}
                                                    {relatedLink && (
                                                        <Link href={relatedLink.href} className="mt-3 inline-flex text-sm font-semibold text-[var(--accent)] hover:underline">
                                                            Open {relatedLink.label} →
                                                        </Link>
                                                    )}
                                                </div>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ol>
                        )}
                    </>
                )}
            </div>
        </main>
    );
}
