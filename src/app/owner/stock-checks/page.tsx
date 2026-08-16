"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/app-header";
import { supabase } from "@/lib/supabase";
import {
    formatStockCheckDate,
    formatStockCheckDateTime,
    getNextStockCheckDate,
    isStockCheckDue,
} from "@/lib/stock-checks";

type StockCheckRow = {
    id: number;
    completed_at: string;
    completed_by: string;
    total_items: number;
    matched_items: number;
    discrepancy_items: number;
};

type StockCheck = StockCheckRow & {
    completedByName: string;
};

type UserRow = {
    id: string;
    name: string;
};

export default function StockChecksPage() {
    const router = useRouter();
    const [checks, setChecks] = useState<StockCheck[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState("");

    useEffect(() => {
        let ignore = false;

        async function loadStockChecks() {
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
                console.error("Error checking stock-check permissions:", profileError);
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

            const { data, error } = await supabase
                .from("stock_checks")
                .select(
                    "id, completed_at, completed_by, total_items, matched_items, discrepancy_items"
                )
                .order("completed_at", { ascending: false });

            if (error) {
                console.error("Error loading stock checks:", error);
                if (!ignore) {
                    setErrorMessage("Could not load stock-check history.");
                    setLoading(false);
                }
                return;
            }

            const rows = (data ?? []) as StockCheckRow[];
            const userIds = [...new Set(rows.map((check) => check.completed_by))];
            let users: UserRow[] = [];

            if (userIds.length > 0) {
                const { data: userData, error: usersError } = await supabase
                    .from("users")
                    .select("id, name")
                    .in("id", userIds);

                if (usersError) {
                    console.error("Error loading stock-check owners:", usersError);
                } else {
                    users = (userData ?? []) as UserRow[];
                }
            }

            const usersById = new Map(users.map((owner) => [owner.id, owner.name]));

            if (!ignore) {
                setChecks(
                    rows.map((check) => ({
                        ...check,
                        completedByName:
                            usersById.get(check.completed_by) ?? "Owner",
                    }))
                );
                setLoading(false);
            }
        }

        loadStockChecks();

        return () => {
            ignore = true;
        };
    }, [router]);

    if (loading) {
        return (
            <main className="app-page">
                <div className="mx-auto max-w-7xl">
                    <AppHeader />
                    <p className="text-muted">Loading stock checks...</p>
                </div>
            </main>
        );
    }

    const latestCheck = checks[0] ?? null;
    const due = isStockCheckDue(latestCheck?.completed_at ?? null);
    const nextCheckDate = latestCheck
        ? getNextStockCheckDate(latestCheck.completed_at)
        : null;

    return (
        <main className="app-page">
            <div className="mx-auto max-w-7xl">
                <AppHeader />

                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h1 className="page-title">Stock Checks</h1>
                        <p className="page-description mt-2 max-w-2xl">
                            Compare the system inventory with what is physically in
                            the store room.
                        </p>
                    </div>
                    <Link href="/owner/stock-checks/new" className="primary-action">
                        Start Stock Check
                    </Link>
                </div>

                {errorMessage && (
                    <p className="error-message mt-8" role="alert">
                        {errorMessage}
                    </p>
                )}

                {!errorMessage && (
                    <>
                        <section
                            className={`surface-card mt-8 overflow-hidden border-l-4 ${
                                due
                                    ? "border-l-amber-400 dark:border-l-amber-300"
                                    : "border-l-emerald-500 dark:border-l-emerald-400"
                            }`}
                        >
                            <div className="grid gap-6 p-7 md:grid-cols-[1.3fr_1fr_1fr] md:items-center">
                                <div>
                                    <p className="text-muted text-xs font-semibold uppercase tracking-[0.12em]">
                                        Weekly stock check
                                    </p>
                                    <h2 className="mt-2 text-2xl font-semibold">
                                        {due ? "A stock check is due" : "Stock check is up to date"}
                                    </h2>
                                    <p className="text-muted mt-2 text-sm">
                                        You can carry out an additional check at any time.
                                    </p>
                                </div>
                                <div>
                                    <p className="text-muted text-sm">Last completed</p>
                                    <p className="mt-1 font-semibold">
                                        {latestCheck
                                            ? formatStockCheckDateTime(latestCheck.completed_at)
                                            : "No checks yet"}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-muted text-sm">Next check due</p>
                                    <p className="mt-1 font-semibold">
                                        {nextCheckDate
                                            ? formatStockCheckDate(nextCheckDate)
                                            : "Due now"}
                                    </p>
                                </div>
                            </div>
                        </section>

                        <section className="mt-12">
                            <h2 className="text-xl font-semibold">Previous Checks</h2>
                            <p className="text-muted mt-1 text-sm">
                                Completed checks are kept permanently for reference.
                            </p>

                            {checks.length === 0 ? (
                                <div className="surface-card mt-4 p-8 text-center">
                                    <p className="font-medium">No stock checks completed yet.</p>
                                    <p className="text-muted mt-2 text-sm">
                                        Start the first check when you are ready to count the store room.
                                    </p>
                                </div>
                            ) : (
                                <div className="mt-4 grid gap-5 lg:grid-cols-2">
                                    {checks.map((check) => (
                                        <Link
                                            key={check.id}
                                            href={`/owner/stock-checks/${check.id}`}
                                            className="surface-card interactive-card p-6"
                                        >
                                            <div className="flex items-start justify-between gap-4">
                                                <div>
                                                    <h3 className="text-lg font-semibold">
                                                        Stock Check #{check.id}
                                                    </h3>
                                                    <p className="text-muted mt-1 text-sm">
                                                        {formatStockCheckDateTime(check.completed_at)} · {check.completedByName}
                                                    </p>
                                                </div>
                                                <span
                                                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                                        check.discrepancy_items > 0
                                                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                                            : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                                    }`}
                                                >
                                                    {check.discrepancy_items > 0
                                                        ? `${check.discrepancy_items} ${check.discrepancy_items === 1 ? "difference" : "differences"}`
                                                        : "All matched"}
                                                </span>
                                            </div>
                                            <div className="mt-5 grid grid-cols-2 gap-4 border-t border-[var(--border)] pt-4 text-sm">
                                                <div>
                                                    <p className="text-muted">Items counted</p>
                                                    <p className="mt-1 font-semibold">{check.total_items}</p>
                                                </div>
                                                <div>
                                                    <p className="text-muted">Items matched</p>
                                                    <p className="mt-1 font-semibold">{check.matched_items}</p>
                                                </div>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </section>
                    </>
                )}
            </div>
        </main>
    );
}
