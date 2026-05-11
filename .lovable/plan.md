## Goal
Enforce the approved workflow stage vocabulary and movement rules across every portal, every UI label, every notification, every guard, and every API path. Remove all legacy/confusing wording (pickup, drop-off, received pickup, etc.) from user-visible text and from workflow decision logic.

## Approved Stage Vocabulary (the only allowed terms)

| DB status        | UI label              | Noun     |
|------------------|-----------------------|----------|
| saved_pickup     | Created               | Parcel   |
| saved_dropoff    | Incoming              | Parcel   |
| received         | Need Action           | Parcel   |
| requested_pickup | Submitted             | Shipment |
| approved         | Confirm Shipment      | Shipment |
| assigned         | Outgoing Parcel       | Shipment |
| supplied         | In Transit            | Shipment |
| delivered        | Ready for Collection  | Shipment |
| closed           | Collected             | Shipment |
| (payment_status) | Unpaid / Paid         | Shipment |

DB column values stay (schema unchanged) — only UI labels, dropdown options, status maps, badges, filter tabs, and notification text get rewritten.

## Work Plan (in order)

### 1. Central status label module (single source of truth)
Create `src/lib/workflowLabels.ts` exporting:
- `WORKFLOW_LABELS` map (db → UI label above)
- `STAGE_NOUN` map (db → "Parcel" | "Shipment")
- `getStageLabel(status)`, `getStageNoun(status)` helpers
- `WORKFLOW_ORDER` array for sort/filter
- `PARCEL_STATUSES` / `SHIPMENT_STATUSES` sets

Update existing `src/lib/parcelWorkflow.ts` `getStageNoun` to delegate here.

### 2. Replace status labels everywhere
Sweep every file referencing the old labels and rewrite to the approved set:
- `Pickup`, `Drop-off`, `Dropoff`, `Saved Pickup`, `Saved Dropoff`, `Received`, `Received Pickup`, `Requested Pickup`, `Approved`, `Assigned`, `Supplied`, `Delivered`, `Arrived`, `Closed`, `Outgoing Parcels` (plural)
- Replace with: Created / Incoming / Need Action / Submitted / Confirm Shipment / Outgoing Parcel / In Transit / Ready for Collection / Collected
- Files: `StatusBadge.tsx`, all `Warehouse*.tsx`, all `Customer*.tsx`, all `Agent*.tsx`, all `Driver*.tsx`, all `Finance*.tsx`, `WarehouseStatusUpdate.tsx` dropdown, tab headers, table column headers, filter pills, modal titles, toast messages.

### 3. Single vs Consolidation movement rules (logic)
- `WarehouseStatusUpdate.tsx`: when moving `saved_dropoff → received`, the existing `getWarehouseArrivalTransition` must auto-progress single parcels to `requested_pickup` (Submitted) and stop consolidated parcels at `received` (Need Action). Verify and harden.
- Block warehouse from manually pushing a consolidated parcel into `requested_pickup` unless it is already linked in `consolidation_shipments`. Add explicit guard using `canEnterSubmitted` + lookup against `consolidation_shipments`.
- Customer/Agent "Consolidate" action: only after consolidation insert succeeds may the unified shipment status become `requested_pickup`. Individual member shipments must be hidden from any "Submitted" tab — list views must filter out shipments whose id appears in `consolidation_shipments` so only the unified record shows.
- Removing one item from a consolidated submitted shipment: delete that `consolidation_shipments` row, set the removed shipment's status back to `received` (Need Action). The consolidation parent stays in `submitted`. Apply on Customer + Agent + Warehouse views.

### 4. Submitted-tab visibility rules
Every "Submitted" / "All Shipments" listing across Customer, Agent, Warehouse, Driver, Finance must:
- Show single shipments where `status >= requested_pickup`.
- Show consolidations where `status in (submitted, confirmed, outgoing, in_transit, arrived, collected)`.
- Hide individual shipments whose id exists in `consolidation_shipments` (they are now part of a unified record).

"All Parcels" must always show every shipment row by its customer-entered tracking number (`custom_tracking_number`), regardless of status. Warehouse-assigned tracking only appears from Submitted onward in shipment views.

### 5. Notifications — exact approved messages only
Rewrite `src/lib/notifications.ts` `notifyStatusChange` so each transition fires the exact wording from the spec, branched by single vs consolidated, using:
- Customer name from `customers.full_name`
- Customer parcel tracking from `custom_tracking_number` (Created → Need Action stages)
- Warehouse shipment tracking from `code` / resolved warehouse tracking (Submitted onward)

Wire all transition sites to call `notifyStatusChange` exactly once per move:
- Warehouse status update (already wired)
- Customer/Agent confirm shipment action (`approved → assigned`)
- Customer/Agent consolidate action (`received → requested_pickup` for the unified shipment) — replace the current `notifyConsolidation` call with `notifyStatusChange(..., 'requested_pickup', { handlingMethod: 'consolidated' })`
- Finance invoice issue (`closed → unpaid`) via `notifyInvoiceIssued`
- Finance payment received (`unpaid → paid`) via `notifyPaymentReceived` (already corrected to "received successfully")

Each call must dispatch SMS + Email + Bell; status history row must be inserted with the same approved text. Remove every other ad-hoc status-change message currently scattered in the codebase.

### 6. Bulk transit messages
On the In Transit page, the bulk-update composer must, for every selected shipment, call `notifyBulkTransitUpdate` which sends SMS + Email + Bell + writes a status-history entry. Surface failures with toast (no silent fail).

### 7. Ready for Collection / Clearance messages
The clearance composer at the Ready for Collection stage must dispatch SMS + Email + Bell + status-history. Same no-silent-fail rule.

### 8. Contact data sourcing
`supabase/functions/send-notification/index.ts` already pulls phone/email from `customers` table by `customer_id` or `user_id` — verify it never falls back to parcel-form contact details. Tighten if needed.

### 9. Verification pass
After edits, grep the repo for forbidden tokens (`Pickup`, `Drop-off`, `Received Pickup`, `Outgoing Parcels`, `Arrived`, `Approved` as a status label, etc.) and fix any survivors. Build must pass. Spot-check Customer Tracking History, Warehouse Status Update dropdown, Submitted tab filters, and one notification end-to-end.

## Out of scope (explicitly preserved)
- DB schema, table/column names, RLS.
- All forms, fields, buttons, layouts, colors, the tracking-number update form, the bulk transit message section, Ready for Collection/Correction, Collected, Unpaid, Paid sections — only the stage vocabulary inside them changes.

## Technical notes
- DB enum values stay; only the display layer is rewritten via `getStageLabel`.
- Existing helpers `parcelWorkflow.ts`, `shipmentNotes.ts`, `consolidationShipments.ts` are extended, not replaced.
- No migrations required.