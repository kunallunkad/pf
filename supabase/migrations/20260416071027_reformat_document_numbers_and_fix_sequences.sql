/*
  # Reformat All Document Numbers + Fix Sequences Table

  ## Summary
  1. Upgrades document_sequences table schema to add year_month column
     (the migration file existed but the DDL never applied to this DB)
  2. Reformats all existing document numbers to PREFIX/YYMM/NNN format
  3. Rebuilds document_sequences rows from actual data

  ## Format Change
  - Old: INV-001, INV-2604-9835, SO-001, DC-001
  - New: INV/2604/001, SO/2603/001, DC/2604/003 etc.

  ## Tables Updated
  - document_sequences: schema upgraded + rows rebuilt
  - invoices: invoice_number reformatted
  - sales_orders: so_number reformatted
  - delivery_challans: challan_number reformatted

  ## Safety
  - No records deleted
  - No foreign keys changed
  - Sequence numbers are per (prefix, YYMM) group, ordered by created_at
*/

-- Step 1: Upgrade document_sequences schema
ALTER TABLE document_sequences ADD COLUMN IF NOT EXISTS year_month text NOT NULL DEFAULT '';
ALTER TABLE document_sequences DROP CONSTRAINT IF EXISTS document_sequences_pkey;

-- Step 2: Clear old rows (they used a different schema/format)
DELETE FROM document_sequences;

-- Step 3: Remove old default and set proper PK
ALTER TABLE document_sequences ALTER COLUMN year_month DROP DEFAULT;
ALTER TABLE document_sequences ADD PRIMARY KEY (prefix, year_month);

-- Step 4: Reformat invoices
UPDATE invoices i
SET invoice_number = sub.new_num
FROM (
  SELECT
    id,
    'INV/' ||
      to_char(created_at AT TIME ZONE 'Asia/Kolkata', 'YYMM') || '/' ||
      lpad(
        row_number() OVER (
          PARTITION BY to_char(created_at AT TIME ZONE 'Asia/Kolkata', 'YYMM')
          ORDER BY created_at ASC, id ASC
        )::text, 3, '0'
      ) AS new_num
  FROM invoices
) sub
WHERE i.id = sub.id;

-- Step 5: Reformat sales_orders
UPDATE sales_orders s
SET so_number = sub.new_num
FROM (
  SELECT
    id,
    'SO/' ||
      to_char(created_at AT TIME ZONE 'Asia/Kolkata', 'YYMM') || '/' ||
      lpad(
        row_number() OVER (
          PARTITION BY to_char(created_at AT TIME ZONE 'Asia/Kolkata', 'YYMM')
          ORDER BY created_at ASC, id ASC
        )::text, 3, '0'
      ) AS new_num
  FROM sales_orders
) sub
WHERE s.id = sub.id;

-- Step 6: Reformat delivery_challans
UPDATE delivery_challans d
SET challan_number = sub.new_num
FROM (
  SELECT
    id,
    'DC/' ||
      to_char(created_at AT TIME ZONE 'Asia/Kolkata', 'YYMM') || '/' ||
      lpad(
        row_number() OVER (
          PARTITION BY to_char(created_at AT TIME ZONE 'Asia/Kolkata', 'YYMM')
          ORDER BY created_at ASC, id ASC
        )::text, 3, '0'
      ) AS new_num
  FROM delivery_challans
) sub
WHERE d.id = sub.id;

-- Step 7: Rebuild document_sequences from actual data
INSERT INTO document_sequences (prefix, year_month, last_seq)
SELECT 'INV', to_char(created_at AT TIME ZONE 'Asia/Kolkata', 'YYMM'), count(*)::int
FROM invoices
GROUP BY to_char(created_at AT TIME ZONE 'Asia/Kolkata', 'YYMM')
ON CONFLICT (prefix, year_month) DO UPDATE SET last_seq = EXCLUDED.last_seq;

INSERT INTO document_sequences (prefix, year_month, last_seq)
SELECT 'SO', to_char(created_at AT TIME ZONE 'Asia/Kolkata', 'YYMM'), count(*)::int
FROM sales_orders
GROUP BY to_char(created_at AT TIME ZONE 'Asia/Kolkata', 'YYMM')
ON CONFLICT (prefix, year_month) DO UPDATE SET last_seq = EXCLUDED.last_seq;

INSERT INTO document_sequences (prefix, year_month, last_seq)
SELECT 'DC', to_char(created_at AT TIME ZONE 'Asia/Kolkata', 'YYMM'), count(*)::int
FROM delivery_challans
GROUP BY to_char(created_at AT TIME ZONE 'Asia/Kolkata', 'YYMM')
ON CONFLICT (prefix, year_month) DO UPDATE SET last_seq = EXCLUDED.last_seq;

-- Step 8: Update the next_document_number function to use new schema
CREATE OR REPLACE FUNCTION next_document_number(p_prefix text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  v_ym text := to_char(now() AT TIME ZONE 'Asia/Kolkata', 'YYMM');
  v_seq int;
BEGIN
  INSERT INTO document_sequences (prefix, year_month, last_seq)
    VALUES (p_prefix, v_ym, 1)
  ON CONFLICT (prefix, year_month)
    DO UPDATE SET last_seq = document_sequences.last_seq + 1
  RETURNING last_seq INTO v_seq;

  RETURN p_prefix || '/' || v_ym || '/' || lpad(v_seq::text, 3, '0');
END;
$$;
