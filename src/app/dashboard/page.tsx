"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
            <main className="app-page">
                <div className="mx-auto max-w-7xl">
                    <AppHeader />

                    <p className="text-muted">
                        Loading...
                    </p>
                </div>
            </main>
        );
    }

    return (
        <main className="app-page">
            <div className="mx-auto max-w-7xl">
                <AppHeader />

                <div>
                    <h1 className="page-title">
                        Welcome, {profile?.name}
                    </h1>

                    <p className="page-description mt-2 capitalize">
                        {profile?.role.replaceAll("_", " ")} workspace
                    </p>
                </div>

                <div className="mt-10 grid gap-6 sm:grid-cols-2">
                    {profile?.role === "procurement" && (
                        <>
                            <a
                                href="/procurement/new"
                                className="surface-card interactive-card p-7 lg:p-8"
                            >
                                <h2 className="text-xl font-semibold">
                                    New Purchase Request
                                </h2>

                                <p className="text-muted mt-2">
                                    Submit items for accountant approval
                                </p>
                            </a>

                            <a
                                href="/procurement"
                                className="surface-card interactive-card p-7 lg:p-8"
                            >
                                <h2 className="text-xl font-semibold">
                                    My Requests
                                </h2>

                                <p className="text-muted mt-2">
                                    View your submitted requests
                                </p>
                            </a>
                        </>
                    )}

                    {profile?.role === "accountant" && (
                        <>
                            <Link
                                href="/accountant/requests"
                                className="surface-card interactive-card p-7 lg:p-8"
                            >
                                <h2 className="text-xl font-semibold">
                                    Purchase Approvals
                                </h2>

                                <p className="text-muted mt-2">
                                    Review procurement requests
                                </p>
                            </Link>

                            <Link
                                href="/accountant/approvals"
                                className="surface-card interactive-card p-7 lg:p-8"
                            >
                                <h2 className="text-xl font-semibold">
                                    Approval History
                                </h2>

                                <p className="text-muted mt-2">
                                    View requests you have reviewed
                                </p>
                            </Link>
                        </>
                    )}

                    {profile?.role === "storekeeper" && (
                        <>
                            <a
                                href="/storekeeper/receipts"
                                className="surface-card interactive-card p-7 lg:p-8"
                            >
                                <h2 className="text-xl font-semibold">
                                    Incoming Stock
                                </h2>

                                <p className="text-muted mt-2">
                                    Verify approved purchases
                                </p>
                            </a>

                            <a
                                href="/inventory"
                                className="surface-card interactive-card p-7 lg:p-8"
                            >
                                <h2 className="text-xl font-semibold">
                                    Inventory
                                </h2>

                                <p className="text-muted mt-2">
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
