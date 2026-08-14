const quantityFormatter = new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 3,
});

export function pluralizeUnit(unit: string, quantity: number) {
    const trimmedUnit = unit.trim();

    if (quantity === 1 || !trimmedUnit || trimmedUnit.endsWith("s")) {
        return trimmedUnit;
    }

    if (/[^aeiou]y$/i.test(trimmedUnit)) {
        return `${trimmedUnit.slice(0, -1)}ies`;
    }

    return `${trimmedUnit}s`;
}

export function formatQuantity(quantity: number, unit: string) {
    return `${quantityFormatter.format(quantity)} ${pluralizeUnit(unit, quantity)}`;
}

export function stockEquivalent(
    purchaseQuantity: number,
    unitsPerPurchaseUnit: number
) {
    return purchaseQuantity * unitsPerPurchaseUnit;
}

export function hasPurchaseConversion(
    unit: string,
    purchaseUnit: string,
    unitsPerPurchaseUnit: number
) {
    return (
        unitsPerPurchaseUnit !== 1 ||
        unit.trim().toLowerCase() !== purchaseUnit.trim().toLowerCase()
    );
}
