# Hotel Inventory System

A Next.js and Supabase application for the hotel purchase-request and stock-in workflow.

## Roles

- `procurement` creates, modifies, resubmits, and escalates purchase requests.
- `accountant` approves or rejects requests.
- `storekeeper` records actual quantities received and confirms stock receipt.
- `owner` can act across the full workflow and resolve escalations or receipt issues.

## Local setup

Create `.env.local` with:

```text
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Then run:

```bash
npm install
npm run dev
```

The application is available at [http://localhost:3000](http://localhost:3000).

## Supabase contract

The frontend expects these main tables:

- `users`
- `items`
- `purchase_requests`
- `purchase_requests_items`
- `purchase_request_events`

Each `items` row uses `unit` as the stock unit, `purchase_unit` as the unit
Procurement orders, and `units_per_purchase_unit` as the receipt conversion.
Each `purchase_requests_items` row snapshots its selected `purchase_unit` and
`units_per_purchase_unit`, so Procurement can buy either the usual packaging or
individual stock units without later item changes altering old requests.
Requested and received quantities remain in the selected purchase unit;
the Storekeeper records full purchase units plus loose stock units, and
confirmed inventory is increased using the calculated actual stock-unit total.

It also calls these database functions:

- `create_purchase_request`
- `resubmit_purchase_request`
- `submit_purchase_receipt`
- `return_receipt_to_storekeeper`
- `accept_actual_purchase_receipt`
- `void_purchase_receipt`
- `owner_resubmit_rejected_request`
- `owner_approve_rejected_request`
- `owner_void_rejected_request`

The Supabase schema, RLS policies, triggers, and functions must be applied through the Supabase SQL Editor before the matching frontend is deployed. SQL is intentionally not stored in this repository.

## Verification

```bash
npm run lint
npm run build
```

The workflow should also be tested in Supabase using one account for each role. In particular, verify request creation, rejection and resubmission, Owner overrides, receipt mismatches, issue resolution, and inventory changes.
