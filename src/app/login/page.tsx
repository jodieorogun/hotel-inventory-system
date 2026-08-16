"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
    const router = useRouter();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [signingIn, setSigningIn] = useState(false);
    const [sendingReset, setSendingReset] = useState(false);

    async function handleLogin(
        event: React.FormEvent<HTMLFormElement>
    ) {
        event.preventDefault();

        if (signingIn) {
            return;
        }

        setSigningIn(true);
        setErrorMessage("");
        setSuccessMessage("");

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            setErrorMessage(
                error.code === "user_banned"
                    ? "This account has been deactivated. Ask the Owner to reactivate it."
                    : error.message
            );
            setSigningIn(false);
            return;
        }

        router.replace("/dashboard");
        router.refresh();
    }

    async function handlePasswordReset() {
        const normalizedEmail = email.trim().toLowerCase();

        setErrorMessage("");
        setSuccessMessage("");

        if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
            setErrorMessage("Enter your email address first.");
            return;
        }

        setSendingReset(true);

        const { error } = await supabase.auth.resetPasswordForEmail(
            normalizedEmail,
            {
                redirectTo: `${window.location.origin}/setup-password`,
            }
        );

        if (error) {
            console.error("Error sending password reset email:", error);
            setErrorMessage(
                error.message ||
                    "We could not send the password reset email. Please try again."
            );
            setSendingReset(false);
            return;
        }

        setSuccessMessage(
            `Password reset instructions have been sent to ${normalizedEmail}.`
        );
        setSendingReset(false);
    }

    return (
        <main className="app-page relative flex items-center justify-center overflow-hidden">
            <div
                aria-hidden="true"
                className="absolute -top-24 -right-20 h-72 w-72 rounded-full bg-[var(--accent-soft)] opacity-80 blur-2xl sm:h-96 sm:w-96"
            />
            <div
                aria-hidden="true"
                className="absolute -bottom-20 -left-16 h-48 w-48 rotate-12 rounded-[3.5rem] border-[1.5rem] border-[var(--accent-soft)] sm:h-64 sm:w-64"
            />

            <div className="relative w-full max-w-lg">
                <div className="mb-7 text-center">
                    <div className="relative mx-auto h-24 w-full max-w-64 sm:h-28">
                        <Image
                            src="/brand/joro-logo-light.png"
                            alt="JORO Inventory"
                            fill
                            priority
                            sizes="256px"
                            className="object-contain dark:hidden"
                        />
                        <Image
                            src="/brand/joro-logo-dark.png"
                            alt="JORO Inventory"
                            fill
                            priority
                            sizes="256px"
                            className="hidden object-contain dark:block"
                        />
                    </div>

                    <h1 className="page-title mt-5">Welcome</h1>
                </div>

                <form
                    onSubmit={handleLogin}
                    onKeyDown={(event) => {
                        if (
                            event.key === "Enter" &&
                            !event.shiftKey &&
                            event.target instanceof HTMLInputElement
                        ) {
                            event.preventDefault();
                            event.currentTarget.requestSubmit();
                        }
                    }}
                    className="surface-card space-y-6 p-6 sm:p-8"
                >
                    <div>
                        <label className="form-label" htmlFor="email">
                            Email
                        </label>

                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(event) =>
                                setEmail(event.target.value)
                            }
                            className="form-control"
                            autoComplete="email"
                            required
                        />
                    </div>

                    <div>
                        <label className="form-label" htmlFor="password">
                            Password
                        </label>

                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(event) =>
                                setPassword(event.target.value)
                            }
                            className="form-control"
                            autoComplete="current-password"
                            required
                        />
                    </div>

                    {errorMessage && (
                        <p className="error-message" role="alert">
                            {errorMessage}
                        </p>
                    )}

                    {successMessage && (
                        <p
                            className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                            role="status"
                        >
                            {successMessage}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={signingIn}
                        className="primary-action w-full"
                    >
                        {signingIn ? "Signing In..." : "Sign In"}
                    </button>

                    <button
                        type="button"
                        disabled={signingIn || sendingReset}
                        onClick={handlePasswordReset}
                        className="text-muted block w-full text-center text-sm underline decoration-transparent underline-offset-4 transition hover:text-[var(--foreground)] hover:decoration-current disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {sendingReset
                            ? "Sending password reset..."
                            : "Forgot password?"}
                    </button>
                </form>
            </div>
        </main>
    );
}
