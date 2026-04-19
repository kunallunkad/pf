/*
  # Fix DC status when its only invoice is cancelled

  DCs that have all invoices cancelled should revert to 'created' status.
  Currently LEGACY-DC-5066b7b2 shows as 'invoiced' but its only invoice is cancelled.
*/

UPDATE delivery_challans dc
SET status = 'created'
WHERE dc.status = 'invoiced'
  AND NOT EXISTS (
    SELECT 1 FROM invoices i
    WHERE i.delivery_challan_id = dc.id
      AND i.status != 'cancelled'
  );
