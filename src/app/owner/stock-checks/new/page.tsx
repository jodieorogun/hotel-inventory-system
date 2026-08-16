"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/app-header";
import ListSearch from "@/components/list-search";
import { supabase } from "@/lib/supabase";
import { formatStockCheckQuantity } from "@/lib/stock-checks";
import { pluralizeUnit } from "@/lib/units";

type InventoryItem = {
    id: number;
    name: string;
    category: string;
    current_quantity: number | string;
    unit: string;
};

type UnlistedItem = {
    id: string;
    name: string;
    category: string;
    unit: string;
    purchaseUnit: string;
    unitsPerPurchaseUnit: string;
    physicalQuantity: string;
};

function isValidCount(value: string, allowZero = true) {
    if (value.trim() === "" || !Number.isFinite(Number(value))) {
        return false;
    }

    return allowZero ? Number(value) >= 0 : Number(value) > 0;
}

function isDecimalInput(value: string) {
    return /^\d*(?:\.\d*)?$/.test(value);
}

function isValidConversion(value: string) {
    return isValidCount(value, false) && Number(value) >= 1;
}

export default function NewStockCheckPage() {
    const router = useRouter();
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [physicalCounts, setPhysicalCounts] = useState<Record<number, string>>({});
    const [unlistedItems, setUnlistedItems] = useState<UnlistedItem[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    useEffect(() => {
        let ignore = false;

        async function loadInventory() {
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
                .from("items")
                .select("id, name, category, current_quantity, unit")
                .order("name");

            if (error) {
                console.error("Error loading inventory for stock check:", error);
                if (!ignore) {
                    setErrorMessage("Could not load the inventory items.");
                    setLoading(false);
                }
                return;
            }

            if (!ignore) {
                setItems((data ?? []) as InventoryItem[]);
                setLoading(false);
            }
        }

        loadInventory();

        return () => {
            ignore = true;
        };
    }, [router]);

    const countedItems = useMemo(
        () =>
            items.filter((item) => {
                const value = physicalCounts[item.id];
                return value !== undefined && isValidCount(value);
            }),
        [items, physicalCounts]
    );
    const existingDiscrepancyCount = countedItems.filter(
        (item) =>
            Number(physicalCounts[item.id]) !== Number(item.current_quantity)
    ).length;
    const completeUnlistedItems = unlistedItems.filter(
        (item) =>
            item.name.trim() &&
            item.category.trim() &&
            item.unit.trim() &&
            item.purchaseUnit.trim() &&
            isValidConversion(item.unitsPerPurchaseUnit) &&
            isValidCount(item.physicalQuantity, false)
    );
    const discrepancyCount =
        existingDiscrepancyCount + completeUnlistedItems.length;
    const normalizedSearch = searchQuery.trim().toLowerCase();
    const filteredItems = items.filter(
        (item) =>
            !normalizedSearch ||
            item.name.toLowerCase().includes(normalizedSearch) ||
            item.category.toLowerCase().includes(normalizedSearch)
    );

    function addUnlistedItem() {
        setUnlistedItems((current) => [
            ...current,
            {
                id: crypto.randomUUID(),
                name: "",
                category: "",
                unit: "",
                purchaseUnit: "",
                unitsPerPurchaseUnit: "1",
                physicalQuantity: "",
            },
        ]);
    }

    function updateUnlistedItem(
        id: string,
        field: keyof Omit<UnlistedItem, "id">,
        value: string
    ) {
        setUnlistedItems((current) =>
            current.map((item) =>
                item.id === id ? { ...item, [field]: value } : item
            )
        );
    }

    function removeUnlistedItem(id: string) {
        setUnlistedItems((current) =>
            current.filter((item) => item.id !== id)
        );
    }

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setErrorMessage("");

        if (countedItems.length !== items.length) {
            setErrorMessage(
                `Enter a physical count for every item. ${items.length - countedItems.length} ${items.length - countedItems.length === 1 ? "item is" : "items are"} still missing.`
            );
            window.scrollTo({ top: 0, behavior: "smooth" });
            return;
        }

        if (completeUnlistedItems.length !== unlistedItems.length) {
            setErrorMessage(
                "Complete the name, category, stock unit, purchase unit, pack size and physical count for every unlisted item, or remove the unfinished entry."
            );
            window.scrollTo({ top: 0, behavior: "smooth" });
            return;
        }

        const existingNames = new Set(
            items.map((item) => item.name.trim().toLowerCase())
        );
        const unlistedNames = completeUnlistedItems.map((item) =>
            item.name.trim().toLowerCase()
        );

        if (
            unlistedNames.some((name) => existingNames.has(name)) ||
            new Set(unlistedNames).size !== unlistedNames.length
        ) {
            setErrorMessage(
                "An unlisted item has the same name as another item. Use the existing item count or remove the duplicate."
            );
            window.scrollTo({ top: 0, behavior: "smooth" });
            return;
        }

        const confirmed = window.confirm(
            `Submit this stock check? ${discrepancyCount} ${discrepancyCount === 1 ? "item has" : "items have"} a difference. Inventory will be updated to the physical counts.`
        );

        if (!confirmed) {
            return;
        }

        setSubmitting(true);
        const { data, error } = await supabase.rpc("complete_stock_check", {
            counted_items: items.map((item) => ({
                item_id: item.id,
                physical_quantity: Number(physicalCounts[item.id]),
            })),
            unlisted_items: completeUnlistedItems.map((item) => ({
                name: item.name.trim(),
                category: item.category.trim(),
                unit: item.unit.trim(),
                purchase_unit: item.purchaseUnit.trim(),
                units_per_purchase_unit: Number(item.unitsPerPurchaseUnit),
                physical_quantity: Number(item.physicalQuantity),
            })),
        });

        if (error || data === null) {
            console.error("Error completing stock check:", error);
            setErrorMessage(
                error?.message ?? "Could not complete the stock check. Please try again."
            );
            setSubmitting(false);
            window.scrollTo({ top: 0, behavior: "smooth" });
            return;
        }

        router.push(`/owner/stock-checks/${data}`);
        router.refresh();
    }

    if (loading) {
        return (
            <main className="app-page">
                <div className="mx-auto max-w-6xl">
                    <AppHeader />
                    <p className="text-muted">Preparing stock check...</p>
                </div>
            </main>
        );
    }

    return (
        <main className="app-page">
            <div className="mx-auto max-w-6xl">
                <AppHeader />

                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h1 className="page-title">New Stock Check</h1>
                        <p className="page-description mt-2 max-w-2xl">
                            Count every item physically present in the store room.
                        </p>
                    </div>
                    <Link href="/owner/stock-checks" className="secondary-action">
                        Cancel Check
                    </Link>
                </div>

                {errorMessage && (
                    <p className="error-message mt-8" role="alert">
                        {errorMessage}
                    </p>
                )}

                <div className="surface-card mt-8 grid gap-5 p-6 sm:grid-cols-3">
                    <div>
                        <p className="text-muted text-sm">Counted</p>
                        <p className="mt-1 text-2xl font-semibold">
                            {countedItems.length} of {items.length}
                        </p>
                    </div>
                    <div>
                        <p className="text-muted text-sm">Still to count</p>
                        <p className="mt-1 text-2xl font-semibold">
                            {items.length - countedItems.length}
                        </p>
                    </div>
                    <div>
                        <p className="text-muted text-sm">Differences so far</p>
                        <p className="mt-1 text-2xl font-semibold">{discrepancyCount}</p>
                    </div>
                </div>

                <ListSearch
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Find an item to count"
                    className="mt-8 max-w-xl"
                />

                <form onSubmit={handleSubmit} className="mt-5">
                    <div className="space-y-4">
                        {filteredItems.map((item) => {
                            const count = physicalCounts[item.id] ?? "";
                            const hasCount = isValidCount(count);
                            const expected = Number(item.current_quantity);
                            const variance = hasCount ? Number(count) - expected : null;

                            return (
                                <article
                                    key={item.id}
                                    className="surface-card grid gap-5 p-6 md:grid-cols-[minmax(0,1.5fr)_minmax(9rem,0.7fr)_minmax(11rem,0.8fr)_minmax(8rem,0.6fr)] md:items-center"
                                >
                                    <div>
                                        <h2 className="text-lg font-semibold">{item.name}</h2>
                                        <p className="text-muted mt-1 text-sm">{item.category}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted text-sm">System quantity</p>
                                        <p className="mt-1 font-semibold">
                                            {formatStockCheckQuantity(expected)} {pluralizeUnit(item.unit, expected)}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="form-label" htmlFor={`physical-${item.id}`}>
                                            Physical count ({pluralizeUnit(item.unit, 2)})
                                        </label>
                                        <input
                                            id={`physical-${item.id}`}
                                            type="text"
                                            inputMode="decimal"
                                            value={count}
                                            onChange={(event) => {
                                                if (isDecimalInput(event.target.value)) {
                                                    setPhysicalCounts((current) => ({
                                                        ...current,
                                                        [item.id]: event.target.value,
                                                    }));
                                                }
                                            }}
                                            className="form-control"
                                            placeholder="Enter count"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <p className="text-muted text-sm">Variance</p>
                                        <p
                                            className={`mt-1 text-lg font-semibold ${
                                                variance === null || variance === 0
                                                    ? "text-[var(--foreground)]"
                                                    : variance < 0
                                                      ? "text-[var(--danger)]"
                                                      : "text-amber-700 dark:text-amber-300"
                                            }`}
                                        >
                                            {variance === null
                                                ? "—"
                                                : `${variance > 0 ? "+" : ""}${formatStockCheckQuantity(variance)}`}
                                        </p>
                                    </div>
                                </article>
                            );
                        })}

                        {filteredItems.length === 0 && (
                            <div className="surface-card p-8 text-center">
                                <p className="text-muted">No inventory items match that search.</p>
                            </div>
                        )}
                    </div>

                    <section className="mt-10">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <h2 className="text-xl font-semibold">Items Not Listed</h2>
                                <p className="text-muted mt-1 text-sm">
                                    Add anything found in the store room that is not already shown above.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={addUnlistedItem}
                                className="secondary-action"
                            >
                                Add Unlisted Item
                            </button>
                        </div>

                        {unlistedItems.length === 0 ? (
                            <div className="surface-card mt-4 p-6">
                                <p className="text-muted text-sm">
                                    Nothing extra found? You can leave this section empty.
                                </p>
                            </div>
                        ) : (
                            <div className="mt-4 space-y-4">
                                {unlistedItems.map((item, index) => (
                                    <article key={item.id} className="surface-card p-6">
                                        <div className="flex items-start justify-between gap-4">
                                            <h3 className="text-lg font-semibold">
                                                Unlisted Item {index + 1}
                                            </h3>
                                            <button
                                                type="button"
                                                onClick={() => removeUnlistedItem(item.id)}
                                                className="text-sm font-semibold text-[var(--danger)] hover:underline"
                                            >
                                                Remove
                                            </button>
                                        </div>

                                        <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                                            <div>
                                                <label className="form-label" htmlFor={`unlisted-name-${item.id}`}>
                                                    Item name
                                                </label>
                                                <input
                                                    id={`unlisted-name-${item.id}`}
                                                    type="text"
                                                    value={item.name}
                                                    onChange={(event) =>
                                                        updateUnlistedItem(item.id, "name", event.target.value)
                                                    }
                                                    className="form-control"
                                                    placeholder="e.g. Hand Soap"
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="form-label" htmlFor={`unlisted-category-${item.id}`}>
                                                    Category
                                                </label>
                                                <input
                                                    id={`unlisted-category-${item.id}`}
                                                    type="text"
                                                    value={item.category}
                                                    onChange={(event) =>
                                                        updateUnlistedItem(item.id, "category", event.target.value)
                                                    }
                                                    className="form-control"
                                                    placeholder="e.g. Cleaning"
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="form-label" htmlFor={`unlisted-unit-${item.id}`}>
                                                    Stock unit
                                                </label>
                                                <input
                                                    id={`unlisted-unit-${item.id}`}
                                                    type="text"
                                                    value={item.unit}
                                                    onChange={(event) =>
                                                        updateUnlistedItem(item.id, "unit", event.target.value)
                                                    }
                                                    className="form-control"
                                                    placeholder="e.g. bottle"
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="form-label" htmlFor={`unlisted-count-${item.id}`}>
                                                    Usual purchase unit
                                                </label>
                                                <input
                                                    id={`unlisted-purchase-unit-${item.id}`}
                                                    type="text"
                                                    value={item.purchaseUnit}
                                                    onChange={(event) =>
                                                        updateUnlistedItem(
                                                            item.id,
                                                            "purchaseUnit",
                                                            event.target.value
                                                        )
                                                    }
                                                    className="form-control"
                                                    placeholder="e.g. carton"
                                                    required
                                                />
                                                <p className="text-muted mt-2 text-sm">
                                                    How this item is normally bought.
                                                </p>
                                            </div>
                                            <div>
                                                <label className="form-label" htmlFor={`unlisted-pack-size-${item.id}`}>
                                                    Stock units in one purchase unit
                                                </label>
                                                <input
                                                    id={`unlisted-pack-size-${item.id}`}
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={item.unitsPerPurchaseUnit}
                                                    onChange={(event) => {
                                                        if (isDecimalInput(event.target.value)) {
                                                            updateUnlistedItem(
                                                                item.id,
                                                                "unitsPerPurchaseUnit",
                                                                event.target.value
                                                            );
                                                        }
                                                    }}
                                                    className="form-control"
                                                    placeholder="e.g. 12"
                                                    required
                                                />
                                                {item.unit.trim() &&
                                                    item.purchaseUnit.trim() &&
                                                    isValidConversion(item.unitsPerPurchaseUnit) && (
                                                        <p className="text-muted mt-2 text-sm">
                                                            1 {item.purchaseUnit.trim()} = {formatStockCheckQuantity(Number(item.unitsPerPurchaseUnit))} {pluralizeUnit(item.unit.trim(), Number(item.unitsPerPurchaseUnit))}
                                                        </p>
                                                    )}
                                            </div>
                                            <div>
                                                <label className="form-label" htmlFor={`unlisted-count-${item.id}`}>
                                                    Physical count in {item.unit.trim() ? pluralizeUnit(item.unit.trim(), 2) : "stock units"}
                                                </label>
                                                <input
                                                    id={`unlisted-count-${item.id}`}
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={item.physicalQuantity}
                                                    onChange={(event) => {
                                                        if (isDecimalInput(event.target.value)) {
                                                            updateUnlistedItem(
                                                                item.id,
                                                                "physicalQuantity",
                                                                event.target.value
                                                            );
                                                        }
                                                    }}
                                                    className="form-control"
                                                    placeholder="Enter total stock units"
                                                    required
                                                />
                                                {isValidCount(item.physicalQuantity, false) && (
                                                    <p className="mt-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
                                                        Variance: +{formatStockCheckQuantity(Number(item.physicalQuantity))}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}
                    </section>

                    <div className="surface-card sticky bottom-4 mt-6 flex flex-col gap-4 p-5 shadow-xl sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-muted text-sm">
                            Submitting permanently saves this check and adjusts inventory.
                        </p>
                        <button
                            type="submit"
                            className="primary-action shrink-0"
                            disabled={submitting || (items.length === 0 && unlistedItems.length === 0)}
                        >
                            {submitting ? "Submitting..." : "Complete Stock Check"}
                        </button>
                    </div>
                </form>
            </div>
        </main>
    );
}
