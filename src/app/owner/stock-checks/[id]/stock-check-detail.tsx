"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/app-header";
import { supabase } from "@/lib/supabase";
import {
    formatStockCheckDateTime,
    formatStockCheckQuantity,
} from "@/lib/stock-checks";
import { pluralizeUnit } from "@/lib/units";

type StockCheckRow = {
    id: number;
    completed_at: string;
    completed_by: string;
    total_items: number;
    matched_items: number;
    discrepancy_items: number;
};

type StockCheckItem = {
    id: number;
    item_id: number | null;
    item_name: string;
    unit: string;
    expected_quantity: number | string;
    physical_quantity: number | string;
    variance: number | string;
};

export default function StockCheckDetail({
    stockCheckId,
}: {
    stockCheckId: string;
}) {
    const router = useRouter();
    const [check, setCheck] = useState<StockCheckRow | null>(null);
    const [items, setItems] = useState<StockCheckItem[]>([]);
    const [completedByName, setCompletedByName] = useState("Owner");
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState("");

    useEffect(() => {
        let ignore = false;

        async function loadStockCheck() {
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

            if (profileError || profile?.role !== "owner") {
                if (profileError) {
                    console.error("Error checking stock-check permissions:", profileError);
                }
                router.replace("/dashboard");
                return;
            }

            const numericId = Number(stockCheckId);
            if (!Number.isInteger(numericId) || numericId <= 0) {
                setErrorMessage("This stock check could not be found.");
                setLoading(false);
                return;
            }

            const [checkResult, itemsResult] = await Promise.all([
                supabase
                    .from("stock_checks")
                    .select(
                        "id, completed_at, completed_by, total_items, matched_items, discrepancy_items"
                    )
                    .eq("id", numericId)
                    .single(),
                supabase
                    .from("stock_check_items")
                    .select(
                        "id, item_id, item_name, unit, expected_quantity, physical_quantity, variance"
                    )
                    .eq("stock_check_id", numericId)
                    .order("item_name"),
            ]);

            if (checkResult.error || itemsResult.error) {
                console.error(
                    "Error loading stock-check report:",
                    checkResult.error ?? itemsResult.error
                );
                if (!ignore) {
                    setErrorMessage("This stock-check report could not be loaded.");
                    setLoading(false);
                }
                return;
            }

            const checkRow = checkResult.data as StockCheckRow;
            const { data: ownerData, error: ownerError } = await supabase
                .from("users")
                .select("name")
                .eq("id", checkRow.completed_by)
                .maybeSingle();

            if (ownerError) {
                console.error("Error loading stock-check owner:", ownerError);
            }

            if (!ignore) {
                setCheck(checkRow);
                setItems((itemsResult.data ?? []) as StockCheckItem[]);
                setCompletedByName(ownerData?.name ?? "Owner");
                setLoading(false);
            }
        }

        loadStockCheck();

        return () => {
            ignore = true;
        };
    }, [router, stockCheckId]);

    if (loading) {
        return (
            <main className="app-page">
                <div className="mx-auto max-w-7xl">
                    <AppHeader />
                    <p className="text-muted">Loading stock-check report...</p>
                </div>
            </main>
        );
    }

    if (errorMessage || !check) {
        return (
            <main className="app-page">
                <div className="mx-auto max-w-7xl">
                    <AppHeader />
                    <p className="error-message" role="alert">
                        {errorMessage || "This stock check could not be found."}
                    </p>
                    <Link href="/owner/stock-checks" className="secondary-action mt-6">
                        Back to Stock Checks
                    </Link>
                </div>
            </main>
        );
    }

    const discrepancies = items.filter((item) => Number(item.variance) !== 0);
    const matches = items.filter((item) => Number(item.variance) === 0);

    function renderTable(rows: StockCheckItem[], emptyMessage: string) {
        if (rows.length === 0) {
            return (
                <div className="surface-card mt-4 p-7 text-center">
                    <p className="text-muted">{emptyMessage}</p>
                </div>
            );
        }

        return (
            <>
                <div className="mt-4 grid gap-4 sm:hidden">
                    {rows.map((item) => {
                        const expected = Number(item.expected_quantity);
                        const physical = Number(item.physical_quantity);
                        const variance = Number(item.variance);

                        return (
                            <article key={item.id} className="surface-card p-5">
                                <div className="flex items-start justify-between gap-4">
                                    <h3 className="min-w-0 font-semibold">
                                        {item.item_name}
                                    </h3>
                                    <span
                                        className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${
                                            variance < 0
                                                ? "bg-[var(--danger-soft)] text-[var(--danger)]"
                                                : variance > 0
                                                  ? "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                                  : "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                        }`}
                                    >
                                        {variance > 0 ? "+" : ""}
                                        {formatStockCheckQuantity(variance)}
                                    </span>
                                </div>

                                <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-[var(--border)] pt-4 text-sm">
                                    <div>
                                        <dt className="text-muted">System quantity</dt>
                                        <dd className="mt-1 font-medium">
                                            {formatStockCheckQuantity(expected)} {pluralizeUnit(item.unit, expected)}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-muted">Physical count</dt>
                                        <dd className="mt-1 font-medium">
                                            {formatStockCheckQuantity(physical)} {pluralizeUnit(item.unit, physical)}
                                        </dd>
                                    </div>
                                </dl>
                            </article>
                        );
                    })}
                </div>

                <div className="surface-card mt-4 hidden overflow-x-auto sm:block">
                <table className="w-full min-w-175">
                    <thead className="bg-[var(--surface-subtle)]">
                        <tr>
                            <th className="px-6 py-4 text-left">Item</th>
                            <th className="px-6 py-4 text-left">System Quantity</th>
                            <th className="px-6 py-4 text-left">Physical Count</th>
                            <th className="px-6 py-4 text-left">Variance</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((item) => {
                            const expected = Number(item.expected_quantity);
                            const physical = Number(item.physical_quantity);
                            const variance = Number(item.variance);

                            return (
                                <tr key={item.id} className="data-row">
                                    <td className="px-6 py-5 font-semibold">{item.item_name}</td>
                                    <td className="px-6 py-5 text-[var(--muted-strong)]">
                                        {formatStockCheckQuantity(expected)} {pluralizeUnit(item.unit, expected)}
                                    </td>
                                    <td className="px-6 py-5 text-[var(--muted-strong)]">
                                        {formatStockCheckQuantity(physical)} {pluralizeUnit(item.unit, physical)}
                                    </td>
                                    <td
                                        className={`px-6 py-5 font-semibold ${
                                            variance < 0
                                                ? "text-[var(--danger)]"
                                                : variance > 0
                                                  ? "text-amber-700 dark:text-amber-300"
                                                  : "text-emerald-700 dark:text-emerald-300"
                                        }`}
                                    >
                                        {variance > 0 ? "+" : ""}
                                        {formatStockCheckQuantity(variance)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                </div>
            </>
        );
    }

    return (
        <main className="app-page">
            <div className="mx-auto max-w-7xl">
                <AppHeader />

                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <p className="text-muted text-sm font-semibold uppercase tracking-[0.12em]">
                            Completed stock check
                        </p>
                        <h1 className="page-title mt-2">Stock Check #{check.id}</h1>
                        <p className="page-description mt-2">
                            {formatStockCheckDateTime(check.completed_at)} · Completed by {completedByName}
                        </p>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row">
                        <Link href="/owner/stock-checks" className="secondary-action">
                            All Stock Checks
                        </Link>
                        <Link href="/owner/stock-checks/new" className="primary-action">
                            Start Another Check
                        </Link>
                    </div>
                </div>

                <section className="mt-8 grid gap-5 sm:grid-cols-3">
                    <div className="surface-card p-6">
                        <p className="text-muted text-sm">Items counted</p>
                        <p className="mt-1 text-3xl font-semibold">{check.total_items}</p>
                    </div>
                    <div className="surface-card p-6">
                        <p className="text-muted text-sm">Matched</p>
                        <p className="mt-1 text-3xl font-semibold text-emerald-700 dark:text-emerald-300">
                            {check.matched_items}
                        </p>
                    </div>
                    <div className="surface-card p-6">
                        <p className="text-muted text-sm">Differences</p>
                        <p className={`mt-1 text-3xl font-semibold ${check.discrepancy_items > 0 ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"}`}>
                            {check.discrepancy_items}
                        </p>
                    </div>
                </section>

                <section className="mt-12">
                    <h2 className="text-xl font-semibold">Discrepancies</h2>
                    <p className="text-muted mt-1 text-sm">
                        Items where the physical count differed from the system quantity.
                    </p>
                    {renderTable(discrepancies, "Every item matched the system quantity.")}
                </section>

                <section className="mt-12">
                    <h2 className="text-xl font-semibold">Matched Items</h2>
                    <p className="text-muted mt-1 text-sm">
                        Items where the physical and system quantities were the same.
                    </p>
                    {renderTable(matches, "No items matched during this check.")}
                </section>
            </div>
        </main>
    );
}
