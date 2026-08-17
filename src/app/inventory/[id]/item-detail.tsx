"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/app-header";
import { formatStaffRole } from "@/lib/staff-roles";
import { supabase } from "@/lib/supabase";
import { formatQuantity } from "@/lib/units";

type InventoryItem = {
    id: number;
    name: string;
    category: string;
    current_quantity: number | string;
    unit: string;
    purchase_unit: string;
    units_per_purchase_unit: number | string;
};

type PurchaseLineRow = {
    request_id: number;
    received_stock_quantity: number | string | null;
};

type PurchaseRequestRow = {
    id: number;
    storekeeper_verified_at: string | null;
    storekeeper_verified_by: string | null;
};

type StockRequestLineRow = {
    request_id: number;
    issued_quantity: number | string | null;
};

type StockRequestRow = {
    id: number;
    requested_by: string;
    storekeeper_confirmed_at: string | null;
    storekeeper_confirmed_by: string | null;
};

type StockCheckLineRow = {
    stock_check_id: number;
    expected_quantity: number | string;
    physical_quantity: number | string;
    variance: number | string;
};

type StockCheckRow = {
    id: number;
    completed_at: string;
    completed_by: string;
};

type UserRow = {
    id: string;
    name: string;
    role: string;
    department: string | null;
};

type StockMovement = {
    id: string;
    kind: "received" | "issued" | "adjusted";
    date: string;
    quantity: number;
    person: string;
    role: string;
    relatedLabel: string;
    relatedHref: string | null;
    locationLabel: string;
    location: string;
    detail: string | null;
};

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
});

const movementStyle = {
    received: {
        label: "Stock received",
        sign: "+",
        colour:
            "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
        dot: "bg-emerald-500 dark:bg-emerald-400",
    },
    issued: {
        label: "Stock handed out",
        sign: "−",
        colour:
            "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
        dot: "bg-amber-400 dark:bg-amber-300",
    },
    adjusted: {
        label: "Stock adjusted",
        sign: "",
        colour:
            "bg-sky-50 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
        dot: "bg-sky-500 dark:bg-sky-400",
    },
} as const;

function uniqueNumbers(values: number[]) {
    return [...new Set(values)];
}

function purchaseRequestHref(role: string, requestId: number) {
    if (role === "owner") return `/owner/requests/${requestId}`;
    if (role === "accountant") return `/accountant/requests/${requestId}`;
    if (role === "storekeeper") return `/storekeeper/receipts/${requestId}`;
    return null;
}

function stockRequestHref(role: string, requestId: number) {
    return ["owner", "storekeeper"].includes(role)
        ? `/storekeeper/stock-out/${requestId}`
        : null;
}

