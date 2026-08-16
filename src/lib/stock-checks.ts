const dateFormatter = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
});

const quantityFormatter = new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 3,
});

export function formatStockCheckDate(value: string | Date) {
    return dateFormatter.format(new Date(value));
}

export function formatStockCheckDateTime(value: string | Date) {
    return dateTimeFormatter.format(new Date(value));
}

export function formatStockCheckQuantity(value: number) {
    return quantityFormatter.format(value);
}

export function getNextStockCheckDate(lastCompletedAt: string) {
    const nextDate = new Date(lastCompletedAt);
    nextDate.setDate(nextDate.getDate() + 7);
    return nextDate;
}

export function isStockCheckDue(lastCompletedAt: string | null) {
    return (
        !lastCompletedAt ||
        getNextStockCheckDate(lastCompletedAt).getTime() <= Date.now()
    );
}
