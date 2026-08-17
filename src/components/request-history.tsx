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

    const entriesByEvent = new Map<string, RequestHistoryEntry>();

    for (const entry of entries) {
        const eventKey = [
            entry.action.trim().toLowerCase(),
            entry.person.trim().toLowerCase(),
            entry.timestamp,
        ].join("|");
        const existingEntry = entriesByEvent.get(eventKey);

        // A database trigger and an RPC can occasionally record the same
        // workflow event in one transaction. Keep one row, preferring the
        // version with useful detail.
        if (
            !existingEntry ||
            (!existingEntry.detail && Boolean(entry.detail))
        ) {
            entriesByEvent.set(eventKey, entry);
        }
    }

    const orderedEntries = [...entriesByEvent.entries()].sort(
        (first, second) =>
            new Date(first[1].timestamp).getTime() -
            new Date(second[1].timestamp).getTime()
    );

    return (
        <section className="surface-card mt-8 p-6 lg:p-7">
            <h2 className="text-lg font-semibold">Request History</h2>

            <ol className="mt-5 space-y-5">
                {orderedEntries.map(([eventKey, entry], index) => (
                    <li
                        key={eventKey}
                        className="relative flex gap-4"
                    >
                        <div className="relative flex w-3 shrink-0 justify-center">
                            {index < orderedEntries.length - 1 && (
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
