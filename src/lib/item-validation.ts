const unitPattern = /^[a-z][a-z0-9 ./'()-]{0,39}$/i;

export function isValidUnitLabel(value: string) {
    return unitPattern.test(value.trim());
}

export function normalizeItemName(value: string) {
    return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-GB");
}

export function hasDuplicateItemName(existingNames: string[], candidate: string) {
    const normalizedCandidate = normalizeItemName(candidate);

    return (
        Boolean(normalizedCandidate) &&
        existingNames.some(
            (existingName) =>
                normalizeItemName(existingName) === normalizedCandidate
        )
    );
}
