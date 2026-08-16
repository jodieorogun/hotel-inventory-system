import Link from "next/link";

export default function HomePage() {
    return (
        <main className="app-page flex items-center justify-center">
            <div className="mx-auto w-full max-w-3xl text-center">
                <div className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--accent)] text-2xl font-bold text-[var(--accent-foreground)] shadow-lg">
                    HI
                </div>

                <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
                    Hotel Inventory
                </p>

                <h1 className="page-title mx-auto max-w-2xl">
                    Clear stock control from purchase request to physical receipt
                </h1>

                <p className="page-description mx-auto mt-5 max-w-xl text-lg leading-8">
                    A focused workspace for purchasing, stock control, and
                    everyday hotel store requests.
                </p>

                <Link href="/login" className="primary-action mt-8">
                    Sign in to continue
                </Link>
            </div>
        </main>
    );
}
