"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/app-header";
import { supabase } from "@/lib/supabase";

type UserProfile = {
    name: string;
    role: string;
};

export default function DashboardPage() {
    const router = useRouter();

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadUser() {
            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser();

            if (userError || !user) {
                router.push("/login");
                return;
            }

            const { data, error } = await supabase
                .from("users")
                .select("name, role")
                .eq("id", user.id)
                .single();

            if (error) {
                console.error("Error loading profile:", error);
                setLoading(false);
                return;
            }

            setProfile(data);
            setLoading(false);
        }

        loadUser();
    }, [router]);

    if (loading) {
        return (
            <main className="min-h-screen bg-black p-8 text-white">
                <div className="mx-auto max-w-5xl">
                    <AppHeader />

                    <p className="text-gray-400">
                        Loading...
                    </p>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-black p-8 text-white">
            <div className="mx-auto max-w-5xl">
                <AppHeader />

                <div>
                    <h1 className="text-3xl font-bold">
                        Welcome, {profile?.name}
                    </h1>

                    <p className="mt-2 text-gray-400">
                        Role: {profile?.role}
                    </p>
                </div>

                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                    {profile?.role === "procurement" && (
                        <>
                            <a
                                href="/procurement/new"
                                className="rounded-xl border border-gray-800 bg-gray-950 p-6 hover:bg-gray-900"
                            >
                                <h2 className="text-xl font-semibold">
                                    New Purchase Request
                                </h2>

                                <p className="mt-2 text-gray-400">
                                    Submit items for accountant approval
                                </p>
                            </a>

                            <a
                                href="/procurement"
                                className="rounded-xl border border-gray-800 bg-gray-950 p-6 hover:bg-gray-900"
                            >
                                <h2 className="text-xl font-semibold">
                                    My Requests
                                </h2>

                                <p className="mt-2 text-gray-400">
                                    View your submitted requests
                                </p>
                            </a>
                        </>
                    )}

                    {profile?.role === "accountant" && (
                        <a
                            href="/accountant/requests"
                            className="rounded-xl border border-gray-800 bg-gray-950 p-6 hover:bg-gray-900"
                        >
                            <h2 className="text-xl font-semibold">
                                Purchase Approvals
                            </h2>

                            <p className="mt-2 text-gray-400">
                                Review procurement requests
                            </p>
                        </a>
                    )}

                    {profile?.role === "storekeeper" && (
                        <>
                            <a
                                href="/storekeeper/receipts"
                                className="rounded-xl border border-gray-800 bg-gray-950 p-6 hover:bg-gray-900"
                            >
                                <h2 className="text-xl font-semibold">
                                    Incoming Stock
                                </h2>

                                <p className="mt-2 text-gray-400">
                                    Verify approved purchases
                                </p>
                            </a>

                            <a
                                href="/inventory"
                                className="rounded-xl border border-gray-800 bg-gray-950 p-6 hover:bg-gray-900"
                            >
                                <h2 className="text-xl font-semibold">
                                    Inventory
                                </h2>

                                <p className="mt-2 text-gray-400">
                                    View current hotel stock
                                </p>
                            </a>
                        </>
                    )}
                </div>
            </div>
        </main>
    );
}
