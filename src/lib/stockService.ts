import { supabase } from './supabase';

export async function getDefaultGodownId(): Promise<string | null> {
  const { data } = await supabase
    .from('godowns')
    .select('id')
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

export async function getGodowns() {
  const { data } = await supabase
    .from('godowns')
    .select('*')
    .eq('is_active', true)
    .order('name');
  return data || [];
}

export async function getGodownStock(godownId: string) {
  const { data } = await supabase
    .from('godown_stock')
    .select('*, products(id, name, sku, unit, selling_price, low_stock_alert)')
    .eq('godown_id', godownId);
  return data || [];
}

export async function getAllGodownStockSummary() {
  const { data } = await supabase
    .from('godown_stock')
    .select('*, godowns(name), products(id, name, sku, unit, low_stock_alert, selling_price)');
  return data || [];
}

export async function adjustGodownStock(
  godownId: string,
  productId: string,
  quantityDelta: number
): Promise<void> {
  const { data: existing } = await supabase
    .from('godown_stock')
    .select('id, quantity')
    .eq('godown_id', godownId)
    .eq('product_id', productId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('godown_stock')
      .update({ quantity: Math.max(0, existing.quantity + quantityDelta), updated_at: new Date().toISOString() })
      .eq('id', existing.id);
  } else {
    await supabase
      .from('godown_stock')
      .insert({ godown_id: godownId, product_id: productId, quantity: Math.max(0, quantityDelta) });
  }
}

export async function deductStockOnDispatch(
  items: { product_id: string; quantity: number; godown_id?: string }[],
  defaultGodownId: string,
  referenceType: string,
  referenceId: string
): Promise<void> {
  for (const item of items) {
    const godownId = item.godown_id || defaultGodownId;
    await adjustGodownStock(godownId, item.product_id, -item.quantity);
    await supabase.from('stock_movements').insert({
      product_id: item.product_id,
      movement_type: 'sale',
      quantity: item.quantity,
      reference_type: referenceType,
      reference_id: referenceId,
      godown_id: godownId,
      notes: `Auto-deducted on ${referenceType}`,
    });
    await supabase.rpc !== undefined && await supabase
      .from('products')
      .select('stock_quantity')
      .eq('id', item.product_id)
      .maybeSingle()
      .then(async ({ data }) => {
        if (data) {
          await supabase.from('products').update({
            stock_quantity: Math.max(0, (data.stock_quantity || 0) - item.quantity),
          }).eq('id', item.product_id);
        }
      });
  }
}

export async function addStockOnPurchase(
  items: { product_id: string; quantity: number; unit_price: number }[],
  godownId: string,
  referenceType: string,
  referenceId: string
): Promise<void> {
  for (const item of items) {
    await adjustGodownStock(godownId, item.product_id, item.quantity);
    await supabase.from('stock_movements').insert({
      product_id: item.product_id,
      movement_type: 'purchase',
      quantity: item.quantity,
      reference_type: referenceType,
      reference_id: referenceId,
      godown_id: godownId,
      notes: `Auto-added on ${referenceType}`,
    });
  }
}
