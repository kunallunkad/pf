/*
  # Update create_sales_order RPC to support B2B fields

  1. Changes
    - Replace create_sales_order function to also INSERT is_b2b and ship_to_customer_id
      from the JSON payload
    - is_b2b defaults to false when not provided
    - ship_to_customer_id is set to NULL when not provided or when is_b2b is false

  2. Notes
    - No table changes (columns added in prior migration)
    - No stock logic touched
    - No invoice table touched
*/

CREATE OR REPLACE FUNCTION create_sales_order(p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_so_id       uuid;
  v_items       jsonb;
  v_item        jsonb;
  v_subtotal    numeric := 0;
  v_total       numeric;
  v_customer_id uuid;
  v_is_b2b      boolean;
  v_ship_to     uuid;
BEGIN
  v_customer_id := NULLIF(p_payload->>'customer_id', '')::uuid;
  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'customer_id is required';
  END IF;

  v_items := p_payload->'items';
  IF v_items IS NULL OR jsonb_array_length(v_items) = 0 THEN
    RAISE EXCEPTION 'at least one item is required';
  END IF;

  v_is_b2b := COALESCE((p_payload->>'is_b2b')::boolean, false);
  v_ship_to := NULLIF(p_payload->>'ship_to_customer_id', '')::uuid;

  IF v_is_b2b AND v_ship_to IS NULL THEN
    RAISE EXCEPTION 'B2B orders require ship_to_customer_id';
  END IF;
  IF NOT v_is_b2b THEN
    v_ship_to := NULL;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items) LOOP
    IF (v_item->>'product_id') IS NULL OR (v_item->>'quantity')::numeric <= 0 THEN
      RAISE EXCEPTION 'each item needs product_id and positive quantity';
    END IF;
    v_subtotal := v_subtotal
      + (v_item->>'quantity')::numeric
      * (v_item->>'unit_price')::numeric
      * (1 - COALESCE((v_item->>'discount_pct')::numeric, 0) / 100);
  END LOOP;

  v_total := v_subtotal
    + COALESCE((p_payload->>'courier_charges')::numeric, 0)
    + COALESCE((p_payload->>'tax_amount')::numeric, 0)
    - COALESCE((p_payload->>'discount_amount')::numeric, 0);

  INSERT INTO sales_orders (
    so_number, customer_id, customer_name, customer_phone, customer_address,
    customer_address2, customer_city, customer_state, customer_pincode,
    so_date, delivery_date, status, subtotal, tax_amount, courier_charges,
    discount_amount, total_amount, notes, godown_id, company_id,
    is_b2b, ship_to_customer_id
  ) VALUES (
    p_payload->>'so_number',
    v_customer_id,
    p_payload->>'customer_name',
    p_payload->>'customer_phone',
    p_payload->>'customer_address',
    p_payload->>'customer_address2',
    p_payload->>'customer_city',
    p_payload->>'customer_state',
    p_payload->>'customer_pincode',
    NULLIF(p_payload->>'so_date', '')::date,
    NULLIF(p_payload->>'delivery_date', '')::date,
    'confirmed',
    v_subtotal,
    COALESCE((p_payload->>'tax_amount')::numeric, 0),
    COALESCE((p_payload->>'courier_charges')::numeric, 0),
    COALESCE((p_payload->>'discount_amount')::numeric, 0),
    v_total,
    p_payload->>'notes',
    NULLIF(p_payload->>'godown_id', '')::uuid,
    NULLIF(p_payload->>'company_id', '')::uuid,
    v_is_b2b,
    v_ship_to
  ) RETURNING id INTO v_so_id;

  INSERT INTO sales_order_items (
    sales_order_id, product_id, product_name, unit, quantity,
    unit_price, discount_pct, total_price, godown_id
  )
  SELECT v_so_id,
    (item->>'product_id')::uuid,
    item->>'product_name',
    item->>'unit',
    (item->>'quantity')::numeric,
    (item->>'unit_price')::numeric,
    COALESCE((item->>'discount_pct')::numeric, 0),
    (item->>'quantity')::numeric
      * (item->>'unit_price')::numeric
      * (1 - COALESCE((item->>'discount_pct')::numeric, 0) / 100),
    NULLIF(item->>'godown_id', '')::uuid
  FROM jsonb_array_elements(v_items) AS item;

  RETURN v_so_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_sales_order(jsonb) TO authenticated;
