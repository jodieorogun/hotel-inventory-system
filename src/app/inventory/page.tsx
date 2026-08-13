import { supabase } from "@/lib/supabase";
import AppHeader from "@/components/app-header";

export default async function InventoryPage() {
    const { data: items, error } = await supabase
        .from("items")
        .select("*");

    if (error) {
        console.error("Error fetching items:", error);
        return (
            <main className="min-h-screen bg-black p-8 text-white">
                <div className="mx-auto max-w-5xl">
                    <AppHeader />

                    <p className="rounded-xl border border-red-900 bg-red-950 p-5 text-red-300">
                        Could not load inventory items.
                    </p>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-black p-8 text-white">
            <div className="mx-auto max-w-5xl">
                <AppHeader />

                <h1 className="mb-2 text-3xl font-bold">
                    Inventory
                </h1>

                <p className="mb-8 text-gray-400">
                    Current hotel stock
                </p>

                <div className="overflow-hidden rounded-xl border border-gray-800 bg-gray-950 shadow-sm">
                    <table className="w-full text-white">
                        <thead className="bg-gray-900 text-white">
                            <tr>
                                <th className="px-6 py-4 text-left">
                                    Item
                                </th>

                                <th className="px-6 py-4 text-left">
                                    Category
                                </th>

                                <th className="px-6 py-4 text-left">
                                    Quantity
                                </th>

                                <th className="px-6 py-4 text-left">
                                    Unit
                                </th>
                            </tr>
                        </thead>

                        <tbody>
                            {items?.map((item) => (
                                <tr
                                    key={item.id}
                                    className="border-t border-gray-800"
                                >
                                    <td className="px-6 py-4 font-medium text-white">
                                        {item.name}
                                    </td>

                                    <td className="px-6 py-4 text-gray-300">
                                        {item.category}
                                    </td>

                                    <td className="px-6 py-4 text-gray-300">
                                        {item.current_quantity}
                                    </td>

                                    <td className="px-6 py-4 text-gray-300">
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
