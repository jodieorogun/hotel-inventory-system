"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/app-header";
import { supabase } from "@/lib/supabase";
import { formatQuantity } from "@/lib/units";

type InventoryItem = {
    id: number;
    name: string;
    unit: string;
    currentQuantity: number;
};

type RequestLine = {
    itemId: string;
    quantity: string;
};

export default function NewStockRequestPage() {
    const router = useRouter();
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [lines, setLines] = useState<RequestLine[]>([
        { itemId: "", quantity: "" },
    ]);
    const [loading, setLoading] = useState(true);
    const [viewerRole, setViewerRole] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    useEffect(() => {
        let ignore = false;

        async function loadItems() {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                router.replace("/login");
                return;
            }

            const { data: profile, error: profileError } = await supabase
                .from("users")
                .select("role")
                .eq("id", user.id)
                .single();

            if (
                profileError ||
                !profile ||
                !["housekeeper", "owner"].includes(profile.role)
            ) {
                router.replace("/dashboard");
                return;
            }

            if (!ignore) {
                setViewerRole(profile.role);
            }

            const { data, error } = await supabase
                .from("items")
                .select("id, name, unit, current_quantity")
                .order("name");

            if (ignore) return;

            if (error) {
                console.error("Error loading stock items:", error);
                setErrorMessage("Could not load the available stock.");
            } else {
                setItems(
                    (data ?? []).map((item) => ({
                        id: item.id,
                        name: item.name,
                        unit: item.unit,
                        currentQuantity: Number(item.current_quantity),
                    }))
                );
            }

            setLoading(false);
        }

        loadItems();
        return () => {
            ignore = true;
        };
    }, [router]);

    function updateLine(index: number, field: keyof RequestLine, value: string) {
        setLines((currentLines) =>
            currentLines.map((line, lineIndex) =>
                lineIndex === index ? { ...line, [field]: value } : line
            )
        );
    }

    async function submitRequest() {
        if (submitting) return;

        const selectedIds = lines.map((line) => line.itemId);

        if (lines.some((line) => !line.itemId || !line.quantity)) {
            setErrorMessage("Choose an item and quantity on every line.");
            return;
        }

        if (new Set(selectedIds).size !== selectedIds.length) {
            setErrorMessage("Each item can only appear once in a request.");
            return;
        }

        const invalidLine = lines.find((line) => {
            const item = items.find((entry) => String(entry.id) === line.itemId);
            const quantity = Number(line.quantity);

            return (
                !item ||
                !Number.isInteger(quantity) ||
                quantity <= 0 ||
                quantity > item.currentQuantity
            );
        });

        if (invalidLine) {
            setErrorMessage(
                "Quantities must be whole numbers and cannot exceed the available stock."
            );
            return;
        }

        setSubmitting(true);
        setErrorMessage("");

        const { error } = await supabase.rpc("create_stock_out_request", {
            request_items: lines.map((line) => ({
                item_id: Number(line.itemId),
                requested_quantity: Number(line.quantity),
            })),
        });

        if (error) {
            console.error("Error creating stock request:", error);
            setErrorMessage("Could not submit this stock request.");
            setSubmitting(false);
            return;
        }

        router.push(
            viewerRole === "owner"
                ? "/storekeeper/stock-out?tab=pending"
                : "/housekeeper/requests?tab=pending"
        );
        router.refresh();
    }

    if (loading) {
        return (
            <main className="app-page">
                <div className="mx-auto max-w-5xl">
                    <AppHeader />
                    <p className="text-muted">Loading stock...</p>
                </div>
            </main>
        );
    }

    return (
        <main className="app-page">
            <div className="mx-auto max-w-5xl">
                <AppHeader />
                <h1 className="page-title">New Stock Request</h1>
                <p className="page-description mt-2">
                    {viewerRole === "owner"
                        ? "Create a consumable request for the Storekeeper to issue."
                        : "Request consumable items from the Storekeeper."}
                </p>

                <div className="mt-8 space-y-4">
                    {lines.map((line, index) => {
                        const selectedItem = items.find(
                            (item) => String(item.id) === line.itemId
                        );

                        return (
                            <div key={index} className="surface-card p-6">
                                <div className="grid gap-4 sm:grid-cols-[1fr_14rem]">
                                    <div>
                                        <label className="form-label" htmlFor={`item-${index}`}>
                                            Item
                                        </label>
                                        <select
                                            id={`item-${index}`}
                                            value={line.itemId}
                                            onChange={(event) =>
                                                updateLine(index, "itemId", event.target.value)
                                            }
                                            className="form-control"
                                        >
                                            <option value="">Choose an item</option>
                                            {items.map((item) => (
                                                <option key={item.id} value={item.id}>
                                                    {item.name} — {formatQuantity(
                                                        item.currentQuantity,
                                                        item.unit
                                                    )} available
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="form-label" htmlFor={`quantity-${index}`}>
                                            Quantity{selectedItem ? ` (${selectedItem.unit})` : ""}
                                        </label>
                                        <input
                                            id={`quantity-${index}`}
                                            type="number"
                                            min="1"
                                            step="1"
                                            max={selectedItem?.currentQuantity}
                                            value={line.quantity}
                                            onChange={(event) =>
                                                updateLine(index, "quantity", event.target.value)
                                            }
                                            className="form-control"
                                            placeholder="0"
                                        />
                                    </div>
                                </div>

                                {lines.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setLines((currentLines) =>
                                                currentLines.filter((_, lineIndex) => lineIndex !== index)
                                            )
                                        }
                                        className="mt-4 text-sm font-medium text-[var(--danger)] hover:underline"
                                    >
                                        Remove item
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>

                <button
                    type="button"
                    onClick={() => setLines((current) => [...current, { itemId: "", quantity: "" }])}
                    className="secondary-action mt-4"
                >
                    + Add another item
                </button>

                {errorMessage && <p className="error-message mt-6">{errorMessage}</p>}

                <button
                    type="button"
                    onClick={submitRequest}
                    disabled={submitting}
                    className="primary-action mt-8 w-full"
                >
                    {submitting ? "Submitting..." : "Submit Stock Request"}
                </button>
            </div>
        </main>
    );
}
