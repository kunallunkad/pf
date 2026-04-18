/*
  # Document flow hardening

  Locks down edge cases that the SO → DC → Invoice flow does not yet cover.
  No new features — only invariants and safety nets.

  ## Contents
  1. Backfill audit view + pre-flight duplicate detection.
  2. Unique partial indexes:
     - one ACTIVE delivery_challan per sales_order
     - one ACTIVE invoice per delivery_challan
  3. Re-create the three creation RPCs with row locks (FOR UPDATE) on the
     parent doc, so concurrent calls cannot both pass the status check.
     Status checks are tightened so that any non-permitted state RAISES
     instead of being silently ignored.
  4. New RPCs:
     - cancel_delivery_challan(p_dc_id)  — reverses stock, flips DC to
       'cancelled', flips parent SO back to 'confirmed' (only if it was
       'dispatched' because of this DC).
     - cancel_invoice(p_invoice_id)      — writes reversing credit ledger
       entry, flips invoice to 'cancelled', flips parent DC back to
       'created' so it can be re-invoiced. Does NOT touch stock.

  ## Invariants enforced after this migration
  - Stock reduces exactly once per line — only inside create_delivery_challan,
    and only ever reversed by cancel_delivery_challan.
  - At most one active DC may reference any given SO.
  - At most one active invoice may reference any given DC.
  - SO/DC/Invoice creation paths cannot be re-entered concurrently for the
    same parent (row lock + unique index together).
  - Cancellation paths cannot fire twice for the same record.
*/

-- ---------------------------------------------------------------------------
-- 1. BACKFILL AUDIT
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW document_flow_backfill_audit AS
  SELECT 'sales_order'::text       AS record_type,
         id, so_number AS doc_number, customer_name, notes,
         created_at
    FROM sales_orders
   WHERE notes LIKE 'Legacy backfill from%'
   UNION ALL
  SELECT 'delivery_challan'::text  AS record_type,
         id, challan_number AS doc_number, customer_name, notes,
         created_at
    FROM delivery_challans
   WHERE notes LIKE 'Legacy backfill from%';

GRANT SELECT ON document_flow_backfill_audit TO authenticated;

COMMENT ON VIEW document_flow_backfill_audit IS
  'Records synthesized by 20260418120000_document_flow_locking. Inspect to confirm '
  'the legacy invoices/DCs are linked to plausible parents. Real customer/items '
  'were carried over from the original record; only the parent document is synthetic.';

-- Pre-flight duplicate detection (would be hidden by the unique index below
-- and surface as a hard error instead of a clear message). Abort the migration
-- with explicit context if real duplicates exist.
DO $$
DECLARE
  v_dup RECORD;
  v_msg text;
BEGIN
  FOR v_dup IN
    SELECT sales_order_id, COUNT(*) AS n
      FROM delivery_challans
     WHERE status <> 'cancelled'
     GROUP BY sales_order_id
    HAVING COUNT(*) > 1
  LOOP
    v_msg := COALESCE(v_msg || E'\n', '')
          || format('  SO %s has %s active delivery_challans', v_dup.sales_order_id, v_dup.n);
  END LOOP;
  IF v_msg IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot enforce one-active-DC-per-SO; resolve duplicates first:%', E'\n' || v_msg;
  END IF;

  FOR v_dup IN
    SELECT delivery_challan_id, COUNT(*) AS n
      FROM invoices
     WHERE status <> 'cancelled'
     GROUP BY delivery_challan_id
    HAVING COUNT(*) > 1
  LOOP
    v_msg := COALESCE(v_msg || E'\n', '')
          || format('  DC %s has %s active invoices', v_dup.delivery_challan_id, v_dup.n);
  END LOOP;
  IF v_msg IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot enforce one-active-invoice-per-DC; resolve duplicates first:%', E'\n' || v_msg;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. UNIQUE PARTIAL INDEXES
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS ux_delivery_challan_active_per_so
  ON delivery_challans (sales_order_id)
  WHERE status <> 'cancelled';

CREATE UNIQUE INDEX IF NOT EXISTS ux_invoice_active_per_dc
  ON invoices (delivery_challan_id)
  WHERE status <> 'cancelled';

COMMENT ON INDEX ux_delivery_challan_active_per_so IS
  'At most one non-cancelled delivery_challan may exist per sales_order. '
  'Enforces no-duplicate-DC at the storage layer in addition to the RPC check.';

COMMENT ON INDEX ux_invoice_active_per_dc IS
  'At most one non-cancelled invoice may exist per delivery_challan. '
  'Enforces no-duplicate-Invoice at the storage layer in addition to the RPC check.';

