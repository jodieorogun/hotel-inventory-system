"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AccountAccessGuard() {
    const router = useRouter();

    useEffect(() => {
        let checking = false;

        async function verifyCurrentAccount() {
            if (checking) return;
            checking = true;

            const {
                data: { session },
            } = await supabase.auth.getSession();

            if (session) {
                const { error } = await supabase.auth.getUser();

                // Network errors and temporary Auth failures must never log a
                // valid member of staff out. Only an explicit Supabase ban is
                // evidence that the Owner deactivated this account.
                if (error?.code === "user_banned") {
                    await supabase.auth.signOut();
                    router.replace("/login");
                    router.refresh();
                }
            }

            checking = false;
        }

        function verifyWhenVisible() {
            if (document.visibilityState === "visible") {
                verifyCurrentAccount();
            }
        }

        const interval = window.setInterval(verifyCurrentAccount, 60_000);
        window.addEventListener("focus", verifyCurrentAccount);
        document.addEventListener("visibilitychange", verifyWhenVisible);

        return () => {
            window.clearInterval(interval);
            window.removeEventListener("focus", verifyCurrentAccount);
            document.removeEventListener("visibilitychange", verifyWhenVisible);
        };
    }, [router]);

    return null;
}
