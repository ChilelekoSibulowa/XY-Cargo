## Scope

Apply six related fixes without disturbing workflow logic, schema, or design.

### 1. Parcel Created notification message
- Update `src/lib/notifications.ts` (or wherever the "on the way to the warehouse" message is composed at parcel creation) so the **Created** stage sends:
  > Dear [Customer Name], your parcel with tracking number [Customer Parcel Tracking Number] has been successfully created.
- Move the existing "on the way to the origin warehouse" copy to the **Created → Incoming** transition trigger only.

### 2. Created & Incoming visibility (Customer / Agent / Warehouse)
- Audit the queries that power the **Created** and **Incoming** tabs on:
  - Customer parcels list
  - Agent parcels list
  - Warehouse All Parcels / status tabs
- Fix the filter mismatch (status set, ownership join on `customer_id`, handling-method gating) so newly created parcels appear immediately in Created, then in Incoming after transition.
- Do not change the workflow movement itself — only the visibility filter.

### 3. Strict one-account-per-email + duplicate cleanup
- Add a unique constraint / partial unique index on `customers.email` (case-insensitive) via migration.
- Update `CustomerCreate`, `Register`, and `admin-create-user` flows to surface:
  > "This email already exists in the system."
- Run a one-off SQL cleanup: identify duplicate customer rows by email, pick the canonical (oldest with most activity) account, repoint all FKs (parcels, shipments, invoices, payments, notifications, delivery requests, wallet, etc.) to the canonical `customer_id`, then delete duplicates.
- Ensure deletion of a customer also frees the email for reuse only after auth user is removed.

### 4. Custom Payment page typography
- In `AgentCustomPayment.tsx` and the customer-side custom payment page, replace oversized text classes with the standard portal typography (same `text-sm` / `text-base` / `font-medium` patterns used across other pages). No layout changes.

### 5. Remove Google reCAPTCHA
- Strip reCAPTCHA script load, token fetch, and `verify-recaptcha` invocation from `Login.tsx` (and Register if present).
- Leave the edge function file in place (harmless) but unused; do not block any flow on it.

### 6. Dashboard "Recent Updates" tracking number rule
- In Customer & Agent dashboard "Recent Activities/Updates" components, when the underlying record's status is **Submitted** or later, display the warehouse-assigned `shipment_tracking_number` (TRK-…) instead of the customer-entered parcel tracking number.
- For Created / Incoming / Need Action, keep showing the customer parcel tracking number.

### 7. Full-stage visibility & cache audit
- Verify each stage tab (All Parcels, All Shipments, Created, Incoming, Need Action, Submitted, Confirm Shipment, Outgoing, In Transit, Ready for Collection, Collected, Unpaid, Paid) on Customer / Agent / Warehouse / Driver pulls the correct status set.
- Add `refetch` / cache invalidation after any status mutation so lists update live.
- Fix any sessionStorage cache (per memory) that retains stale stage data.

## Technical notes
- Migration: `ALTER TABLE customers ADD CONSTRAINT customers_email_unique UNIQUE (lower(email));` plus a backfill repoint script run via `supabase--insert`.
- Notifications: route through existing `send-notification` edge function, just adjust template strings and trigger points.
- Dashboard: use existing `tracking_number` field on shipments table once status >= submitted.
- No design tokens or layout changes anywhere.
