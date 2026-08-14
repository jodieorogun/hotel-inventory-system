"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/app-header";
import { supabase } from "@/lib/supabase";

type InventoryItem = {
    id: number;
    name: string;
    category: string;
    current_quantity: number | string;
    unit: string;
};

export default function InventoryPage() {
    const router = useRouter();
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
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

            const { data, error } = await supabase
                .from("items")
                .select("id, name, category, current_quantity, unit")
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

    return (
        <main className="app-page">
            <div className="mx-auto max-w-7xl">
                <AppHeader />

                <h1 className="page-title mb-2">
                    Inventory
                </h1>

                <p className="page-description mb-8">
                    Current hotel stock
                </p>

                {errorMessage && (
                    <p className="error-message mb-6" role="alert">
                        {errorMessage}
                    </p>
                )}

                <div className="surface-card overflow-x-auto">
                    <table className="w-full min-w-150 text-[var(--foreground)]">
                        <thead className="bg-[var(--surface-subtle)] text-[var(--foreground)]">
                            <tr>
                                <th className="px-7 py-5 text-left">
                                    Item
                                </th>

                                <th className="px-7 py-5 text-left">
                                    Category
                                </th>

                                <th className="px-7 py-5 text-left">
                                    Quantity
                                </th>

                                <th className="px-7 py-5 text-left">
                                    Unit
                                </th>
                            </tr>
                        </thead>

                        <tbody>
                            {items.map((item) => (
                                <tr
                                    key={item.id}
                                    className="data-row"
                                >
                                    <td className="px-7 py-5 font-medium text-[var(--foreground)]">
                                        {item.name}
                                    </td>

                                    <td className="px-7 py-5 text-[var(--muted-strong)]">
                                        {item.category}
                                    </td>

                                    <td className="px-7 py-5 text-[var(--muted-strong)]">
                                        {item.current_quantity}
                                    </td>

                                    <td className="px-7 py-5 text-[var(--muted-strong)]">
                                        {item.unit}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </main>
    );
}
