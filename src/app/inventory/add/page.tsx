"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/app-header";
import { supabase } from "@/lib/supabase";
import {
    capitalizeInputWords,
    hasDuplicateItemName,
    isValidUnitLabel,
} from "@/lib/item-validation";

export default function AddInventoryItemPage() {
    const router = useRouter();
    const [name, setName] = useState("");
    const [category, setCategory] = useState("");
    const [unit, setUnit] = useState("");
    const [purchaseUnit, setPurchaseUnit] = useState("");
    const [unitsPerPurchaseUnit, setUnitsPerPurchaseUnit] = useState("1");
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [existingItemNames, setExistingItemNames] = useState<string[]>([]);

    useEffect(() => {
        let ignore = false;

        async function verifyAccess() {
            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser();

            if (userError || !user) {
                router.replace("/login");
                return;
            }

            const { data, error } = await supabase
                .from("users")
                .select("role")
                .eq("id", user.id)
                .single();

            if (error) {
                console.error("Error checking inventory permissions:", error);
                if (!ignore) {
                    setErrorMessage("Could not verify your account permissions.");
                    setLoading(false);
                }
                return;
            }

            if (!["procurement", "owner"].includes(data.role)) {
                router.replace("/dashboard");
                return;
            }

            const { data: inventoryItems, error: inventoryError } =
                await supabase.from("items").select("name");

            if (inventoryError) {
                console.error("Error loading existing item names:", inventoryError);
                if (!ignore) {
                    setErrorMessage("Could not load the existing inventory items.");
                    setLoading(false);
                }
                return;
            }

            if (!ignore) {
                setExistingItemNames(
                    (inventoryItems ?? []).map((item) => item.name)
                );
                setLoading(false);
            }
        }

        verifyAccess();

        return () => {
            ignore = true;
        };
    }, [router]);

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSubmitting(true);
        setErrorMessage("");
        setSuccessMessage("");

        const trimmedName = capitalizeInputWords(name);
        const trimmedCategory = capitalizeInputWords(category);
        const trimmedUnit = capitalizeInputWords(unit);
        const trimmedPurchaseUnit = capitalizeInputWords(purchaseUnit);
        const conversion = Number(unitsPerPurchaseUnit);

        if (
            !isValidUnitLabel(trimmedUnit) ||
            !isValidUnitLabel(trimmedPurchaseUnit)
        ) {
            setErrorMessage(
                "Enter a valid stock unit and purchase unit, such as bottle, roll or pack."
            );
            setSubmitting(false);
            return;
        }

        if (!Number.isInteger(conversion) || conversion < 1) {
            setErrorMessage("Stock units in one purchase unit must be a whole number of at least 1.");
            setSubmitting(false);
            return;
        }

        if (hasDuplicateItemName(existingItemNames, trimmedName)) {
            setErrorMessage(`${trimmedName} already exists in inventory.`);
            setSubmitting(false);
            return;
        }

        const { error } = await supabase
            .from("items")
            .insert([{
                name: trimmedName,
                category: trimmedCategory,
                unit: trimmedUnit,
                purchase_unit: trimmedPurchaseUnit,
                units_per_purchase_unit: conversion,
                current_quantity: 0,
            }]);

        if (error) {
            console.error("Error adding item:", error);
            setErrorMessage("Could not add this inventory item.");
            setSubmitting(false);
            return;
        }

        setExistingItemNames((current) => [...current, trimmedName]);
        setName("");
        setCategory("");
        setUnit("");
        setPurchaseUnit("");
        setUnitsPerPurchaseUnit("1");
        setSuccessMessage("Inventory item added.");
        setSubmitting(false);
    }

    if (loading) {
        return (
            <main className="app-page">
                <div className="mx-auto max-w-3xl">
                    <AppHeader />
                    <p className="text-muted">Checking permissions...</p>
                </div>
            </main>
        );
    }

    return (
        <main className="app-page">
            <div className="mx-auto max-w-3xl">
                <AppHeader />

                <h1 className="page-title mb-8">
                    Add Inventory Item
                </h1>

                {errorMessage && (
                    <p className="error-message mb-6" role="alert">
                        {errorMessage}
                    </p>
                )}

                {successMessage && (
                    <p
                        className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                        role="status"
                    >
                        {successMessage}
                    </p>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="form-label" htmlFor="item-name">
                            Item name
                        </label>

                        <input
                            id="item-name"
                            type="text"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            onBlur={() => setName(capitalizeInputWords(name))}
                            autoCapitalize="words"
                            className="form-control"
                            placeholder="e.g. Toilet Roll"
                            required
                        />
                    </div>

                    <div>
                        <label className="form-label" htmlFor="item-category">
                            Category
                        </label>

                        <input
                            id="item-category"
                            type="text"
                            value={category}
                            onChange={(event) => setCategory(event.target.value)}
                            onBlur={() =>
                                setCategory(capitalizeInputWords(category))
                            }
                            autoCapitalize="words"
                            className="form-control"
                            placeholder="e.g. Cleaning"
                            required
                        />
                    </div>

                    <div>
                        <label className="form-label" htmlFor="item-unit">
                            Stock unit
                        </label>

                        <input
                            id="item-unit"
                            type="text"
                            value={unit}
                            onChange={(event) => setUnit(event.target.value)}
                            onBlur={() => setUnit(capitalizeInputWords(unit))}
                            autoCapitalize="words"
                            className="form-control"
                            placeholder="e.g. roll"
                            required
                        />
                        <p className="text-muted mt-2 text-sm">
                            The smallest unit staff hand out from inventory.
                        </p>
                    </div>

                    <div>
                        <label className="form-label" htmlFor="purchase-unit">
                            Purchase unit
                        </label>
                        <input
                            id="purchase-unit"
                            type="text"
                            value={purchaseUnit}
                            onChange={(event) => setPurchaseUnit(event.target.value)}
                            onBlur={() =>
                                setPurchaseUnit(
                                    capitalizeInputWords(purchaseUnit)
                                )
                            }
                            autoCapitalize="words"
                            className="form-control"
                            placeholder="e.g. pack"
                            required
                        />
                        <p className="text-muted mt-2 text-sm">
                            How Procurement normally buys this item.
                        </p>
                    </div>

                    <div>
                        <label
                            className="form-label"
                            htmlFor="units-per-purchase-unit"
                        >
                            Stock units in one purchase unit
                        </label>
                        <input
                            id="units-per-purchase-unit"
                            type="number"
                            min="1"
                            step="1"
                            value={unitsPerPurchaseUnit}
                            onChange={(event) =>
                                setUnitsPerPurchaseUnit(event.target.value)
                            }
                            className="form-control"
                            placeholder="e.g. 12"
                            required
                        />
                        <p className="text-muted mt-2 text-sm">
                            For example, one pack containing 12 rolls is 12.
                        </p>
                    </div>

                    <button
                        type="submit"
                        disabled={submitting}
                        className="primary-action w-full"
                    >
                        {submitting ? "Adding..." : "Add Item"}
                    </button>
                </form>
            </div>
        </main>
    );
}
