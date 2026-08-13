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
            <main className="min-h-screen bg-black p-8 text-white">
                <div className="mx-auto max-w-3xl">
                    <AppHeader />

                    <p className="text-gray-400">
                        Loading inventory...
                    </p>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-black p-8 text-white">
            <div className="mx-auto max-w-3xl">
                <AppHeader />

                <h1 className="text-3xl font-bold">
                    New Purchase Request
                </h1>

                <p className="mt-2 text-gray-400">
                    Add the items you want to purchase.
                </p>

                <div className="mt-8 space-y-4">
                    {requestLines.map((line, index) => (
                        <div
                            key={index}
                            className="rounded-xl border border-gray-800 bg-gray-950 p-5"
                        >
                            <div className="grid gap-4 md:grid-cols-3">
                                <div>
                                    <label className="mb-2 block text-sm text-gray-400">
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
                                        className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white"
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
                                    <label className="mb-2 block text-sm text-gray-400">
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
                                        className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white"
                                        placeholder="e.g. 10"
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm text-gray-400">
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
                                        className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white"
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
                                    className="mt-4 text-sm text-red-400"
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
                    className="mt-4 rounded-lg border border-gray-700 px-4 py-2 hover:bg-gray-900"
                >
                    + Add another item
                </button>

                {errorMessage && (
                    <p className="mt-6 rounded-lg border border-red-900 bg-red-950 p-4 text-red-300">
                        {errorMessage}
                    </p>
                )}

                <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="mt-8 w-full rounded-lg bg-white px-4 py-3 font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {submitting
                        ? "Submitting..."
                        : "Submit Purchase Request"}
                </button>
            </div>
        </main>
    );
}
