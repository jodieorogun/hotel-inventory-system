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
        <main className="flex min-h-screen items-center justify-center bg-black p-8 text-white">
            <div className="w-full max-w-md">
                <h1 className="mb-8 text-3xl font-bold">
                    Hotel Inventory
                </h1>

                <form
                    onSubmit={handleLogin}
                    className="space-y-6"
                >
                    <div>
                        <label className="mb-2 block">
                            Email
                        </label>

                        <input
                            type="email"
                            value={email}
                            onChange={(event) =>
                                setEmail(event.target.value)
                            }
                            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3"
                            required
                        />
                    </div>

                    <div>
                        <label className="mb-2 block">
                            Password
                        </label>

                        <input
                            type="password"
                            value={password}
                            onChange={(event) =>
                                setPassword(event.target.value)
                            }
                            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3"
                            required
                        />
                    </div>

                    {errorMessage && (
                        <p className="text-red-400">
                            {errorMessage}
                        </p>
                    )}

                    <button
                        type="submit"
                        className="w-full rounded-lg bg-white px-4 py-3 font-semibold text-black"
                    >
                        Sign In
                    </button>
                </form>
            </div>
        </main>
    );
}