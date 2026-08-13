"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
            } = await supabase.auth.getUser();

            if (!user) {
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
                Loading...
            </main>
        );
    }

   return (
    <main className="min-h-screen bg-black p-8 text-white">
        <div className="mx-auto max-w-5xl">
            <h1 className="text-3xl font-bold">
                Welcome, {profile?.name}
            </h1>

            <p className="mt-2 text-gray-400">
                Role: {profile?.role}
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <a
                    href="/inventory"
                    className="rounded-xl border border-gray-800 bg-gray-950 p-6"
                >
                    <h2 className="text-xl font-semibold">
                        Inventory
                    </h2>

                    <p className="mt-2 text-gray-400">
                        View current hotel stock
                    </p>
                </a>

                <a
                    href="/procurement"
                    className="rounded-xl border border-gray-800 bg-gray-950 p-6"
                >
                    <h2 className="text-xl font-semibold">
                        Procurement
                    </h2>

                    <p className="mt-2 text-gray-400">
                        View procurement requests
                    </p>
                </a>
            </div>
        </div>
    </main>
);
}