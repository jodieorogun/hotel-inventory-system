export type RequestHistoryEntry = {
    action: string;
    person: string;
    timestamp: string;
    detail?: string | null;
};

function formatDateTime(value: string) {
    return new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(value));
}

export default function RequestHistory({
    entries,
}: {
    entries: RequestHistoryEntry[];
}) {
    if (entries.length === 0) {
        return null;
    }

    return (
        <section className="surface-card mt-8 p-6 lg:p-7">
            <h2 className="text-lg font-semibold">Request History</h2>

            <ol className="mt-5 space-y-5">
                {entries.map((entry, index) => (
                    <li
                        key={`${entry.action}-${entry.timestamp}`}
                        className="relative flex gap-4"
                    >
                        <div className="relative flex w-3 shrink-0 justify-center">
                            {index < entries.length - 1 && (
                                <span
                                    aria-hidden="true"
                                    className="absolute top-3 h-[calc(100%+1.25rem)] w-px bg-[var(--border)]"
                                />
                            )}
                            <span
                                aria-hidden="true"
                                className="relative mt-1.5 h-2.5 w-2.5 rounded-full bg-[var(--foreground)]"
                            />
                        </div>

                        <div className="min-w-0 pb-1">
                            <p>
                                <span className="font-semibold">
                                    {entry.action}
                                </span>{" "}
                                by {entry.person} at{" "}
                                {formatDateTime(entry.timestamp)}
                            </p>
                            {entry.detail && (
                                <p className="text-muted mt-1 whitespace-pre-wrap text-sm">
                                    {entry.detail}
                                </p>
                            )}
                        </div>
                    </li>
                ))}
            </ol>
        </section>
    );
}