export default function InventoryItemDetail({ itemId }: { itemId: string }) {
    const router = useRouter();
    const [item, setItem] = useState<InventoryItem | null>(null);
    const [movements, setMovements] = useState<StockMovement[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState("");

    useEffect(() => {
        let ignore = false;

        async function loadItem() {
            const numericId = Number(itemId);

            if (!Number.isInteger(numericId) || numericId <= 0) {
                setErrorMessage("This inventory item could not be found.");
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

            const [profileResult, itemResult, purchaseLinesResult, stockLinesResult, checkLinesResult] =
                await Promise.all([
                    supabase
                        .from("users")
                        .select("role")
                        .eq("id", user.id)
                        .single(),
                    supabase
                        .from("items")
                        .select(
                            "id, name, category, current_quantity, unit, purchase_unit, units_per_purchase_unit"
                        )
                        .eq("id", numericId)
                        .maybeSingle(),
                    supabase
                        .from("purchase_requests_items")
                        .select("request_id, received_stock_quantity")
                        .eq("item_id", numericId)
                        .not("received_stock_quantity", "is", null),
                    supabase
                        .from("stock_out_request_items")
                        .select("request_id, issued_quantity")
                        .eq("item_id", numericId)
                        .not("issued_quantity", "is", null),
                    supabase
                        .from("stock_check_items")
                        .select(
                            "stock_check_id, expected_quantity, physical_quantity, variance"
                        )
                        .eq("item_id", numericId),
                ]);

            const firstError =
                profileResult.error ??
                itemResult.error ??
                purchaseLinesResult.error ??
                stockLinesResult.error ??
                checkLinesResult.error;

            if (firstError || !profileResult.data || !itemResult.data) {
                console.error("Error loading inventory item history:", firstError);
                if (!ignore) {
                    setErrorMessage(
                        itemResult.data
                            ? "Could not load this item's stock history."
                            : "This inventory item could not be found."
                    );
                    setLoading(false);
                }
                return;
            }

            const viewerRole = profileResult.data.role as string;
            const purchaseLines = (purchaseLinesResult.data ?? []) as PurchaseLineRow[];
            const stockLines = (stockLinesResult.data ?? []) as StockRequestLineRow[];
            const checkLines = (checkLinesResult.data ?? []) as StockCheckLineRow[];
            const purchaseIds = uniqueNumbers(
                purchaseLines.map((line) => line.request_id)
            );
            const stockRequestIds = uniqueNumbers(
                stockLines.map((line) => line.request_id)
            );
            const stockCheckIds = uniqueNumbers(
                checkLines.map((line) => line.stock_check_id)
            );

            const [purchasesResult, stockRequestsResult, checksResult] =
                await Promise.all([
                    purchaseIds.length
                        ? supabase
                              .from("purchase_requests")
                              .select(
                                  "id, storekeeper_verified_at, storekeeper_verified_by"
                              )
                              .in("id", purchaseIds)
                        : Promise.resolve({ data: [], error: null }),
                    stockRequestIds.length
                        ? supabase
                              .from("stock_out_requests")
                              .select(
                                  "id, requested_by, storekeeper_confirmed_at, storekeeper_confirmed_by"
                              )
                              .in("id", stockRequestIds)
                        : Promise.resolve({ data: [], error: null }),
                    stockCheckIds.length
                        ? supabase
                              .from("stock_checks")
                              .select("id, completed_at, completed_by")
                              .in("id", stockCheckIds)
                        : Promise.resolve({ data: [], error: null }),
                ]);

            const relationshipError =
                purchasesResult.error ??
                stockRequestsResult.error ??
                checksResult.error;

            if (relationshipError) {
                console.error(
                    "Error loading related stock movements:",
                    relationshipError
                );
                if (!ignore) {
                    setErrorMessage("Could not load this item's stock history.");
                    setLoading(false);
                }
                return;
            }

            const purchases = (purchasesResult.data ?? []) as PurchaseRequestRow[];
            const stockRequests = (stockRequestsResult.data ?? []) as StockRequestRow[];
            const checks = (checksResult.data ?? []) as StockCheckRow[];
            const userIds = [
                ...purchases.map((request) => request.storekeeper_verified_by),
                ...stockRequests.flatMap((request) => [
                    request.requested_by,
                    request.storekeeper_confirmed_by,
                ]),
                ...checks.map((check) => check.completed_by),
            ].filter((id): id is string => Boolean(id));
            const { data: userData, error: profilesError } = userIds.length
                ? await supabase
                      .from("users")
                      .select("id, name, role, department")
                      .in("id", [...new Set(userIds)])
                : { data: [], error: null };

            if (profilesError) {
                console.error("Error loading stock movement users:", profilesError);
            }

            const usersById = new Map(
                ((userData ?? []) as UserRow[]).map((profile) => [
                    profile.id,
                    profile,
                ])
            );
            const purchasesById = new Map(
                purchases.map((request) => [request.id, request])
            );
            const stockRequestsById = new Map(
                stockRequests.map((request) => [request.id, request])
            );
            const checksById = new Map(
                checks.map((check) => [check.id, check])
            );
            const history: StockMovement[] = [];

            for (const line of purchaseLines) {
                const request = purchasesById.get(line.request_id);
                const quantity = Number(line.received_stock_quantity ?? 0);

                if (!request?.storekeeper_verified_at || quantity <= 0) continue;

                const actor = request.storekeeper_verified_by
                    ? usersById.get(request.storekeeper_verified_by)
                    : null;
                history.push({
                    id: `received:${line.request_id}`,
                    kind: "received",
                    date: request.storekeeper_verified_at,
                    quantity,
                    person: actor?.name ?? "Storekeeper",
                    role: actor?.role ?? "storekeeper",
                    relatedLabel: `Purchase Request #${line.request_id}`,
                    relatedHref: purchaseRequestHref(viewerRole, line.request_id),
                    locationLabel: "Destination",
                    location: "Hotel store room",
                    detail: null,
                });
            }

            for (const line of stockLines) {
                const request = stockRequestsById.get(line.request_id);
                const quantity = Number(line.issued_quantity ?? 0);

                if (!request?.storekeeper_confirmed_at || quantity <= 0) continue;

                const actor = request.storekeeper_confirmed_by
                    ? usersById.get(request.storekeeper_confirmed_by)
                    : null;
                const requester = usersById.get(request.requested_by);
                history.push({
                    id: `issued:${line.request_id}`,
                    kind: "issued",
                    date: request.storekeeper_confirmed_at,
                    quantity: -quantity,
                    person: actor?.name ?? "Storekeeper",
                    role: actor?.role ?? "storekeeper",
                    relatedLabel: `Stock Request #${line.request_id}`,
                    relatedHref: stockRequestHref(viewerRole, line.request_id),
                    locationLabel: "Destination",
                    location:
                        requester?.department?.trim() ||
                        requester?.name ||
                        "Hotel staff",
                    detail: requester?.name
                        ? `Requested by ${requester.name}`
                        : null,
                });
            }

            for (const line of checkLines) {
                const check = checksById.get(line.stock_check_id);
                const variance = Number(line.variance);

                if (!check || variance === 0) continue;

                const actor = usersById.get(check.completed_by);
                history.push({
                    id: `adjusted:${line.stock_check_id}`,
                    kind: "adjusted",
                    date: check.completed_at,
                    quantity: variance,
                    person: actor?.name ?? "Owner",
                    role: actor?.role ?? "owner",
                    relatedLabel: `Stock Check #${line.stock_check_id}`,
                    relatedHref:
                        viewerRole === "owner"
                            ? `/owner/stock-checks/${line.stock_check_id}`
                            : null,
                    locationLabel: "Reason",
                    location: "Physical stock count",
                    detail: `Expected ${formatQuantity(Number(line.expected_quantity), itemResult.data.unit)}; counted ${formatQuantity(Number(line.physical_quantity), itemResult.data.unit)}.`,
                });
            }

            history.sort(
                (first, second) =>
                    new Date(second.date).getTime() -
                    new Date(first.date).getTime()
            );

            if (!ignore) {
                setItem(itemResult.data as InventoryItem);
                setMovements(history);
                setLoading(false);
            }
        }

        loadItem();

        return () => {
            ignore = true;
        };
    }, [itemId, router]);

    if (loading) {
        return (
            <main className="app-page">
                <div className="mx-auto max-w-6xl">
                    <AppHeader />
                    <p className="text-muted">Loading item history...</p>
                </div>
            </main>
        );
    }

    if (!item || errorMessage) {
        return (
            <main className="app-page">
                <div className="mx-auto max-w-6xl">
                    <AppHeader />
                    <p className="error-message" role="alert">
                        {errorMessage || "This inventory item could not be found."}
                    </p>
                    <Link href="/inventory" className="secondary-action mt-6">
                        Back to Inventory
                    </Link>
                </div>
            </main>
        );
    }

    const currentQuantity = Number(item.current_quantity);
    const receivedTotal = movements
        .filter((movement) => movement.kind === "received")
        .reduce((sum, movement) => sum + movement.quantity, 0);
    const issuedTotal = Math.abs(
        movements
            .filter((movement) => movement.kind === "issued")
            .reduce((sum, movement) => sum + movement.quantity, 0)
    );

    return (
        <main className="app-page">
            <div className="mx-auto max-w-6xl">
                <AppHeader />

                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <p className="text-muted text-sm font-medium">
                            {item.category}
                        </p>
                        <h1 className="page-title mt-2">{item.name}</h1>
                        <p className="page-description mt-2">
                            Complete stock history for this item.
                        </p>
                    </div>
                    <Link href="/inventory" className="secondary-action text-center">
                        Back to Inventory
                    </Link>
                </div>

                <section
                    className="mt-8 grid gap-4 sm:grid-cols-3"
                    aria-label="Item details"
                >
                    <div className="surface-card p-5">
                        <p className="text-muted text-sm">Current stock</p>
                        <p className="mt-2 text-2xl font-semibold">
                            {formatQuantity(currentQuantity, item.unit)}
                        </p>
                    </div>
                    <div className="surface-card p-5">
                        <p className="text-muted text-sm">Category</p>
                        <p className="mt-2 text-lg font-semibold">{item.category}</p>
                    </div>
                    <div className="surface-card p-5">
                        <p className="text-muted text-sm">Stock unit</p>
                        <p className="mt-2 text-lg font-semibold">{item.unit}</p>
                    </div>
                </section>

                <section className="mt-10" aria-labelledby="movement-history-title">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <h2 id="movement-history-title" className="text-xl font-semibold">
                                Stock History
                            </h2>
                            <p className="text-muted mt-1 text-sm">
                                {formatQuantity(receivedTotal, item.unit)} received · {formatQuantity(issuedTotal, item.unit)} handed out
                            </p>
                        </div>
                        <p className="text-muted text-sm">
                            {movements.length} {movements.length === 1 ? "movement" : "movements"}
                        </p>
                    </div>

                    {movements.length === 0 ? (
                        <div className="surface-card mt-4 p-8 text-center">
                            <p className="font-medium">No stock movements recorded yet.</p>
                            <p className="text-muted mt-2 text-sm">
                                Receipts, handouts and stock-check adjustments will appear here.
                            </p>
                        </div>
                    ) : (
                        <ol className="surface-card mt-4 overflow-hidden">
                            {movements.map((movement) => {
                                const style = movementStyle[movement.kind];
                                const quantityPrefix =
                                    movement.quantity > 0 ? "+" : movement.quantity < 0 ? "−" : "";

                                return (
                                    <li
                                        key={movement.id}
                                        className="border-b border-[var(--border)] p-5 last:border-b-0 sm:p-6"
                                    >
                                        <div className="flex gap-4">
                                            <span
                                                aria-hidden="true"
                                                className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${style.dot}`}
                                            />
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                    <div>
                                                        <p className="font-semibold">{style.label}</p>
                                                        <p className="text-muted mt-1 text-sm">
                                                            {formatStaffRole(movement.role)} — {movement.person}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-3 sm:flex-col sm:items-end sm:gap-1">
                                                        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${style.colour}`}>
                                                            {quantityPrefix}
                                                            {formatQuantity(Math.abs(movement.quantity), item.unit)}
                                                        </span>
                                                        <time className="text-muted text-sm" dateTime={movement.date}>
                                                            {dateTimeFormatter.format(new Date(movement.date))}
                                                        </time>
                                                    </div>
                                                </div>

                                                <dl className="mt-4 grid gap-3 border-t border-[var(--border)] pt-4 text-sm sm:grid-cols-2">
                                                    <div>
                                                        <dt className="text-muted">Related record</dt>
                                                        <dd className="mt-1 font-medium">
                                                            {movement.relatedHref ? (
                                                                <Link
                                                                    href={movement.relatedHref}
                                                                    className="text-[var(--accent)] hover:underline"
                                                                >
                                                                    {movement.relatedLabel}
                                                                </Link>
                                                            ) : (
                                                                movement.relatedLabel
                                                            )}
                                                        </dd>
                                                    </div>
                                                    <div>
                                                        <dt className="text-muted">
                                                            {movement.locationLabel}
                                                        </dt>
                                                        <dd className="mt-1 font-medium">
                                                            {movement.location}
                                                        </dd>
                                                    </div>
                                                </dl>

                                                {movement.detail && (
                                                    <p className="text-muted mt-3 text-sm">
                                                        {movement.detail}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ol>
                    )}
                </section>
            </div>
        </main>
    );
}
