"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";


export default function AddInventoryItemPage() {
    const [name, setName] = useState("");
    const [category, setCategory] = useState("");
    const [unit, setUnit] = useState("");
    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const { error } = await supabase
        .from("items")
        .insert([{ name: name
            , category: category, 
            unit: unit }]);

    if (error) {
        console.error("Error adding item:", error);
    } else {
        console.log("Item added successfully");
        setName("");
        setCategory("");
        setUnit("");
    }

    return (
        <main className="min-h-screen bg-black p-8 text-white">
            <div className="mx-auto max-w-xl">
                <h1 className="mb-8 text-3xl font-bold">
                    Add Inventory Item
                </h1>

                <form className="space-y-6">
                    <div>
                        <label className="mb-2 block">
                            Item name
                        </label>

                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white"
                            placeholder="e.g. Toilet Roll"
                        />
                    </div>

                    <div>
                        <label className="mb-2 block">
                            Category
                        </label>

                        <input
                            type="text"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white"
                            placeholder="e.g. Cleaning"
                        />
                    </div>

                    <div>
                        <label className="mb-2 block">
                            Unit
                        </label>

                        <input
                            type="text"
                            value={unit}
                            onChange={(e) => setUnit(e.target.value)}
                            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white"
                            placeholder="e.g. roll"
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full rounded-lg bg-white px-4 py-3 font-semibold text-black"
                    >
                        Add Item
                    </button>
                </form>
            </div>
        </main>
    );
}}