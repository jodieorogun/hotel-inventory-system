"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/app-header";
import ListSearch from "@/components/list-search";
import { supabase } from "@/lib/supabase";
import { hasPurchaseConversion } from "@/lib/units";

type InventoryItem = {
    id: number;
    name: string;
    category: string;
    current_quantity: number | string;
    unit: string;
    purchase_unit: string;
    units_per_purchase_unit: number | string;
};

export default function InventoryPage() {
    const router = useRouter();
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [filterOpen, setFilterOpen] = useState(false);
    const [isOwner, setIsOwner] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editDraft, setEditDraft] = useState<Partial<InventoryItem>>({});
    const [savingId, setSavingId] = useState<number | null>(null);

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

            const { data: profile } = await supabase
                .from("users")
                .select("role")
                .eq("id", user.id)
                .maybeSingle();
            setIsOwner(profile?.role === "owner");

            const { data, error } = await supabase
                .from("items")
                .select("id, name, category, current_quantity, unit, purchase_unit, units_per_purchase_unit")
                .order("name");

            if (ignore) {
                return;
            }

            if (error) {
                console.error("Error fetching items:", error);
                setErrorMessage("Could not load inventory items.");
            } else {
                setItems((data ?? []) as InventoryItem[]);
            }

            setLoading(false);
        }

        loadInventory();

        return () => {
            ignore = true;
        };
    }, [router]);

    function beginEdit(item: InventoryItem) {
        setEditingId(item.id);
        setEditDraft({ current_quantity: item.current_quantity, unit: item.unit, purchase_unit: item.purchase_unit, units_per_purchase_unit: item.units_per_purchase_unit });
    }

    async function saveEdit(itemId: number) {
        if (!isOwner) return;
        setSavingId(itemId);
        const update = {
            current_quantity: Math.max(0, Number(editDraft.current_quantity) || 0),
            unit: String(editDraft.unit ?? "").trim(),
            purchase_unit: String(editDraft.purchase_unit ?? "").trim(),
            units_per_purchase_unit: Math.max(1, Math.floor(Number(editDraft.units_per_purchase_unit) || 1)),
        };
        if (!update.unit || !update.purchase_unit) {
            setErrorMessage("Stock unit and purchase unit are required.");
            setSavingId(null);
            return;
        }
        const { data, error } = await supabase.from("items").update(update).eq("id", itemId).select("id, name, category, current_quantity, unit, purchase_unit, units_per_purchase_unit").single();
        if (error) {
            setErrorMessage("Could not save this item. Owner access is required.");
        } else {
            setItems((current) => current.map((item) => item.id === itemId ? data as InventoryItem : item));
            setEditingId(null);
        }
        setSavingId(null);
    }

    if (loading) {
        return (
            <main className="app-page">
                <div className="mx-auto max-w-7xl">
                    <AppHeader />
                    <p className="text-muted">Loading inventory...</p>
                </div>
            </main>
        );
    }

    const normalizedSearch = searchQuery.trim().toLowerCase();
    const filteredItems = items.filter(
        (item) =>
            (selectedCategories.length === 0 || selectedCategories.includes(item.category)) &&
            (!normalizedSearch ||
                item.name.toLowerCase().includes(normalizedSearch) ||
                item.category.toLowerCase().includes(normalizedSearch) ||
                item.unit.toLowerCase().includes(normalizedSearch) ||
                item.purchase_unit.toLowerCase().includes(normalizedSearch))
    );

    return (
        <main className="app-page">
            <div className="mx-auto max-w-7xl">
                <AppHeader />

                <h1 className="page-title mb-2">
                    Inventory
                </h1>

                <p className="page-description mb-8">
                    Current hotel stock {isOwner ? "· Owner editing enabled" : "· Read-only"}
                </p>

                {errorMessage && (
                    <p className="error-message mb-6" role="alert">
                        {errorMessage}
                    </p>
                )}

                {!errorMessage && (
                    <>
                        <ListSearch
                            value={searchQuery}
                            onChange={setSearchQuery}
                            placeholder="Search inventory by item, category, or unit"
                            className="mb-5 max-w-xl"
                        />

                    </>
                )}

                <div className="grid gap-4 sm:hidden">
                    {filteredItems.map((item) => (
                        <div
                            key={item.id}
                            className="surface-card interactive-card block p-5"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <h2 className="font-semibold">{item.name}</h2>
                                    <p className="text-muted mt-1 text-sm">
                                        {item.category}
                                    </p>
                                </div>
                                <span className="shrink-0 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-sm font-semibold text-[var(--accent)]">
                                    {item.current_quantity} {item.unit}
                                </span>
                            </div>

                            <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-[var(--border)] pt-4 text-sm">
                                <div>
                                    <dt className="text-muted">Stock unit</dt>
                                    <dd className="mt-1 font-medium">{item.unit}</dd>
                                </div>
                                <div>
                                    <dt className="text-muted">Purchased as</dt>
                                    <dd className="mt-1 font-medium">
                                        {hasPurchaseConversion(
                                            item.unit,
                                            item.purchase_unit,
                                            Number(item.units_per_purchase_unit)
                                        )
                                            ? `1 ${item.purchase_unit} = ${item.units_per_purchase_unit} ${item.unit}`
                                            : item.purchase_unit}
                                    </dd>
                                </div>
                            </dl>
                            {isOwner && (
                                <div className="mt-5 border-t border-[var(--border)] pt-4">
                                    {editingId === item.id ? (
                                        <div className="space-y-3" onClick={(event) => event.preventDefault()}>
                                            <label className="form-label">On hand<input className="form-control mt-1" type="number" min="0" value={String(editDraft.current_quantity ?? "")} onChange={(event) => setEditDraft({ ...editDraft, current_quantity: event.target.value })} /></label>
                                            <label className="form-label">Stock unit<input className="form-control mt-1" value={String(editDraft.unit ?? "")} onChange={(event) => setEditDraft({ ...editDraft, unit: event.target.value })} /></label>
                                            <label className="form-label">Purchase unit<input className="form-control mt-1" value={String(editDraft.purchase_unit ?? "")} onChange={(event) => setEditDraft({ ...editDraft, purchase_unit: event.target.value })} /></label>
                                            <label className="form-label">Units per purchase unit<input className="form-control mt-1" type="number" min="1" value={String(editDraft.units_per_purchase_unit ?? "")} onChange={(event) => setEditDraft({ ...editDraft, units_per_purchase_unit: event.target.value })} /></label>
                                            <div className="flex gap-3"><button type="button" className="primary-action flex-1" disabled={savingId === item.id} onClick={() => saveEdit(item.id)}>{savingId === item.id ? "Saving..." : "Save"}</button><button type="button" className="secondary-action flex-1" onClick={() => setEditingId(null)}>Cancel</button></div>
                                        </div>
                                    ) : (
                                        <button type="button" className="secondary-action w-full" onClick={(event) => { event.preventDefault(); beginEdit(item); }}>Edit inventory item</button>
                                    )}
                                </div>
                            )}
                            <Link href={`/inventory/${item.id}`} className="mt-4 inline-flex text-sm font-semibold text-[var(--accent)]">
                                View stock history →
                            </Link>
                        </div>
                    ))}

                    {filteredItems.length === 0 && (
                        <div className="surface-card p-7 text-center">
                            <p className="text-muted">
                                No inventory items match that search.
                            </p>
                        </div>
                    )}
                </div>

                <div className="surface-card hidden overflow-x-auto sm:block">
                    <table className="w-full min-w-150 text-[var(--foreground)]">
                        <thead className="bg-[var(--surface-subtle)] text-[var(--foreground)]">
                            <tr>
                                <th className="px-7 py-5 text-left">
                                    Item
                                </th>

                                <th className="relative px-7 py-5 text-left">
                                    <div className="flex items-center gap-2">
                                        <span>Category</span>
                                        <button type="button" className="rounded px-1.5 py-0.5 text-xs hover:bg-[var(--surface-hover)]" onClick={() => setFilterOpen((open) => !open)} aria-expanded={filterOpen} aria-label="Filter categories">▾ {selectedCategories.length > 0 ? `(${selectedCategories.length})` : ""}</button>
                                    </div>
                                    {filterOpen && (
                                        <div className="absolute left-4 top-14 z-30 w-72 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-left font-normal shadow-xl">
                                            <div className="mb-3 flex items-center justify-between"><strong className="text-sm">Filter by category</strong><button type="button" className="text-sm font-semibold text-[var(--accent)]" onClick={() => setSelectedCategories([])}>Clear</button></div>
                                            <div className="max-h-64 space-y-2 overflow-y-auto">{[...new Set(items.map((item) => item.category))].sort().map((category) => <label key={category} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-[var(--surface-hover)]"><input type="checkbox" checked={selectedCategories.includes(category)} onChange={(event) => setSelectedCategories((current) => event.target.checked ? [...current, category] : current.filter((value) => value !== category))} /><span>{category}</span></label>)}</div>
                                            <button type="button" className="primary-action mt-4 w-full" onClick={() => setFilterOpen(false)}>Apply filters</button>
                                        </div>
                                    )}
                                </th>

                                <th className="px-7 py-5 text-left">
                                    Quantity
                                </th>

                                <th className="px-7 py-5 text-left">
                                    Stock Unit
                                </th>

                                {isOwner && (
                                    <th className="px-7 py-5 text-right">Actions</th>
                                )}

                                <th className="px-7 py-5 text-right">
                                    History
                                </th>
                            </tr>
                        </thead>

                        <tbody>
                            {filteredItems.map((item) => (
                                <tr
                                    key={item.id}
                                    className="data-row"
                                >
                                    <td className="px-7 py-5 font-medium text-[var(--foreground)]">
                                        <Link
                                            href={`/inventory/${item.id}`}
                                            className="text-[var(--foreground)] hover:text-[var(--accent)] hover:underline"
                                        >
                                            {item.name}
                                        </Link>
                                    </td>

                                    <td className="px-7 py-5 text-[var(--muted-strong)]">
                                        {item.category}
                                    </td>

                                    <td className="px-7 py-5 text-[var(--muted-strong)]">
                                        {editingId === item.id ? (
                                            <input className="form-control max-w-32" type="number" min="0" value={String(editDraft.current_quantity ?? "")} onChange={(event) => setEditDraft({ ...editDraft, current_quantity: event.target.value })} />
                                        ) : item.current_quantity}
                                    </td>

                                    <td className="px-7 py-5 text-[var(--muted-strong)]">
                                        {editingId === item.id ? (
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium">Stock unit<input className="form-control mt-1" value={String(editDraft.unit ?? "")} onChange={(event) => setEditDraft({ ...editDraft, unit: event.target.value })} /></label>
                                                <label className="text-sm font-medium">Purchase unit<input className="form-control mt-1" value={String(editDraft.purchase_unit ?? "")} onChange={(event) => setEditDraft({ ...editDraft, purchase_unit: event.target.value })} /></label>
                                                <label className="text-sm font-medium">Units per purchase unit<input className="form-control mt-1" type="number" min="1" step="1" value={String(editDraft.units_per_purchase_unit ?? "")} onChange={(event) => setEditDraft({ ...editDraft, units_per_purchase_unit: event.target.value })} /></label>
                                            </div>
                                        ) : item.unit}
                                    </td>

                                    {isOwner && (
                                        <td className="px-7 py-5 text-right">
                                            {editingId === item.id ? (
                                                <div className="flex justify-end gap-3">
                                                    <button className="primary-action" disabled={savingId === item.id} onClick={() => saveEdit(item.id)}>{savingId === item.id ? "Saving..." : "Save"}</button>
                                                    <button className="secondary-action" onClick={() => setEditingId(null)}>Cancel</button>
                                                </div>
                                            ) : (
                                                <button className="font-semibold text-[var(--accent)] hover:underline" onClick={() => beginEdit(item)}>Edit</button>
                                            )}
                                        </td>
                                    )}

                                    <td className="px-7 py-5 text-right">
                                        <Link
                                            href={`/inventory/${item.id}`}
                                            className="font-semibold text-[var(--accent)] hover:underline"
                                        >
                                            View →
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                            {filteredItems.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={isOwner ? 6 : 5}
                                        className="text-muted px-7 py-10 text-center"
                                    >
                                        No inventory items match that search.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </main>
    );
}
