"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/app-header";
import { supabase } from "@/lib/supabase";

export default function AddInventoryItemPage() {
    const router = useRouter();
    const [name, setName] = useState("");
    const [category, setCategory] = useState("");
    const [unit, setUnit] = useState("");
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

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

            if (!ignore) {
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

        const { error } = await supabase
            .from("items")
            .insert([{
                name: name.trim(),
                category: category.trim(),
                unit: unit.trim(),
                current_quantity: 0,
            }]);

        if (error) {
            console.error("Error adding item:", error);
            setErrorMessage("Could not add this inventory item.");
            setSubmitting(false);
            return;
        }

        setName("");
        setCategory("");
        setUnit("");
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
                            className="form-control"
                            placeholder="e.g. Cleaning"
                            required
                        />
                    </div>

                    <div>
                        <label className="form-label" htmlFor="item-unit">
                            Unit
                        </label>

                        <input
                            id="item-unit"
                            type="text"
                            value={unit}
                            onChange={(event) => setUnit(event.target.value)}
                            className="form-control"
                            placeholder="e.g. roll"
                            required
                        />
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
