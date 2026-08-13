"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
    const router = useRouter();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [errorMessage, setErrorMessage] = useState("");

    async function handleLogin(
        event: React.FormEvent<HTMLFormElement>
    ) {
        event.preventDefault();

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            setErrorMessage(error.message);
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
                        className="primary-action w-full"
                    >
                        Sign In
                    </button>
                </form>
            </div>
        </main>
    );
}
