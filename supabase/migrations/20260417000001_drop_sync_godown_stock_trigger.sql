/*
  # Drop the sync_godown_stock trigger

  ## Why
  The trigger `trg_sync_godown_stock` was created for a single-warehouse setup.
  It sets ALL godown_stock rows to the same value whenever products.stock_quantity changes.
  This is fundamentally incompatible with multi-godown tracking — every sale, purchase,
  or manual adjustment would spread the total stock equally across every godown.

  ## Fix
  Drop the trigger. The application code now maintains per-godown stock directly via
  the godown_stock table, and products.stock_quantity is kept as the computed sum.
*/

DROP TRIGGER IF EXISTS trg_sync_godown_stock ON products;
DROP FUNCTION IF EXISTS sync_godown_stock_on_product_update();
