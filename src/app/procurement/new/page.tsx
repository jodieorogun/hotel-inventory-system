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

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
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
    }

    function removeRequestLine(index: number) {
        if (requestLines.length === 1) {
            return;
        }

        const updatedLines = requestLines.filter(
            (_, lineIndex) => lineIndex !== index
        );

        setRequestLines(updatedLines);
    }

    async function handleSubmit() {
        setErrorMessage("");

        const hasEmptyFields = requestLines.some(
            (line) =>
                !line.itemId ||
                !line.quantity ||
                !line.unitPrice
        );

        if (hasEmptyFields) {
            setErrorMessage("Please complete all item fields.");
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
                .from("procurement_requests")
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
            .from("procurement_requests_items")
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
                                <div>
                                    <label className="form-label">
                                        Item
                                    </label>

                                    <select
                                        value={line.itemId}
                                        onChange={(event) =>
                                            updateRequestLine(
                                                index,
                                                "itemId",
                                                event.target.value
                                            )
                                        }
                                        className="form-control"
                                    >
                                        <option value="">
                                            Select item
                                        </option>

                                        {items.map((item) => (
                                            <option
                                                key={item.id}
                                                value={item.id}
                                            >
                                                {item.name} ({item.unit})
                                            </option>
                                        ))}
                                    </select>
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
