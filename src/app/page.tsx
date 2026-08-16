import Link from "next/link";

export default function HomePage() {
    return (
        <main className="app-page flex items-center justify-center">
            <div className="w-full max-w-md text-center">
                <div
                    aria-hidden="true"
                    className="mx-auto mb-7 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent)] text-xl font-semibold text-[var(--accent-foreground)] shadow-sm"
                >
                    J
                </div>

                <h1 className="page-title">JORO Inventory</h1>

                <p className="page-description mx-auto mt-4 max-w-sm">
                    Keep hotel stock, requests, and receipts organised in one
                    place.
                </p>

                <Link href="/login" className="primary-action mt-8 min-w-40">
                    Sign In
                </Link>
            </div>
        </main>
    );
}
