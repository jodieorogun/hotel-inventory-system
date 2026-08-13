"use client";

import { useState } from "react";
import AppHeader from "@/components/app-header";
import { supabase } from "@/lib/supabase";

export default function AddInventoryItemPage() {
    const [name, setName] = useState("");
    const [category, setCategory] = useState("");
    const [unit, setUnit] = useState("");

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const { error } = await supabase
            .from("items")
            .insert([{ name, category, unit }]);

        if (error) {
            console.error("Error adding item:", error);
            return;
        }

        setName("");
        setCategory("");
        setUnit("");
    }

    return (
        <main className="app-page">
            <div className="mx-auto max-w-3xl">
                <AppHeader />

                <h1 className="page-title mb-8">
                    Add Inventory Item
                </h1>

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
                        className="primary-action w-full"
                    >
                        Add Item
                    </button>
                </form>
            </div>
        </main>
    );
}
