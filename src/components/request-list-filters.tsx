import ListSearch from "@/components/list-search";

export type DateFilterValue =
    | "any"
    | "today"
    | "yesterday"
    | "last7"
    | "date";

type Tab = {
    value: string;
    label: string;
};

function localDateKey(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

export function matchesDateFilter(
    timestamp: string,
    filter: DateFilterValue,
    pickedDate: string
) {
    if (filter === "any") {
        return true;
    }

    const eventDate = new Date(timestamp);
    const today = new Date();
    const eventKey = localDateKey(eventDate);

    if (filter === "today") {
        return eventKey === localDateKey(today);
    }

    if (filter === "yesterday") {
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        return eventKey === localDateKey(yesterday);
    }

    if (filter === "date") {
        return Boolean(pickedDate) && eventKey === pickedDate;
    }

    const start = new Date(today);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 6);

    return eventDate >= start && eventDate <= today;
}

export default function RequestListFilters({
    tabs,
    activeTab,
    onTabChange,
    dateFilter,
    onDateFilterChange,
    pickedDate,
    onPickedDateChange,
    searchQuery,
    onSearchQueryChange,
    searchPlaceholder = "Search requests",
}: {
    tabs: Tab[];
    activeTab: string;
    onTabChange: (tab: string) => void;
    dateFilter: DateFilterValue;
    onDateFilterChange: (filter: DateFilterValue) => void;
    pickedDate: string;
    onPickedDateChange: (date: string) => void;
    searchQuery: string;
    onSearchQueryChange: (query: string) => void;
    searchPlaceholder?: string;
}) {
    const dateOptions: { value: DateFilterValue; label: string }[] = [
        { value: "any", label: "Any Date" },
        { value: "today", label: "Today" },
        { value: "yesterday", label: "Yesterday" },
        { value: "last7", label: "Last 7 Days" },
        { value: "date", label: "Pick Date" },
    ];

    return (
        <div className="surface-card mt-8 p-4 sm:p-5">
            <ListSearch
                value={searchQuery}
                onChange={onSearchQueryChange}
                placeholder={searchPlaceholder}
            />

            <div
                className="mt-4 flex flex-wrap gap-2 border-t border-[var(--border)] pt-4"
                aria-label="Request status"
            >
                {tabs.map((tab) => (
                    <button
                        key={tab.value}
                        type="button"
                        onClick={() => onTabChange(tab.value)}
                        aria-pressed={activeTab === tab.value}
                        className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                            activeTab === tab.value
                                ? "bg-[var(--foreground)] text-[var(--background)]"
                                : "bg-[var(--surface-subtle)] text-[var(--muted-strong)] hover:bg-[var(--surface-hover)]"
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div
                className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-4"
                aria-label="Request date"
            >
                {dateOptions.map((option) => (
                    <button
                        key={option.value}
                        type="button"
                        onClick={() => onDateFilterChange(option.value)}
                        aria-pressed={dateFilter === option.value}
                        className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                            dateFilter === option.value
                                ? "border-[var(--foreground)] bg-[var(--surface-subtle)] text-[var(--foreground)]"
                                : "border-[var(--border)] text-[var(--muted-strong)] hover:bg-[var(--surface-hover)]"
                        }`}
                    >
                        {option.label}
                    </button>
                ))}

                {dateFilter === "date" && (
                    <input
                        type="date"
                        value={pickedDate}
                        onChange={(event) =>
                            onPickedDateChange(event.target.value)
                        }
                        aria-label="Choose request date"
                        className="form-control w-auto"
                        autoFocus
                    />
                )}
            </div>
        </div>
    );
}
