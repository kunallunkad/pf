/*
  # Stock Integrity: Add godown_id to sales_order_items

  ## Purpose
  The app has always written `godown_id` into `sales_order_items` (the form
  lets users pick a godown per line and auto-selects the godown with most
  stock), but the column was missing from the original schema. This caused
  the SO -> Invoice conversion to lose godown information and fall back to
  bypassing `godown_stock`.

  ## Change
  - Add nullable `godown_id` column to `sales_order_items`,
    referencing `godowns(id)`.

  ## Idempotency / Duplicate Prevention
  A unique index on stock_movements was considered but rejected — legitimate
  flows produce multiple movements for the same (reference, product) when a
  product appears on multiple invoice lines or is split across godowns.
  Idempotency is instead enforced at the application layer (edit flows
  rebalance godown_stock via diffs rather than replaying the ledger).

  ## Safety
  - Additive, idempotent. No data is moved, deleted, or transformed.
*/

ALTER TABLE sales_order_items
  ADD COLUMN IF NOT EXISTS godown_id uuid REFERENCES godowns(id);
