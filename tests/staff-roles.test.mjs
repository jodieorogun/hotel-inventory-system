import test from "node:test";
import assert from "node:assert/strict";
import {
    formatStaffRole,
    isStaffRole,
    staffRoleLabels,
} from "../src/lib/staff-roles.ts";

test("all supported staff roles are accepted", () => {
    for (const role of [
        "owner",
        "procurement",
        "accountant",
        "storekeeper",
        "housekeeper",
    ]) {
        assert.equal(isStaffRole(role), true);
    }

    assert.equal(isStaffRole("postgres"), false);
    assert.equal(isStaffRole("deactivated"), false);
});

test("the housekeeper database role is presented as Housekeeper", () => {
    assert.equal(staffRoleLabels.housekeeper, "Housekeeper");
    assert.equal(formatStaffRole("housekeeper"), "Housekeeper");
});
