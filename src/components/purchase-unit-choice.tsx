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
    if (
        !hasPurchaseConversion(
            unit,
            defaultPurchaseUnit,
            defaultUnitsPerPurchaseUnit
        )
    ) {
        return null;
    }

    const usesDefault =
        purchaseUnit === defaultPurchaseUnit &&
        unitsPerPurchaseUnit === defaultUnitsPerPurchaseUnit;

    return (
        <div>
            <label className="form-label" htmlFor={id}>
                Purchase as
            </label>
            <select
                id={id}
                value={usesDefault ? "default" : "individual"}
                onChange={(event) => {
                    if (event.target.value === "default") {
                        onChange(
                            defaultPurchaseUnit,
                            defaultUnitsPerPurchaseUnit
                        );
                    } else {
                        onChange(unit, 1);
                    }
                }}
                disabled={disabled}
                className="form-control"
            >
                <option value="default">
                    {defaultPurchaseUnit} — {formatQuantity(
                        defaultUnitsPerPurchaseUnit,
                        unit
                    )} each
                </option>
                <option value="individual">
                    Individual {unit} — 1 {unit}
                </option>
            </select>
        </div>
    );
}
