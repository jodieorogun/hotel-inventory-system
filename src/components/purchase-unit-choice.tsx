import { formatQuantity, hasPurchaseConversion } from "@/lib/units";

export default function PurchaseUnitChoice({
    id,
    unit,
    defaultPurchaseUnit,
    defaultUnitsPerPurchaseUnit,
    purchaseUnit,
    unitsPerPurchaseUnit,
    onChange,
    disabled = false,
}: {
    id: string;
    unit: string;
    defaultPurchaseUnit: string;
    defaultUnitsPerPurchaseUnit: number;
    purchaseUnit: string;
    unitsPerPurchaseUnit: number;
    onChange: (purchaseUnit: string, unitsPerPurchaseUnit: number) => void;
    disabled?: boolean;
}) {
    const hasUsualPurchaseType = hasPurchaseConversion(
        unit,
        defaultPurchaseUnit,
        defaultUnitsPerPurchaseUnit
    );
    const usesDefault =
        hasUsualPurchaseType &&
        purchaseUnit === defaultPurchaseUnit &&
        unitsPerPurchaseUnit === defaultUnitsPerPurchaseUnit;
    const usesIndividual =
        purchaseUnit.trim().toLowerCase() === unit.trim().toLowerCase() &&
        unitsPerPurchaseUnit === 1;
    const selection = usesDefault
        ? "default"
        : usesIndividual
          ? "individual"
          : "custom";

    return (
        <div>
            <label className="form-label" htmlFor={id}>
                Buy as
            </label>
            <select
                id={id}
                value={selection}
                onChange={(event) => {
                    if (event.target.value === "default") {
                        onChange(
                            defaultPurchaseUnit,
                            defaultUnitsPerPurchaseUnit
                        );
                    } else if (event.target.value === "individual") {
                        onChange(unit, 1);
                    } else {
                        onChange("", 1);
                    }
                }}
                disabled={disabled}
                className="form-control"
            >
                {hasUsualPurchaseType && (
                    <option value="default">
                        Usual: {defaultPurchaseUnit} — {formatQuantity(
                            defaultUnitsPerPurchaseUnit,
                            unit
                        )}
                    </option>
                )}
                <option value="individual">
                    Individual {unit} — {formatQuantity(1, unit)}
                </option>
                <option value="custom">Another purchase type</option>
            </select>

            {selection === "custom" && (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                        <label className="form-label" htmlFor={`${id}-custom-name`}>
                            Purchase type
                        </label>
                        <input
                            id={`${id}-custom-name`}
                            type="text"
                            value={purchaseUnit}
                            onChange={(event) =>
                                onChange(event.target.value, unitsPerPurchaseUnit)
                            }
                            maxLength={40}
                            disabled={disabled}
                            placeholder="e.g. box, case or bundle"
                            className="form-control"
                        />
                    </div>

                    <div>
                        <label className="form-label" htmlFor={`${id}-custom-size`}>
                            How many {unit} are inside?
                        </label>
                        <input
                            id={`${id}-custom-size`}
                            type="number"
                            min="1"
                            step="1"
                            value={unitsPerPurchaseUnit}
                            onChange={(event) =>
                                onChange(
                                    purchaseUnit,
                                    Number(event.target.value)
                                )
                            }
                            disabled={disabled}
                            className="form-control"
                        />
                    </div>

                    {purchaseUnit.trim() && unitsPerPurchaseUnit >= 1 && (
                        <p className="text-muted text-sm sm:col-span-2">
                            1 {purchaseUnit.trim()} adds {formatQuantity(
                                unitsPerPurchaseUnit,
                                unit
                            )} to stock.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
