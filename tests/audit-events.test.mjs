import test from "node:test";
import assert from "node:assert/strict";
import {
    deduplicateAuditEvents,
    matchesAuditRequest,
} from "../src/lib/audit-events.ts";

function event(overrides = {}) {
    return {
        id: 1,
        created_at: "2026-08-16T10:00:00.000Z",
        actor_id: "user-1",
        actor_name: "Test Owner",
        action_type: "purchase_request_created",
        entity_type: "purchase_request",
        entity_id: 17,
        purchase_request_id: 17,
        stock_out_request_id: null,
        stock_check_id: null,
        item_id: null,
        details: null,
        ...overrides,
    };
}

test("duplicate audit records collapse to the more informative record", () => {
    const result = deduplicateAuditEvents([
        event(),
        event({ id: 2, details: "Two items requested." }),
    ]);

    assert.equal(result.length, 1);
    assert.equal(result[0].id, 2);
    assert.equal(result[0].details, "Two items requested.");
});

test("different actions at the same time are preserved", () => {
    const result = deduplicateAuditEvents([
        event({ action_type: "receipt_confirmed" }),
        event({ id: 2, action_type: "stock_added" }),
    ]);

    assert.equal(result.length, 2);
});

test("request filtering distinguishes purchase and stock request IDs", () => {
    const purchaseEvent = event();
    const stockEvent = event({
        entity_type: "stock_out_request",
        entity_id: 17,
        purchase_request_id: null,
        stock_out_request_id: 17,
    });

    assert.equal(matchesAuditRequest(purchaseEvent, "17", "purchase"), true);
    assert.equal(matchesAuditRequest(stockEvent, "17", "purchase"), false);
    assert.equal(matchesAuditRequest(stockEvent, "SR-17", "all"), true);
    assert.equal(matchesAuditRequest(purchaseEvent, "PR-17", "all"), true);
    assert.equal(matchesAuditRequest(purchaseEvent, "not-an-id", "all"), false);
});
