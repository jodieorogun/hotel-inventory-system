import test from "node:test";
import assert from "node:assert/strict";
import {
    formatQuantity,
    hasPurchaseConversion,
    pluralizeUnit,
    stockEquivalent,
} from "../src/lib/units.ts";
import {
    hasDuplicateItemName,
    isValidUnitLabel,
    normalizeItemName,
} from "../src/lib/item-validation.ts";

test("uncountable stock units are not incorrectly pluralized", () => {
    assert.equal(pluralizeUnit("each", 3), "each");
    assert.equal(pluralizeUnit("kg", 10), "kg");
    assert.equal(formatQuantity(3, "each"), "3 each");
});

test("regular unit endings are pluralized clearly", () => {
    assert.equal(pluralizeUnit("box", 2), "boxes");
    assert.equal(pluralizeUnit("brush", 2), "brushes");
    assert.equal(pluralizeUnit("battery", 2), "batteries");
});

test("legacy invalid unit values have a safe display fallback", () => {
    assert.equal(formatQuantity(0, "1"), "0 units");
    assert.equal(formatQuantity(1, "1"), "1 unit");
});

test("purchase conversions remain exact", () => {
    assert.equal(stockEquivalent(2, 12), 24);
    assert.equal(hasPurchaseConversion("roll", "pack", 12), true);
    assert.equal(hasPurchaseConversion("roll", "roll", 1), false);
});

test("unit labels must begin with a word and contain sensible characters", () => {
    assert.equal(isValidUnitLabel("bottle"), true);
    assert.equal(isValidUnitLabel("toilet roll"), true);
    assert.equal(isValidUnitLabel("1"), false);
    assert.equal(isValidUnitLabel("12 bottles"), false);
    assert.equal(isValidUnitLabel(""), false);
});

test("item names are compared case-insensitively with normalized spaces", () => {
    assert.equal(normalizeItemName("  Toilet   Roll "), "toilet roll");
    assert.equal(
        hasDuplicateItemName(["Toilet Roll", "Soap"], " toilet  roll "),
        true
    );
    assert.equal(hasDuplicateItemName(["Soap"], "Shampoo"), false);
});
