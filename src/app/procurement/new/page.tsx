"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/app-header";
import { supabase } from "@/lib/supabase";

type Item = {
    id: number;
    name: string;
    unit: string;
};

type RequestLine = {
    itemId: string;
    quantity: string;
    unitPrice: string;
};

type NewItemForm = {
    lineIndex: number;
    name: string;
    category: string;
    unit: string;
};

export default function NewProcurementRequestPage() {
    const router = useRouter();

    const [items, setItems] = useState<Item[]>([]);
    const [requestLines, setRequestLines] = useState<RequestLine[]>([
        {
            itemId: "",
            quantity: "",
            unitPrice: "",
        },
    ]);
    const [itemSearches, setItemSearches] = useState([""]);
    const [openItemSearchIndex, setOpenItemSearchIndex] = useState<number | null>(null);
    const [newItemForm, setNewItemForm] = useState<NewItemForm | null>(null);

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [addingItem, setAddingItem] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    useEffect(() => {
        async function loadItems() {
            const { data, error } = await supabase
                .from("items")
                .select("id, name, unit")
                .order("name");

            if (error) {
                console.error("Error loading items:", error);
                setErrorMessage("Could not load inventory items.");
                setLoading(false);
                return;
            }

            setItems(data ?? []);
            setLoading(false);
        }

        loadItems();
    }, []);

    function updateRequestLine(
        index: number,
        field: keyof RequestLine,
        value: string
    ) {
        const updatedLines = [...requestLines];

        updatedLines[index] = {
            ...updatedLines[index],
            [field]: value,
        };

        setRequestLines(updatedLines);
    }

    function addRequestLine() {
        setRequestLines([
            ...requestLines,
            {
                itemId: "",
                quantity: "",
                unitPrice: "",
            },
        ]);
        setItemSearches([...itemSearches, ""]);
    }

    function removeRequestLine(index: number) {
        if (requestLines.length === 1) {
            return;
        }

        const updatedLines = requestLines.filter(
            (_, lineIndex) => lineIndex !== index
        );

        setRequestLines(updatedLines);
        setItemSearches((searches) =>
            searches.filter((_, lineIndex) => lineIndex !== index)
        );
        setOpenItemSearchIndex(null);
        setNewItemForm(null);
    }

    function updateItemSearch(index: number, value: string) {
        setItemSearches((searches) =>
            searches.map((search, lineIndex) =>
                lineIndex === index ? value : search
            )
        );
        updateRequestLine(index, "itemId", "");
        setOpenItemSearchIndex(index);
    }

    function selectItem(index: number, item: Item) {
        updateRequestLine(index, "itemId", String(item.id));
        setItemSearches((searches) =>
            searches.map((search, lineIndex) =>
                lineIndex === index ? item.name : search
            )
        );
        setOpenItemSearchIndex(null);
        setNewItemForm(null);
    }

    async function handleAddItem(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (!newItemForm) {
            return;
        }

        const name = newItemForm.name.trim();
        const category = newItemForm.category.trim();
        const unit = newItemForm.unit.trim();

        if (!name || !category || !unit) {
            setErrorMessage("Please complete the new item fields.");
            return;
        }

        const existingItem = items.find(
            (item) => item.name.trim().toLowerCase() === name.toLowerCase()
        );

        if (existingItem) {
            selectItem(newItemForm.lineIndex, existingItem);
            setErrorMessage(
                `${existingItem.name} already exists and has been selected.`
            );
            return;
        }

        setAddingItem(true);
        setErrorMessage("");

        const { data, error } = await supabase
            .from("items")
            .insert({
                name,
                category,
                unit,
                current_quantity: 0,
            })
            .select("id, name, unit")
            .single();

        setAddingItem(false);

        if (error || !data) {
            console.error("Error adding inventory item:", error);
            setErrorMessage("Could not add the new inventory item.");
            return;
        }

        setItems((currentItems) =>
            [...currentItems, data].sort((first, second) =>
                first.name.localeCompare(second.name)
            )
        );
        selectItem(newItemForm.lineIndex, data);
    }

    async function handleSubmit() {
        setErrorMessage("");

        const validItemIds = new Set(items.map((item) => String(item.id)));
        const hasInvalidItem = requestLines.some(
            (line) => !line.itemId || !validItemIds.has(line.itemId)
        );

        if (hasInvalidItem) {
            setErrorMessage(
                "Please select an existing item or add it as a new item."
            );
            return;
        }

        const hasEmptyFields = requestLines.some(
            (line) => !line.quantity || !line.unitPrice
        );

        if (hasEmptyFields) {
            setErrorMessage("Please complete the quantity and unit price fields.");
            return;
        }

        const hasInvalidNumbers = requestLines.some(
            (line) =>
                Number(line.quantity) <= 0 ||
                Number(line.unitPrice) < 0
        );

        if (hasInvalidNumbers) {
            setErrorMessage(
                "Quantity must be above 0 and unit price cannot be negative."
            );
            return;
        }

        setSubmitting(true);

        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
            setSubmitting(false);
            router.push("/login");
            return;
        }

        const { data: request, error: requestError } =
            await supabase
                .from("purchase_requests")
                .insert({
                    requested_by: user.id,
                    status: "pending_accountant",
                })
                .select("id")
                .single();

        if (requestError || !request) {
            console.error(
                "Error creating procurement request:",
                requestError
            );

            setErrorMessage(
                "Could not create the purchase request."
            );

            setSubmitting(false);
            return;
        }

        const requestItems = requestLines.map((line) => ({
            request_id: request.id,
            item_id: Number(line.itemId),
            quantity: Number(line.quantity),
            unit_price: Number(line.unitPrice),
        }));

        const { error: itemsError } = await supabase
            .from("purchase_request_items")
            .insert(requestItems);

        if (itemsError) {
            console.error(
                "Error adding procurement request items:",
                itemsError
            );

            setErrorMessage(
                "The request was created, but the items could not be added."
            );

            setSubmitting(false);
            return;
        }

        router.push("/procurement");
        router.refresh();
    }

    if (loading) {
        return (
            <main className="app-page">
                <div className="mx-auto max-w-5xl">
                    <AppHeader />

                    <p className="text-muted">
                        Loading inventory...
                    </p>
                </div>
            </main>
        );
    }

    return (
        <main className="app-page">
            <div className="mx-auto max-w-5xl">
                <AppHeader />

                <h1 className="page-title">
                    New Purchase Request
                </h1>

                <p className="page-description mt-2">
                    Add the items you want to purchase.
                </p>

                <div className="mt-8 space-y-4">
                    {requestLines.map((line, index) => (
                        <div
                            key={index}
                            className="surface-card p-6 lg:p-7"
                        >
                            <div className="grid gap-4 md:grid-cols-3">
                                <div className="relative">
                                    <label
                                        className="form-label"
                                        htmlFor={`item-${index}`}
                                    >
                                        Item
                                    </label>

                                    <input
                                        id={`item-${index}`}
                                        type="text"
                                        role="combobox"
                                        aria-expanded={openItemSearchIndex === index}
                                        aria-controls={`item-results-${index}`}
                                        autoComplete="off"
                                        value={itemSearches[index] ?? ""}
                                        onFocus={() => setOpenItemSearchIndex(index)}
                                        onBlur={() => setOpenItemSearchIndex(null)}
                                        onChange={(event) =>
                                            updateItemSearch(
                                                index,
                                                event.target.value
                                            )
                                        }
                                        className="form-control"
                                        placeholder="Search inventory items"
                                    />

                                    {openItemSearchIndex === index && (() => {
                                        const search = (itemSearches[index] ?? "")
                                            .trim()
                                            .toLowerCase();
                                        const matches = items.filter((item) =>
                                            item.name.toLowerCase().includes(search)
                                        );

                                        return (
                                            <div
                                                id={`item-results-${index}`}
                                                role="listbox"
                                                className="absolute z-10 mt-2 max-h-60 w-full overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-xl"
                                            >
                                                {matches.map((item) => (
                                                    <button
                                                        key={item.id}
                                                        type="button"
                                                        role="option"
                                                        aria-selected={line.itemId === String(item.id)}
                                                        onMouseDown={(event) => event.preventDefault()}
                                                        onClick={() => selectItem(index, item)}
                                                        className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--surface-hover)]"
                                                    >
                                                        {item.name} ({item.unit})
                                                    </button>
                                                ))}

                                                {search && matches.length === 0 && (
                                                    <div className="px-3 py-2 text-sm">
                                                        <p className="text-muted">
                                                            No existing item found
                                                        </p>
                                                        <button
                                                            type="button"
                                                            onMouseDown={(event) => event.preventDefault()}
                                                            onClick={() => {
                                                                setNewItemForm({
                                                                    lineIndex: index,
                                                                    name: itemSearches[index].trim(),
                                                                    category: "",
                                                                    unit: "",
                                                                });
                                                                setOpenItemSearchIndex(null);
                                                            }}
                                                            className="mt-2 font-medium text-[var(--accent)] hover:underline"
                                                        >
                                                            + Add &quot;{itemSearches[index].trim()}&quot; as a new item
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>

                                <div>
                                    <label className="form-label">
                                        Quantity
                                    </label>

                                    <input
                                        type="number"
                                        min="1"
                                        value={line.quantity}
                                        onChange={(event) =>
                                            updateRequestLine(
                                                index,
                                                "quantity",
                                                event.target.value
                                            )
                                        }
                                        className="form-control"
                                        placeholder="e.g. 10"
                                    />
                                </div>

                                <div>
                                    <label className="form-label">
                                        Unit Price
                                    </label>

                                    <input
                                        type="number"
                                        min="0"
                                        value={line.unitPrice}
                                        onChange={(event) =>
                                            updateRequestLine(
                                                index,
                                                "unitPrice",
                                                event.target.value
                                            )
                                        }
                                        className="form-control"
                                        placeholder="e.g. 5000"
                                    />
                                </div>
                            </div>

                            {newItemForm?.lineIndex === index && (
                                <form
                                    onSubmit={handleAddItem}
                                    className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] p-4"
                                >
                                    <h2 className="font-semibold">Add New Item</h2>

                                    <div className="mt-4 grid gap-4 md:grid-cols-3">
                                        <div>
                                            <label className="form-label">Name</label>
                                            <input
                                                type="text"
                                                value={newItemForm.name}
                                                onChange={(event) =>
                                                    setNewItemForm({
                                                        ...newItemForm,
                                                        name: event.target.value,
                                                    })
                                                }
                                                className="form-control"
                                                required
                                            />
                                        </div>

                                        <div>
                                            <label className="form-label">Category</label>
                                            <input
                                                type="text"
                                                value={newItemForm.category}
                                                onChange={(event) =>
                                                    setNewItemForm({
                                                        ...newItemForm,
                                                        category: event.target.value,
                                                    })
                                                }
                                                className="form-control"
                                                required
                                            />
                                        </div>

                                        <div>
                                            <label className="form-label">Unit</label>
                                            <input
                                                type="text"
                                                value={newItemForm.unit}
                                                onChange={(event) =>
                                                    setNewItemForm({
                                                        ...newItemForm,
                                                        unit: event.target.value,
                                                    })
                                                }
                                                className="form-control"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="mt-4 flex gap-3">
                                        <button
                                            type="submit"
                                            disabled={addingItem}
                                            className="primary-action"
                                        >
                                            {addingItem ? "Adding..." : "Add Item"}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setNewItemForm(null)}
                                            className="secondary-action"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            )}

                            {requestLines.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() =>
                                        removeRequestLine(index)
                                    }
                                    className="mt-4 text-sm font-medium text-[var(--danger)] hover:underline"
                                >
                                    Remove item
                                </button>
                            )}
                        </div>
                    ))}
                </div>

                <button
                    type="button"
                    onClick={addRequestLine}
                    className="secondary-action mt-4"
                >
                    + Add another item
                </button>

                {errorMessage && (
                    <p className="error-message mt-6">
                        {errorMessage}
                    </p>
                )}

                <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="primary-action mt-8 w-full"
                >
                    {submitting
                        ? "Submitting..."
                        : "Submit Purchase Request"}
                </button>
            </div>
        </main>
    );
}