-- ---------------------------------------------------------------------------
-- 3. RE-CREATE create_delivery_challan / create_invoice WITH ROW LOCKS
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION create_delivery_challan(
  p_sales_order_id uuid,
  p_payload        jsonb
) RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_dc_id           uuid;
  v_so              RECORD;
  v_item            RECORD;
  v_challan_number  text;
BEGIN
  IF p_sales_order_id IS NULL THEN
    RAISE EXCEPTION 'sales_order_id is required';
  END IF;

  -- Lock the SO row so a concurrent call cannot also pass the status check.
  SELECT * INTO v_so FROM sales_orders WHERE id = p_sales_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sales order % not found', p_sales_order_id;
  END IF;
  IF v_so.status NOT IN ('draft', 'confirmed') THEN
    RAISE EXCEPTION 'Sales order % cannot be dispatched (status: %)',
      v_so.so_number, v_so.status
      USING ERRCODE = 'check_violation';
  END IF;

  -- Belt-and-braces against the unique index: explicit no-active-DC check
  -- so the user gets a clear error rather than a 23505.
  IF EXISTS (
    SELECT 1 FROM delivery_challans
     WHERE sales_order_id = p_sales_order_id
       AND status <> 'cancelled'
  ) THEN
    RAISE EXCEPTION 'Sales order % already has an active delivery challan',
      v_so.so_number
      USING ERRCODE = 'check_violation';
  END IF;

  v_challan_number := COALESCE(p_payload->>'challan_number', '');

  INSERT INTO delivery_challans (
    challan_number, sales_order_id, customer_id, customer_name, customer_phone,
    customer_address, customer_address2, customer_city, customer_state, customer_pincode,
    challan_date, dispatch_mode, courier_company, tracking_number,
    status, notes, company_id
  ) VALUES (
    v_challan_number,
    p_sales_order_id,
    v_so.customer_id,
    v_so.customer_name,
    v_so.customer_phone,
    v_so.customer_address,
    v_so.customer_address2,
    v_so.customer_city,
    v_so.customer_state,
    v_so.customer_pincode,
    COALESCE(NULLIF(p_payload->>'challan_date', '')::date, CURRENT_DATE),
    p_payload->>'dispatch_mode',
    p_payload->>'courier_company',
    p_payload->>'tracking_number',
    'created',
    p_payload->>'notes',
    v_so.company_id
  ) RETURNING id INTO v_dc_id;

  INSERT INTO delivery_challan_items (
    delivery_challan_id, product_id, product_name, unit, quantity,
    unit_price, discount_pct, total_price, godown_id
  )
  SELECT v_dc_id, product_id, product_name, unit, quantity,
    unit_price, discount_pct, total_price, godown_id
  FROM sales_order_items
  WHERE sales_order_id = p_sales_order_id;

  FOR v_item IN
    SELECT product_id, godown_id, quantity
      FROM sales_order_items
     WHERE sales_order_id = p_sales_order_id
       AND godown_id IS NOT NULL
       AND product_id IS NOT NULL
  LOOP
    PERFORM post_stock_movement(
      v_item.product_id,
      v_item.godown_id,
      -v_item.quantity,
      'sale',
      'delivery_challan',
      v_dc_id,
      v_challan_number,
      'DC ' || v_challan_number
    );
  END LOOP;

  UPDATE sales_orders
     SET status = 'dispatched', updated_at = now()
   WHERE id = p_sales_order_id;

  RETURN v_dc_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_delivery_challan(uuid, jsonb) TO authenticated;


CREATE OR REPLACE FUNCTION create_invoice(
  p_delivery_challan_id uuid,
  p_payload             jsonb
) RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_invoice_id     uuid;
  v_dc             RECORD;
  v_item           RECORD;
  v_tax_map        jsonb;
  v_subtotal       numeric := 0;
  v_tax            numeric := 0;
  v_total          numeric;
  v_line_base      numeric;
  v_line_tax_pct   numeric;
  v_invoice_number text;
  v_courier        numeric;
  v_discount       numeric;
