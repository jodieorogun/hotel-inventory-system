"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type UserProfile = {
    name: string;
    email: string;
    role: string;
};

function formatRole(role: string) {
    return role.replaceAll("_", " ");
}

function getInitials(name: string) {
    return name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase();
}

export default function AppHeader() {
    const pathname = usePathname();
    const router = useRouter();
    const menuRef = useRef<HTMLDivElement>(null);

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);

    useEffect(() => {
        let ignore = false;

        async function loadProfile() {
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
                console.error("Error loading header profile:", error);
            }

            if (!ignore) {
                setProfile({
                    name: data?.name ?? user.email ?? "Hotel staff",
                    email: user.email ?? "",
                    role: data?.role ?? "staff",
                });
            }
        }

        loadProfile();

        return () => {
            ignore = true;
        };
    }, [router]);

    useEffect(() => {
        function closeMenu(event: MouseEvent) {
            if (
                menuRef.current &&
                !menuRef.current.contains(event.target as Node)
            ) {
                setMenuOpen(false);
            }
        }

        function closeMenuWithEscape(event: KeyboardEvent) {
            if (event.key === "Escape") {
                setMenuOpen(false);
            }
        }

        document.addEventListener("mousedown", closeMenu);
        document.addEventListener("keydown", closeMenuWithEscape);

        return () => {
            document.removeEventListener("mousedown", closeMenu);
            document.removeEventListener("keydown", closeMenuWithEscape);
        };
    }, []);

    async function handleLogout() {
        setLoggingOut(true);

        const { error } = await supabase.auth.signOut();

        if (error) {
            console.error("Error logging out:", error);
            setLoggingOut(false);
            return;
        }

        router.push("/login");
        router.refresh();
    }

    return (
        <header className="mb-10 flex items-center justify-between gap-4 border-b border-gray-800 pb-5">
            <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 text-sm font-medium text-gray-300 hover:text-white"
            >
                {pathname === "/dashboard" ? (
                    "Dashboard"
                ) : (
                    <>
                        <span aria-hidden="true">←</span>
                        Return to Dashboard
                    </>
                )}
            </Link>

            <div ref={menuRef} className="relative">
                <button
                    type="button"
                    onClick={() => setMenuOpen((open) => !open)}
                    aria-expanded={menuOpen}
                    aria-haspopup="menu"
                    className="flex items-center gap-3 rounded-full border border-gray-700 bg-gray-950 py-1.5 pr-3 pl-1.5 text-left hover:bg-gray-900"
                >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm font-bold text-black">
                        {profile ? getInitials(profile.name) : "…"}
                    </span>

                    <span className="hidden sm:block">
                        <span className="block max-w-40 truncate text-sm font-medium text-white">
                            {profile?.name ?? "Loading..."}
                        </span>

                        {profile && (
                            <span className="block text-xs capitalize text-gray-400">
                                {formatRole(profile.role)}
                            </span>
                        )}
                    </span>

                    <span
                        aria-hidden="true"
                        className={`text-xs text-gray-400 transition-transform ${
                            menuOpen ? "rotate-180" : ""
                        }`}
                    >
                        ▼
                    </span>
                </button>

                {menuOpen && (
                    <div
                        role="menu"
                        className="absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-xl border border-gray-700 bg-gray-950 shadow-2xl"
                    >
                        <div className="border-b border-gray-800 px-4 py-4">
                            <p className="truncate font-medium text-white">
                                {profile?.name ?? "Hotel staff"}
                            </p>

                            <p className="mt-1 truncate text-sm text-gray-400">
                                {profile?.email}
                            </p>

                            {profile && (
                                <p className="mt-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                                    {formatRole(profile.role)}
                                </p>
                            )}
                        </div>

                        <Link
                            href="/dashboard"
                            role="menuitem"
                            onClick={() => setMenuOpen(false)}
                            className="block px-4 py-3 text-sm text-gray-300 hover:bg-gray-900 hover:text-white"
                        >
                            Dashboard
                        </Link>

                        <button
                            type="button"
                            role="menuitem"
                            onClick={handleLogout}
                            disabled={loggingOut}
                            className="w-full border-t border-gray-800 px-4 py-3 text-left text-sm text-red-400 hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {loggingOut ? "Logging out..." : "Log Out"}
                        </button>
                    </div>
                )}
            </div>
        </header>
    );
}
