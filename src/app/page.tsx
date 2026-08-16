import Link from "next/link";

export default function HomePage() {
    return (
        <main className="app-page relative flex items-center justify-center overflow-hidden">
            <div
                aria-hidden="true"
                className="absolute -top-24 -right-20 h-72 w-72 rounded-full bg-[var(--accent-soft)] opacity-80 blur-2xl sm:h-96 sm:w-96"
            />
            <div
                aria-hidden="true"
                className="absolute -bottom-20 -left-16 h-48 w-48 rounded-[3.5rem] border-[1.5rem] border-[var(--accent-soft)] rotate-12 sm:h-64 sm:w-64"
            />

            <div className="relative w-full max-w-xl text-center">
                <h1 className="leading-none">
                    <span className="block text-[clamp(4.75rem,19vw,9rem)] font-semibold tracking-[-0.085em] text-[var(--foreground)]">
                        JOR<span className="text-[var(--accent)]">O</span>
                    </span>
                    <span className="mt-3 block text-[clamp(1rem,4vw,1.45rem)] font-medium uppercase tracking-[0.48em] text-[var(--muted-strong)]">
                        Inventory
                    </span>
                </h1>

                <Link href="/login" className="primary-action mt-12 min-w-40">
                    Sign In
                </Link>
            </div>
        </main>
    );
}
