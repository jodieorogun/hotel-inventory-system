"use client";

import { useState } from "react";
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
        <main className="app-page flex items-center justify-center">
            <div className="w-full max-w-lg">
                <div className="mb-8 text-center">
                    <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                        JORO Inventory
                    </p>

                    <h1 className="page-title">Welcome back</h1>

                    <p className="page-description mt-3">
                        Sign in to access your inventory workspace.
                    </p>
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
