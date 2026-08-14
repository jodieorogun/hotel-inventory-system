"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/app-header";
import RequestListFilters, {
    DateFilterValue,
    matchesDateFilter,
} from "@/components/request-list-filters";
import { supabase } from "@/lib/supabase";

type PurchaseRequest = {
    id: number;
    status: string;
    createdAt: string;
    reviewedAt: string | null;
    decision: "pending" | "approved" | "rejected";
    requestedBy: string;
    lines: RequestLine[];
};

type RequestLine = {
    id: number;
    requestId: number;
    quantity: number;
    unitPrice: number;
};

type RequestRow = {
    id: number;
    status: string;
    created_at: string;
    requested_by: string;
    accountant_approved_by: string | null;
    accountant_approved_at: string | null;
    owner_escalated_at: string | null;
};

type RequestLineRow = {
    id: number;
    request_id: number;
    quantity: number | string;
    unit_price: number | string;
};

type UserRow = {
    id: string;
    name: string;
};

const currencyFormatter = new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
});

const decisionDetails = {
    pending: {
        label: "Pending",
        className:
            "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
    },
    approved: {
        label: "Approved",
        className:
            "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
    },
    rejected: {
        label: "Rejected",
        className:
            "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
    },
};

function formatDate(value: string) {
    return new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
    }).format(new Date(value));
}

