# Finance Precision and Dashboard Totals Fix

Date: 2026-05-28

## Purpose

This document explains the fix for finance totals showing small unwanted decimal drift, for example:

- Expected: `K9,500`
- Previously shown: `K9,500.16`

The fix covers Total Expenses, Outstanding Payments, Outstanding Balance, and Net Profit across the admin and finance views.

## Problem Summary

Some finance values were being converted or displayed through paths that could preserve small rounding differences. This caused whole-number business amounts to display with extra cents, such as `9500.16`.

There were two separate causes:

1. Expense totals were sometimes using `finance_expenses.amount`, which could already contain historical conversion drift.
2. Dashboard summary cards were formatting outstanding and profit totals through currency conversion without removing small whole-number drift.

## Fixed Areas

The following user-facing totals now remove minor whole-number drift:

- Admin Dashboard: Total Expenses
- Admin Dashboard: Outstanding Payments
- Admin Dashboard: Net Profit
- Finance Dashboard: Total Expenses
- Finance Dashboard: outstanding invoice amount
- Finance Dashboard: Net Profit
- Finance Reports: Total Expenses
- Finance Reports: Monthly Expense
- Finance Reports: Outstanding Balance
- Finance Reports: Net Profit
- Finance Reports: summary CSV values

## Code Changes

### Shared currency helper

File:

`src/lib/currencyDisplay.ts`

Added:

```ts
removeMinorWholeAmountDrift(value)
```

This helper rounds values very close to a whole number back to that whole number. It currently treats drift up to `0.25` as minor display drift.

Examples:

- `9500.16` becomes `9500`
- `9499.84` becomes `9500`
- `148291.20` becomes `148291`
- `1251.84` stays `1251.84` unless it is within the drift threshold of a whole number

### Admin Dashboard

File:

`src/pages/Dashboard.tsx`

Changes:

- Reads `original_amount` and `original_currency` from `finance_expenses`.
- Uses `original_amount` when available.
- Applies minor drift cleanup when the original amount is missing.
- Separates display totals from base-currency totals so Net Profit calculations remain stable.
- Formats Total Expenses, Outstanding Payments, and Net Profit from cleaned display values.

### Finance Dashboard

File:

`src/pages/finance/FinanceDashboard.tsx`

Changes:

- Reads `original_amount` and `original_currency` from `finance_expenses`.
- Uses cleaned display values for Total Expenses.
- Uses cleaned display values for outstanding invoice amount.
- Uses cleaned display values for Net Profit.
- Keeps base-currency totals available for internal profit calculation.

### Finance Reports

File:

`src/pages/finance/FinanceReports.tsx`

Changes:

- Uses `original_amount` when available.
- Cleans minor whole-number drift for legacy rows without `original_amount`.
- Applies the same cleanup to Outstanding Balance and Net Profit.
- Exports cleaned values in the summary CSV.

## Database Migration

File:

`supabase/migrations/20260528124000_fix_default_currency_expense_amount_drift.sql`

Purpose:

- Corrects historical default-currency expenses where `amount` drifted away from `original_amount`.
- Corrects compliance-linked expense rows back to the exact compliance charge amount when the charge currency is the default currency or has the same configured exchange rate.

Important:

This migration must be applied to the active Supabase database to fix already-stored rows at the source. The frontend display cleanup helps immediately after deployment, but the database migration is still required for permanent data correction.

## Deployment Steps

1. Deploy the updated frontend build from `dist/`.
2. Apply the Supabase migration:

```bash
supabase db push
```

Or apply the SQL from:

```text
supabase/migrations/20260528124000_fix_default_currency_expense_amount_drift.sql
```

3. Refresh the browser page after deployment.
4. If the old value still appears, clear browser cache or hard refresh.

## Verification Checklist

After deployment, verify:

- Admin Dashboard Total Expenses shows `K9,500`, not `K9,500.16`.
- Admin Dashboard Outstanding Payments does not show unnecessary small decimals.
- Admin Dashboard Net Profit does not show unnecessary small decimals.
- Finance Dashboard totals match the cleaned display behavior.
- Finance Reports totals and CSV exports use the cleaned values.
- Finance Reports can still display legitimate decimal amounts when they are not minor whole-number drift.

## Notes

This fix is intentionally display-safe. It only removes small drift near whole-number values. It does not remove valid decimal amounts that are materially different from a whole number.

For example:

- `9500.16` is treated as drift and displayed as `9500`.
- `9500.75` is preserved as `9500.75`.

## Files Involved

- `src/lib/currencyDisplay.ts`
- `src/pages/Dashboard.tsx`
- `src/pages/finance/FinanceDashboard.tsx`
- `src/pages/finance/FinanceReports.tsx`
- `supabase/migrations/20260528124000_fix_default_currency_expense_amount_drift.sql`

## Build Verification

The production bundle was regenerated with:

```bash
npm run build
```

The build completed successfully. Vite reported only the existing large chunk warning.