BEGIN
  IF p_delivery_challan_id IS NULL THEN
    RAISE EXCEPTION 'delivery_challan_id is required';
  END IF;

  -- Lock the DC row so concurrent callers serialize.
  SELECT * INTO v_dc FROM delivery_challans WHERE id = p_delivery_challan_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery challan % not found', p_delivery_challan_id;
  END IF;
  IF v_dc.status <> 'created' THEN
    RAISE EXCEPTION 'Delivery challan % cannot be invoiced (status: %)',
      v_dc.challan_number, v_dc.status
      USING ERRCODE = 'check_violation';
  END IF;

  IF EXISTS (
    SELECT 1 FROM invoices
     WHERE delivery_challan_id = p_delivery_challan_id
       AND status <> 'cancelled'
  ) THEN
    RAISE EXCEPTION 'Delivery challan % already has an active invoice',
      v_dc.challan_number
      USING ERRCODE = 'check_violation';
  END IF;

  v_tax_map := COALESCE(p_payload->'item_tax', '{}'::jsonb);
  v_courier := COALESCE((p_payload->>'courier_charges')::numeric, 0);
  v_discount := COALESCE((p_payload->>'discount_amount')::numeric, 0);

  FOR v_item IN
    SELECT * FROM delivery_challan_items
     WHERE delivery_challan_id = p_delivery_challan_id
  LOOP
    v_line_base := v_item.quantity * v_item.unit_price
                   * (1 - COALESCE(v_item.discount_pct, 0) / 100);
    v_line_tax_pct := COALESCE((v_tax_map->>v_item.id::text)::numeric, 0);
    v_subtotal := v_subtotal + v_line_base;
    v_tax      := v_tax + v_line_base * v_line_tax_pct / 100;
  END LOOP;

  v_total := v_subtotal + v_tax + v_courier - v_discount;
  v_invoice_number := COALESCE(p_payload->>'invoice_number', '');

  INSERT INTO invoices (
    invoice_number, sales_order_id, delivery_challan_id,
    customer_id, customer_name, customer_phone, customer_address,
    customer_address2, customer_city, customer_state, customer_pincode,
    invoice_date, due_date, status,
    subtotal, tax_amount, courier_charges, discount_amount, total_amount,
    paid_amount, outstanding_amount,
    payment_terms, notes, bank_name, account_number, ifsc_code, company_id
  ) VALUES (
    v_invoice_number,
    v_dc.sales_order_id,
    p_delivery_challan_id,
    v_dc.customer_id,
    v_dc.customer_name,
    v_dc.customer_phone,
    v_dc.customer_address,
    v_dc.customer_address2,
    v_dc.customer_city,
    v_dc.customer_state,
    v_dc.customer_pincode,
    COALESCE(NULLIF(p_payload->>'invoice_date', '')::date, CURRENT_DATE),
    NULLIF(p_payload->>'due_date', '')::date,
    'issued',
    v_subtotal,
    v_tax,
    v_courier,
    v_discount,
    v_total,
    0,
    v_total,
    p_payload->>'payment_terms',
    p_payload->>'notes',
    p_payload->>'bank_name',
    p_payload->>'account_number',
    p_payload->>'ifsc_code',
    v_dc.company_id
  ) RETURNING id INTO v_invoice_id;

  INSERT INTO invoice_items (
    invoice_id, product_id, product_name, description, unit, quantity,
    unit_price, discount_pct, tax_pct, total_price, godown_id
  )
  SELECT v_invoice_id,
    dci.product_id,
    dci.product_name,
    NULL,
    dci.unit,
    dci.quantity,
    dci.unit_price,
    COALESCE(dci.discount_pct, 0),
    COALESCE((v_tax_map->>dci.id::text)::numeric, 0),
    dci.quantity * dci.unit_price
      * (1 - COALESCE(dci.discount_pct, 0) / 100)
      * (1 + COALESCE((v_tax_map->>dci.id::text)::numeric, 0) / 100),
    dci.godown_id
  FROM delivery_challan_items dci
  WHERE dci.delivery_challan_id = p_delivery_challan_id;

  INSERT INTO ledger_entries (
    customer_id, party_id, party_name, account_type, entry_type,
    amount, description, reference_type, reference_id, entry_date
  ) VALUES (
    v_dc.customer_id,
    v_dc.customer_id,
    COALESCE(v_dc.customer_name, ''),
    'customer',
    'debit',
    v_total,
    'Invoice ' || v_invoice_number,
    'invoice',
    v_invoice_id,
    COALESCE(NULLIF(p_payload->>'invoice_date', '')::date, CURRENT_DATE)
  );

  UPDATE delivery_challans
     SET status = 'invoiced', updated_at = now()
   WHERE id = p_delivery_challan_id;

  RETURN v_invoice_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_invoice(uuid, jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. CANCELLATION RPCs
-- ---------------------------------------------------------------------------

-- 4a. cancel_delivery_challan ----------------------------------------------
-- Reverses stock for every dispatched line, flips the DC to 'cancelled',
-- and rolls the parent SO back to 'confirmed' (only if the SO is currently
-- 'dispatched' — otherwise we leave whatever later workflow set it to).
-- Refuses to cancel if the DC has already been invoiced and the invoice is
-- still active; the caller must cancel the invoice first.
CREATE OR REPLACE FUNCTION cancel_delivery_challan(p_dc_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_dc        RECORD;
  v_item      RECORD;
  v_active_inv int;
BEGIN
  IF p_dc_id IS NULL THEN
    RAISE EXCEPTION 'dc_id is required';
  END IF;

  SELECT * INTO v_dc FROM delivery_challans WHERE id = p_dc_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery challan % not found', p_dc_id;
  END IF;
  IF v_dc.status = 'cancelled' THEN
    RAISE EXCEPTION 'Delivery challan % is already cancelled', v_dc.challan_number
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT COUNT(*) INTO v_active_inv FROM invoices
   WHERE delivery_challan_id = p_dc_id AND status <> 'cancelled';
  IF v_active_inv > 0 THEN
    RAISE EXCEPTION 'Cannot cancel DC %: it has an active invoice. Cancel the invoice first.',
      v_dc.challan_number
      USING ERRCODE = 'check_violation';
  END IF;

  -- Reverse stock for every line that originally posted a movement.
  FOR v_item IN
    SELECT product_id, godown_id, quantity
      FROM delivery_challan_items
     WHERE delivery_challan_id = p_dc_id
       AND godown_id IS NOT NULL
       AND product_id IS NOT NULL
  LOOP
    PERFORM post_stock_movement(
      v_item.product_id,
      v_item.godown_id,
      v_item.quantity,                -- positive → returns to stock
      'sale_return',
      'delivery_challan_cancel',
      p_dc_id,
      v_dc.challan_number,
      'Reverse DC ' || v_dc.challan_number
    );
  END LOOP;

  UPDATE delivery_challans
     SET status = 'cancelled', updated_at = now()
   WHERE id = p_dc_id;

  -- Roll parent SO back so it can be re-dispatched.
  UPDATE sales_orders
     SET status = 'confirmed', updated_at = now()
   WHERE id = v_dc.sales_order_id
     AND status = 'dispatched';
END;
$$;

GRANT EXECUTE ON FUNCTION cancel_delivery_challan(uuid) TO authenticated;


-- 4b. cancel_invoice -------------------------------------------------------
-- Writes a credit ledger entry that reverses the original debit, flips the
-- invoice to 'cancelled', and rolls the parent DC back to 'created' so it
-- can be re-invoiced. Does NOT touch stock.
CREATE OR REPLACE FUNCTION cancel_invoice(p_invoice_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_inv       RECORD;
  v_outstanding numeric;
BEGIN
  IF p_invoice_id IS NULL THEN
    RAISE EXCEPTION 'invoice_id is required';
  END IF;

  SELECT * INTO v_inv FROM invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice % not found', p_invoice_id;
  END IF;
  IF v_inv.status = 'cancelled' THEN
    RAISE EXCEPTION 'Invoice % is already cancelled', v_inv.invoice_number
      USING ERRCODE = 'check_violation';
  END IF;

  v_outstanding := COALESCE(v_inv.outstanding_amount, 0);

  -- Reversing ledger entry for whatever AR remains open. Paid portions stay
  -- on the books (they were collected) — only the outstanding is reversed.
  IF v_outstanding > 0 THEN
    INSERT INTO ledger_entries (
      customer_id, party_id, party_name, account_type, entry_type,
      amount, description, reference_type, reference_id, entry_date
    ) VALUES (
      v_inv.customer_id,
      v_inv.customer_id,
      COALESCE(v_inv.customer_name, ''),
      'customer',
      'credit',
      v_outstanding,
      'Cancellation of Invoice ' || v_inv.invoice_number,
      'invoice',
      p_invoice_id,
      CURRENT_DATE
    );
  END IF;

  UPDATE invoices
     SET status = 'cancelled',
         outstanding_amount = 0,
         updated_at = now()
   WHERE id = p_invoice_id;

  -- Re-open the DC so a corrected invoice can be issued against it.
  UPDATE delivery_challans
     SET status = 'created', updated_at = now()
   WHERE id = v_inv.delivery_challan_id
     AND status = 'invoiced';
END;
$$;

GRANT EXECUTE ON FUNCTION cancel_invoice(uuid) TO authenticated;
