"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
    const router = useRouter();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [signingIn, setSigningIn] = useState(false);

    async function handleLogin(
        event: React.FormEvent<HTMLFormElement>
    ) {
        event.preventDefault();

        if (signingIn) {
            return;
        }

        setSigningIn(true);
        setErrorMessage("");

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            setErrorMessage(error.message);
            setSigningIn(false);
            return;
        }

        router.push("/dashboard");
    }

    return (
        <main className="app-page flex items-center justify-center">
            <div className="w-full max-w-lg">
                <div className="mb-8 text-center">
                    <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                        Hotel operations
                    </p>

                    <h1 className="page-title">Welcome back</h1>

                    <p className="page-description mt-3">
                        Sign in to manage procurement and hotel inventory.
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
                        <p className="error-message">
                            {errorMessage}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={signingIn}
                        className="primary-action w-full"
                    >
                        {signingIn ? "Signing In..." : "Sign In"}
                    </button>
                </form>
            </div>
        </main>
    );
}
