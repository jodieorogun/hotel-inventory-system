import Image from "next/image";
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
                <h1 className="sr-only">JORO Inventory</h1>

                <div className="relative mx-auto h-44 w-full sm:h-56">
                    <Image
                        src="/brand/joro-logo-light.png"
                        alt=""
                        fill
                        priority
                        sizes="(max-width: 640px) calc(100vw - 40px), 576px"
                        className="object-contain dark:hidden"
                    />
                    <Image
                        src="/brand/joro-logo-dark.png"
                        alt=""
                        fill
                        priority
                        sizes="(max-width: 640px) calc(100vw - 40px), 576px"
                        className="hidden object-contain dark:block"
                    />
                </div>

                <Link href="/login" className="primary-action mt-8 min-w-40">
                    Sign In
                </Link>
            </div>
        </main>
    );
}
