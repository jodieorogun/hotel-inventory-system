export default function ListSearch({
    value,
    onChange,
    placeholder,
    className = "",
}: {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    className?: string;
}) {
    return (
        <div className={`relative ${className}`} role="search">
            <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="text-muted pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2"
            >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-4-4" />
            </svg>
            <input
                type="search"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="form-control pr-10 pl-12"
                placeholder={placeholder}
                aria-label={placeholder}
            />
            {value && (
                <button
                    type="button"
                    onClick={() => onChange("")}
                    className="text-muted absolute top-1/2 right-3 -translate-y-1/2 rounded-md px-2 py-1 text-sm hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                    aria-label="Clear search"
                >
                    Clear
                </button>
            )}
        </div>
    );
}
