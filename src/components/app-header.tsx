"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { formatStaffRole } from "@/lib/staff-roles";

type UserProfile = {
    name: string;
    email: string;
    role: string;
};

type ThemePreference = "light" | "dark" | "system";

function formatRole(role: string) {
    return formatStaffRole(role);
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

export default function AppHeader({ children }: { children?: ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const menuRef = useRef<HTMLDivElement>(null);

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);
    const [theme, setTheme] = useState<ThemePreference>(() => {
        if (typeof window === "undefined") {
            return "system";
        }

        const savedTheme = localStorage.getItem("hotel-inventory-theme");

        return savedTheme === "light" ||
            savedTheme === "dark" ||
            savedTheme === "system"
            ? savedTheme
            : "system";
    });

    useEffect(() => {
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

        function applyTheme() {
            const isDark =
                theme === "dark" ||
                (theme === "system" && mediaQuery.matches);

            document.documentElement.classList.toggle("dark", isDark);
            document.documentElement.classList.toggle("light", !isDark);
        }

        applyTheme();
        mediaQuery.addEventListener("change", applyTheme);

        return () => mediaQuery.removeEventListener("change", applyTheme);
    }, [theme]);

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

    function chooseTheme(preference: ThemePreference) {
        localStorage.setItem("hotel-inventory-theme", preference);
        setTheme(preference);
    }

    return (
        <header
            className={`app-header ${
                pathname === "/dashboard" ? "dashboard-header" : ""
            }`}
        >
            {pathname === "/dashboard" ? (
                children ?? <span aria-hidden="true" />
            ) : (
                <Link href="/dashboard" className="dashboard-link">
                    <span aria-hidden="true">←</span>
                    <span className="hidden min-[360px]:inline">
                        Return to Dashboard
                    </span>
                </Link>
            )}

            <div ref={menuRef} className="relative">
                <button
                    type="button"
                    onClick={() => setMenuOpen((open) => !open)}
                    aria-expanded={menuOpen}
                    aria-haspopup="menu"
                    className="focus-ring flex items-center gap-3 rounded-full border border-[var(--border-strong)] bg-[var(--surface)] py-1.5 pr-3 pl-1.5 text-left shadow-sm transition-colors hover:bg-[var(--surface-hover)]"
                >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-bold text-[var(--accent-foreground)]">
                        {profile ? getInitials(profile.name) : "…"}
                    </span>

                    <span className="hidden sm:block">
                        <span className="block max-w-40 truncate text-sm font-semibold text-[var(--foreground)]">
                            {profile?.name ?? "Loading..."}
                        </span>

                        {profile && (
                            <span className="block text-xs capitalize text-[var(--muted)]">
                                {formatRole(profile.role)}
                            </span>
                        )}
                    </span>

                    <span
                        aria-hidden="true"
                        className={`text-xs text-[var(--muted)] transition-transform ${
                            menuOpen ? "rotate-180" : ""
                        }`}
                    >
                        ▼
                    </span>
                </button>

                {menuOpen && (
                    <div
                        role="menu"
                        className="absolute right-0 z-20 mt-2 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl"
                    >
                        <div className="border-b border-[var(--border)] px-4 py-4">
                            <p className="truncate font-semibold text-[var(--foreground)]">
                                {profile?.name ?? "Hotel staff"}
                            </p>

                            <p className="mt-1 truncate text-sm text-[var(--muted)]">
                                {profile?.email}
                            </p>

                            {profile && (
                                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                                    {formatRole(profile.role)}
                                </p>
                            )}
                        </div>

                        <div className="border-b border-[var(--border)] px-4 py-4">
                            <p
                                id="theme-label"
                                className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]"
                            >
                                Appearance
                            </p>

                            <div
                                role="group"
                                aria-labelledby="theme-label"
                                className="grid grid-cols-3 gap-1 rounded-xl bg-[var(--surface-subtle)] p-1"
                            >
                                {(["light", "dark", "system"] as const).map(
                                    (preference) => (
                                        <button
                                            key={preference}
                                            type="button"
                                            onClick={() =>
                                                chooseTheme(preference)
                                            }
                                            aria-pressed={theme === preference}
                                            className={`focus-ring rounded-lg px-2 py-2 text-xs font-semibold capitalize transition-colors ${
                                                theme === preference
                                                    ? "bg-[var(--surface)] text-[var(--foreground)] shadow-sm"
                                                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                                            }`}
                                        >
                                            {preference}
                                        </button>
                                    )
                                )}
                            </div>
                        </div>

                        {pathname !== "/dashboard" && (
                            <Link
                                href="/dashboard"
                                role="menuitem"
                                onClick={() => setMenuOpen(false)}
                                className="focus-ring block px-4 py-3 text-sm font-medium text-[var(--muted-strong)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                            >
                                Dashboard
                            </Link>
                        )}

                        {profile?.role === "owner" && pathname !== "/owner/users" && (
                            <Link
                                href="/owner/users"
                                role="menuitem"
                                onClick={() => setMenuOpen(false)}
                                className="focus-ring block border-t border-[var(--border)] px-4 py-3 text-sm font-medium text-[var(--muted-strong)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                            >
                                Manage Users
                            </Link>
                        )}

                        {pathname !== "/account/password" && (
                            <Link
                                href="/account/password"
                                role="menuitem"
                                onClick={() => setMenuOpen(false)}
                                className="focus-ring block border-t border-[var(--border)] px-4 py-3 text-sm font-medium text-[var(--muted-strong)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                            >
                                Change Password
                            </Link>
                        )}

                        <button
                            type="button"
                            role="menuitem"
                            onClick={handleLogout}
                            disabled={loggingOut}
                            className="focus-ring w-full border-t border-[var(--border)] px-4 py-3 text-left text-sm font-medium text-[var(--danger)] hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {loggingOut ? "Logging out..." : "Log Out"}
                        </button>
                    </div>
                )}
            </div>
        </header>
    );
}
