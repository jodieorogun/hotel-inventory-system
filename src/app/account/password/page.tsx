"use client";

import { useState } from "react";
import Link from "next/link";
import AppHeader from "@/components/app-header";
import { supabase } from "@/lib/supabase";

export default function ChangePasswordPage() {
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmation, setConfirmation] = useState("");
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [saving, setSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    async function changePassword(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (saving) {
            return;
        }

        setErrorMessage("");
        setSuccessMessage("");

        if (newPassword.length < 8) {
            setErrorMessage("Use at least 8 characters for your new password.");
            return;
        }

        if (newPassword !== confirmation) {
            setErrorMessage("The two new passwords do not match.");
            return;
        }

        if (currentPassword === newPassword) {
            setErrorMessage("Choose a new password that is different from your current password.");
            return;
        }

        setSaving(true);

        const { error } = await supabase.auth.updateUser({
            password: newPassword,
            current_password: currentPassword,
        });

        if (error) {
            console.error("Error changing password:", error);
            setErrorMessage(
                error.message.toLowerCase().includes("password")
                    ? error.message
                    : "Your password could not be changed. Check your current password and try again."
            );
            setSaving(false);
            return;
        }

        setCurrentPassword("");
        setNewPassword("");
        setConfirmation("");
        setSuccessMessage("Your password has been changed.");
        setSaving(false);
    }

    return (
        <>
            <AppHeader />

            <main className="app-page">
                <div className="mx-auto w-full max-w-xl">
                    <div className="mb-8">
                        <p className="mb-2 text-sm font-semibold text-[var(--accent)]">
                            Account security
                        </p>
                        <h1 className="page-title">Change Password</h1>
                        <p className="page-description mt-3">
                            Enter your current password before choosing a new one.
                        </p>
                    </div>

                    <form
                        onSubmit={changePassword}
                        className="surface-card space-y-5 p-6 sm:p-8"
                    >
                        <div>
                            <label className="form-label" htmlFor="current-password">
                                Current password
                            </label>
                            <div className="relative"><input id="current-password" type={showCurrent ? "text" : "password"} value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" className="form-control pr-12" required /><button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 p-2" onClick={() => setShowCurrent((value) => !value)} aria-label={showCurrent ? "Hide password" : "Show password"}><span className={`password-eye ${!showCurrent ? "password-eye-hidden" : ""}`} aria-hidden="true" /></button></div>
                        </div>

                        <div>
                            <label className="form-label" htmlFor="new-account-password">
                                New password
                            </label>
                            <div className="relative"><input id="new-account-password" type={showNew ? "text" : "password"} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={8} autoComplete="new-password" className="form-control pr-12" required /><button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 p-2" onClick={() => setShowNew((value) => !value)} aria-label={showNew ? "Hide password" : "Show password"}><span className={`password-eye ${!showNew ? "password-eye-hidden" : ""}`} aria-hidden="true" /></button></div>
                            <p className="text-muted mt-2 text-xs">
                                Use at least 8 characters.
                            </p>
                        </div>

                        <div>
                            <label className="form-label" htmlFor="confirm-account-password">
                                Confirm new password
                            </label>
                            <div className="relative"><input id="confirm-account-password" type={showConfirmation ? "text" : "password"} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} minLength={8} autoComplete="new-password" className="form-control pr-12" required /><button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 p-2" onClick={() => setShowConfirmation((value) => !value)} aria-label={showConfirmation ? "Hide password" : "Show password"}><span className={`password-eye ${!showConfirmation ? "password-eye-hidden" : ""}`} aria-hidden="true" /></button></div>
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

                        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                            <Link href="/dashboard" className="secondary-action text-center">
                                Cancel
                            </Link>
                            <button
                                type="submit"
                                disabled={saving}
                                className="primary-action"
                            >
                                {saving ? "Changing Password..." : "Change Password"}
                            </button>
                        </div>
                    </form>
                </div>
            </main>
        </>
    );
}
