/*
  # Atomic Stock Posting RPC

  ## Purpose
  Replaces the 3-step client-side stock pattern (godown_stock upsert →
  stock_movements insert → products.stock_quantity recompute) with a
  single Postgres function so all three operations succeed or fail
  together. Eliminates the lost-update race condition by using an
  atomic INSERT ... ON CONFLICT delta update (works correctly even
  for rows that did not exist before).

  ## Function
  `post_stock_movement(
      p_product_id uuid,
      p_godown_id uuid,
      p_qty_change numeric,        -- positive = stock in, negative = stock out
      p_movement_type text,        -- must satisfy stock_movements check constraint:
                                   -- 'purchase' | 'sale' | 'return' | 'adjustment' | 'in' | 'out'
      p_reference_type text,       -- 'purchase_entry' | 'invoice' | 'sales_return' | 'godown_transfer' | etc.
      p_reference_id uuid,
      p_reference_number text,     -- optional document number for audit
      p_notes text                 -- optional free text
  ) RETURNS void`

  ## Behavior
  - Atomic INSERT ... ON CONFLICT updates godown_stock with delta arithmetic
    (`existing.quantity + p_qty_change`, clamped to >= 0). This is a single
    SQL statement so PG handles concurrent callers correctly without an
    explicit row lock — no lost updates even when the row does not yet exist.
  - Inserts a row into stock_movements with the absolute quantity and
    the supplied movement_type/reference info.
  - Recomputes products.stock_quantity as SUM(godown_stock.quantity)
    for that product.
  - Entire body runs in the implicit transaction of the function call,
    so any failure rolls back all three writes.

  ## Safety
  - Function is replaceable (CREATE OR REPLACE), idempotent migration.
  - Marked SECURITY INVOKER (default) so existing RLS policies still apply.
  - GRANTed to authenticated role.
*/

CREATE OR REPLACE FUNCTION post_stock_movement(
  p_product_id uuid,
  p_godown_id uuid,
  p_qty_change numeric,
  p_movement_type text,
  p_reference_type text,
  p_reference_id uuid,
  p_reference_number text DEFAULT NULL,
  p_notes text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_total numeric;
BEGIN
  IF p_product_id IS NULL OR p_godown_id IS NULL THEN
    RAISE EXCEPTION 'product_id and godown_id are required';
  END IF;

  -- Atomic delta upsert. Single statement; concurrent calls are serialized
  -- by Postgres on the (godown_id, product_id) unique index.
  INSERT INTO godown_stock (product_id, godown_id, quantity, updated_at)
  VALUES (p_product_id, p_godown_id, GREATEST(0, p_qty_change), now())
  ON CONFLICT (godown_id, product_id) DO UPDATE
    SET quantity = GREATEST(0, godown_stock.quantity + p_qty_change),
        updated_at = now();

  INSERT INTO stock_movements (
    product_id, godown_id, movement_type, quantity,
    reference_type, reference_id, reference_number, notes
  ) VALUES (
    p_product_id, p_godown_id, p_movement_type, ABS(p_qty_change),
    p_reference_type, p_reference_id, p_reference_number, p_notes
  );

  SELECT COALESCE(SUM(quantity), 0) INTO v_total
  FROM godown_stock
  WHERE product_id = p_product_id;

  UPDATE products
  SET stock_quantity = v_total,
      updated_at = now()
  WHERE id = p_product_id;
END;
$$;

GRANT EXECUTE ON FUNCTION post_stock_movement(uuid, uuid, numeric, text, text, uuid, text, text) TO authenticated;
