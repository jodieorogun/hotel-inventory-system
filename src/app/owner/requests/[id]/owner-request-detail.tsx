"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/app-header";
import { supabase } from "@/lib/supabase";
import PurchaseRequestDetail from "@/app/accountant/requests/[id]/request-detail";
import ReceiptDetail from "@/app/storekeeper/receipts/[id]/receipt-detail";

type RequestSummary = {
    id: number;
    status: string;
};

export default function OwnerRequestDetail({
    requestId,
}: {
    requestId: string;
}) {
    const router = useRouter();
    const [request, setRequest] = useState<RequestSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState("");

    useEffect(() => {
        let ignore = false;

        async function openRequest() {
            if (!/^\d+$/.test(requestId)) {
                setErrorMessage("This purchase request could not be found.");
                setLoading(false);
                return;
            }

            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser();

            if (userError || !user) {
                router.replace("/login");
                return;
            }

            const { data: profile, error: profileError } = await supabase
                .from("users")
                .select("role")
                .eq("id", user.id)
                .single();

            if (profileError) {
                console.error("Error checking owner role:", profileError);

                if (!ignore) {
                    setErrorMessage("Could not verify your account permissions.");
                    setLoading(false);
                }

                return;
            }

            if (profile.role !== "owner") {
                router.replace("/dashboard");
                return;
            }

            const { data, error } = await supabase
                .from("purchase_requests")
                .select("id, status")
                .eq("id", Number(requestId))
                .maybeSingle();

            if (error) {
                console.error("Error opening owner request:", error);

                if (!ignore) {
                    setErrorMessage("Could not open this purchase request.");
                    setLoading(false);
                }

                return;
            }

            if (!data) {
                if (!ignore) {
                    setErrorMessage("This purchase request could not be found.");
                    setLoading(false);
                }

                return;
            }

            if (!ignore) {
                setRequest(data as RequestSummary);
                setLoading(false);
            }
        }

        openRequest();

        return () => {
            ignore = true;
        };
    }, [requestId, router]);

    if (loading) {
        return (
            <main className="app-page">
                <div className="mx-auto max-w-7xl">
                    <AppHeader />
                    <p className="text-muted">Opening purchase request...</p>
                </div>
            </main>
        );
    }

    if (!request) {
        return (
            <main className="app-page">
                <div className="mx-auto max-w-7xl">
                    <AppHeader />
                    <div className="error-message" role="alert">
                        {errorMessage}
                    </div>
                    <Link href="/dashboard" className="secondary-action mt-6">
                        Back to Dashboard
                    </Link>
                </div>
            </main>
        );
    }

    const isReceiptStage = ["approved", "received", "receipt_issue"].includes(
        request.status
    );
    return isReceiptStage ? (
        <ReceiptDetail requestId={requestId} />
    ) : (
        <PurchaseRequestDetail requestId={requestId} />
    );
}
