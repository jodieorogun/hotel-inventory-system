import { supabase } from "@/lib/supabase";
import AppHeader from "@/components/app-header";

export default async function InventoryPage() {
    const { data: items, error } = await supabase
        .from("items")
        .select("*");

    if (error) {
        console.error("Error fetching items:", error);
        return (
            <main className="app-page">
                <div className="mx-auto max-w-7xl">
                    <AppHeader />

                    <p className="error-message">
                        Could not load inventory items.
                    </p>
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
                            {items?.map((item) => (
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