export default function AccountantRequestsPage() {
    const router = useRouter();
    const [requests, setRequests] = useState<PurchaseRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState("");
    const [activeTab, setActiveTab] = useState("pending");
    const [dateFilter, setDateFilter] = useState<DateFilterValue>("any");
    const [pickedDate, setPickedDate] = useState("");

    useEffect(() => {
        let ignore = false;

        async function loadRequests() {
            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser();

            if (userError || !user) {
                router.replace("/login");
                return;
            }

            const requestedTab = new URLSearchParams(
                window.location.search
            ).get("tab");

            if (
                ["pending", "approved", "rejected", "all"].includes(
                    requestedTab ?? ""
                )
            ) {
                setActiveTab(requestedTab!);
            }

            const { data: profile, error: profileError } = await supabase
                .from("users")
                .select("role")
                .eq("id", user.id)
                .single();

            if (profileError) {
                console.error("Error checking accountant role:", profileError);

                if (!ignore) {
                    setErrorMessage("Could not verify your account permissions.");
                    setLoading(false);
                }

                return;
            }

            if (!["accountant", "owner"].includes(profile.role)) {
                router.replace("/dashboard");
                return;
            }

            const { data: requestData, error: requestsError } = await supabase
                .from("purchase_requests")
                .select(
                    "id, status, created_at, requested_by, accountant_approved_by, accountant_approved_at, owner_escalated_at"
                )
                .or(
                    `status.eq.pending_accountant,accountant_approved_by.eq.${user.id}`
                )
                .order("created_at", { ascending: false });

            if (requestsError) {
                console.error("Error loading purchase requests:", requestsError);

                if (!ignore) {
                    setErrorMessage("Could not load the purchase requests.");
                    setLoading(false);
                }

                return;
            }

            const requestRows = (requestData ?? []) as RequestRow[];

            if (requestRows.length === 0) {
                if (!ignore) {
                    setRequests([]);
                    setLoading(false);
                }

                return;
            }

            const requestIds = requestRows.map((request) => request.id);
            const requesterIds = [
                ...new Set(requestRows.map((request) => request.requested_by)),
            ];

            const [linesResult, usersResult] = await Promise.all([
                supabase
                    .from("purchase_requests_items")
                    .select("id, request_id, quantity, unit_price")
                    .in("request_id", requestIds),
                supabase
                    .from("users")
                    .select("id, name")
                    .in("id", requesterIds),
            ]);

            if (linesResult.error || usersResult.error) {
                console.error(
                    "Error loading purchase request details:",
                    linesResult.error ?? usersResult.error
                );

                if (!ignore) {
                    setErrorMessage("Could not load the purchase request details.");
                    setLoading(false);
                }

                return;
            }

            const lineRows = (linesResult.data ?? []) as RequestLineRow[];
            const userRows = (usersResult.data ?? []) as UserRow[];
            const usersById = new Map(
                userRows.map((requester) => [requester.id, requester.name])
            );

            const formattedRequests = requestRows.map((request) => ({
                id: request.id,
                status: request.status,
                createdAt: request.created_at,
                reviewedAt: request.accountant_approved_at,
                decision:
                    request.status === "pending_accountant"
                        ? ("pending" as const)
                        : request.status === "rejected" ||
                            request.owner_escalated_at
                          ? ("rejected" as const)
                          : ("approved" as const),
                requestedBy:
                    usersById.get(request.requested_by) ?? "Procurement user",
                lines: lineRows
                    .filter((line) => line.request_id === request.id)
                    .map((line) => ({
                        id: line.id,
                        requestId: line.request_id,
                        quantity: Number(line.quantity),
                        unitPrice: Number(line.unit_price),
                    })),
            }));

            if (!ignore) {
                setRequests(formattedRequests);
                setLoading(false);
            }
        }

        loadRequests();

        return () => {
            ignore = true;
        };
    }, [router]);

    if (loading) {
        return (
            <main className="app-page">
                <div className="mx-auto max-w-7xl">
                    <AppHeader />
                    <p className="text-muted">Loading purchase requests...</p>
                </div>
            </main>
        );
    }

    const filteredRequests = requests.filter((request) => {
        const matchesTab =
            activeTab === "all" || request.decision === activeTab;
        const eventDate =
            request.decision === "pending"
                ? request.createdAt
                : request.reviewedAt ?? request.createdAt;

        return (
            matchesTab && matchesDateFilter(eventDate, dateFilter, pickedDate)
        );
    });

    function changeTab(tab: string) {
        setActiveTab(tab);
        const url = new URL(window.location.href);
        url.searchParams.set("tab", tab);
        window.history.replaceState(null, "", url);
    }

    return (
        <main className="app-page">
            <div className="mx-auto max-w-7xl">
                <AppHeader />

                <div>
                    <h1 className="page-title">Purchase Approvals</h1>
                    <p className="page-description mt-2">
                        Review pending requests and find previous decisions.
                    </p>
                </div>

                {errorMessage && (
                    <div className="error-message mt-8" role="alert">
                        {errorMessage}
                    </div>
                )}

                {!errorMessage && (
                    <RequestListFilters
                        tabs={[
                            { value: "pending", label: "Pending" },
                            { value: "approved", label: "Approved" },
                            { value: "rejected", label: "Rejected" },
                            { value: "all", label: "All" },
                        ]}
                        activeTab={activeTab}
                        onTabChange={changeTab}
                        dateFilter={dateFilter}
                        onDateFilterChange={setDateFilter}
                        pickedDate={pickedDate}
                        onPickedDateChange={setPickedDate}
                    />
                )}

                {!errorMessage && filteredRequests.length === 0 && (
                    <div className="surface-card mt-8 p-8 text-center">
                        <h2 className="text-xl font-semibold">
                            No matching requests
                        </h2>
                        <p className="text-muted mt-2">
                            Try another status or date filter.
                        </p>
                    </div>
                )}

                {!errorMessage && filteredRequests.length > 0 && (
                    <section className="mt-8" aria-label="Purchase requests">
                        <div className="grid gap-6 lg:grid-cols-2">
                            {filteredRequests.map((request) => {
                                const total = request.lines.reduce(
                                    (sum, line) =>
                                        sum + line.quantity * line.unitPrice,
                                    0
                                );
                                const decision =
                                    decisionDetails[request.decision];

                                return (
                                    <article
                                        key={request.id}
                                        className="surface-card h-full overflow-hidden"
                                    >
                                        <div className="flex flex-col gap-5 p-7 sm:flex-row sm:items-start sm:justify-between">
                                            <div>
                                                <h3 className="text-xl font-semibold">
                                                    Request #{request.id}
                                                </h3>
                                                <p className="text-muted mt-2 text-sm">
                                                    Requested by: {request.requestedBy}
                                                </p>
                                                <p className="text-muted mt-1 text-sm">
                                                    Submitted: {formatDate(request.createdAt)}
                                                </p>
                                                <p className="text-muted mt-1 text-sm">
                                                    {request.lines.length}{" "}
                                                    {request.lines.length === 1
                                                        ? "item"
                                                        : "items"}
                                                </p>
                                            </div>

                                            <div className="sm:text-right">
                                                <span
                                                    className={`inline-flex rounded-full border px-3 py-1 text-sm font-medium ${decision.className}`}
                                                >
                                                    {decision.label}
                                                </span>
                                                <p className="mt-3 text-xl font-semibold">
                                                    {currencyFormatter.format(total)}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="border-t border-[var(--border)] p-5">
                                            <Link
                                                href={`/accountant/requests/${request.id}`}
                                                className={`${
                                                    request.decision === "pending"
                                                        ? "primary-action"
                                                        : "secondary-action"
                                                } w-full text-center`}
                                            >
                                                {request.decision === "pending"
                                                    ? "Review Request"
                                                    : "View Request"}
                                            </Link>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    </section>
                )}
            </div>
        </main>
    );
}
