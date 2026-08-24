"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type SetupAccount = {
    id: string;
    email: string;
};

export default function SetupPasswordPage() {
    const router = useRouter();
    const [password, setPassword] = useState("");
    const [confirmation, setConfirmation] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [checkingSession, setCheckingSession] = useState(true);
    const [setupAccount, setSetupAccount] = useState<SetupAccount | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        let ignore = false;

        async function openSetupLink() {
            const query = new URLSearchParams(window.location.search);
            const hash = new URLSearchParams(
                window.location.hash.startsWith("#")
                    ? window.location.hash.slice(1)
                    : window.location.hash
            );
            const code = query.get("code");
            const accessToken = hash.get("access_token");
            const refreshToken = hash.get("refresh_token");

            // Never trust a session that was already open in this browser.
            // The account must come from this specific invite/recovery link.
            if (!code && (!accessToken || !refreshToken)) {
                if (!ignore) {
                    setSetupAccount(null);
                    setCheckingSession(false);
                }
                return;
            }

            const result = code
                ? await supabase.auth.exchangeCodeForSession(code)
                : await supabase.auth.setSession({
                      access_token: accessToken as string,
                      refresh_token: refreshToken as string,
                  });

            if (ignore) {
                return;
            }

            if (result.error || !result.data.session?.user) {
                console.error("Error opening password setup link:", result.error);
                setSetupAccount(null);
                setCheckingSession(false);
                return;
            }

            const linkedUser = result.data.session.user;

            setSetupAccount({
                id: linkedUser.id,
                email: linkedUser.email ?? "this staff account",
            });
            setCheckingSession(false);

            // Remove one-time credentials from the address bar after the
            // correct account has been established.
            window.history.replaceState(
                null,
                "",
                window.location.pathname
            );
        }

        openSetupLink().catch((error) => {
            console.error("Error processing password setup link:", error);
            if (!ignore) {
                setSetupAccount(null);
                setCheckingSession(false);
            }
        });

        return () => {
            ignore = true;
        };
    }, []);

    async function savePassword(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setErrorMessage("");

        if (!setupAccount) {
            setErrorMessage(
                "This setup link is invalid or has expired. Ask the Owner to send a new password link."
            );
            return;
        }

        if (password.length < 8) {
            setErrorMessage("Use at least 8 characters for your password.");
            return;
        }

        if (password !== confirmation) {
            setErrorMessage("The two passwords do not match.");
            return;
        }

        setSubmitting(true);

        const { data: currentUser, error: userError } =
            await supabase.auth.getUser();

        if (userError || currentUser.user?.id !== setupAccount.id) {
            setErrorMessage(
                "This setup session no longer matches the account in the email link. Open a new password link and try again."
            );
            setSubmitting(false);
            return;
        }

        const { error } = await supabase.auth.updateUser({ password });

        if (error) {
            setErrorMessage(error.message);
            setSubmitting(false);
            return;
        }

        setSuccess(true);
        setTimeout(() => {
            router.replace("/dashboard");
            router.refresh();
        }, 800);
    }

    return (
        <main className="app-page flex items-center justify-center">
            <div className="surface-card w-full max-w-md p-8">
                <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent)] text-xl font-bold text-[var(--accent-foreground)]">
                    HI
                </div>
                <h1 className="text-center text-2xl font-semibold">Set Up Your Password</h1>
                <p className="text-muted mt-2 text-center text-sm">
                    Choose the password you will use to sign in to Hotel Inventory.
                </p>

                {checkingSession ? (
                    <p className="text-muted mt-7 text-center">Checking your setup link...</p>
                ) : !setupAccount ? (
                    <div className="error-message mt-7" role="alert">
                        This setup link is invalid or has expired. Ask the Owner to send a new password link.
                    </div>
                ) : success ? (
                    <p className="mt-7 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300" role="status">
                        Password saved. Opening your dashboard...
                    </p>
                ) : (
                    <form onSubmit={savePassword} className="mt-7 space-y-5">
                        <p className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-center text-sm">
                            Setting a password for <strong>{setupAccount.email}</strong>
                        </p>
                        <div>
                            <label className="form-label" htmlFor="new-password">New password</label>
                            <div className="relative"><input id="new-password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} autoComplete="new-password" className="form-control pr-12" required /><button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 p-2" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}><span className={`password-eye ${!showPassword ? "password-eye-hidden" : ""}`} aria-hidden="true" /></button></div>
                        </div>
                        <div>
                            <label className="form-label" htmlFor="confirm-password">Confirm password</label>
                            <div className="relative"><input id="confirm-password" type={showConfirmation ? "text" : "password"} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} minLength={8} autoComplete="new-password" className="form-control pr-12" required /><button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 p-2" onClick={() => setShowConfirmation((value) => !value)} aria-label={showConfirmation ? "Hide password" : "Show password"}><span className={`password-eye ${!showConfirmation ? "password-eye-hidden" : ""}`} aria-hidden="true" /></button></div>
                        </div>
                        {errorMessage && (
                            <p className="error-message" role="alert">{errorMessage}</p>
                        )}
                        <button type="submit" disabled={submitting} className="primary-action w-full">
                            {submitting ? "Saving Password..." : "Save Password"}
                        </button>
                    </form>
                )}
            </div>
        </main>
    );
}
