import { supabase } from './supabase';

export async function getSmartRate(customerId: string, productId: string, defaultRate: number): Promise<number> {
  const [rateCardRes, lastRateRes] = await Promise.all([
    supabase
      .from('customer_rate_cards')
      .select('rate')
      .eq('customer_id', customerId)
      .eq('product_id', productId)
      .eq('is_active', true)
      .maybeSingle(),
    supabase
      .from('customer_product_last_rates')
      .select('last_rate')
      .eq('customer_id', customerId)
      .eq('product_id', productId)
      .maybeSingle(),
  ]);

  if (rateCardRes.data?.rate != null) return rateCardRes.data.rate;
  if (lastRateRes.data?.last_rate != null) return lastRateRes.data.last_rate;
  return defaultRate;
}

export async function updateLastRate(
  customerId: string,
  productId: string,
  rate: number,
  referenceType: string,
  referenceId: string
): Promise<void> {
  await supabase.from('customer_product_last_rates').upsert({
    customer_id: customerId,
    product_id: productId,
    last_rate: rate,
    last_used_at: new Date().toISOString(),
    reference_type: referenceType,
    reference_id: referenceId,
  }, { onConflict: 'customer_id,product_id' });
}

export async function getRateCardForCustomer(customerId: string) {
  const { data } = await supabase
    .from('customer_rate_cards')
    .select('*, products(name, sku, selling_price)')
    .eq('customer_id', customerId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  return data || [];
}

export async function upsertRateCard(customerId: string, productId: string, rate: number, notes?: string) {
  const { error } = await supabase.from('customer_rate_cards').upsert({
    customer_id: customerId,
    product_id: productId,
    rate,
    notes: notes || '',
    is_active: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'customer_id,product_id' });
  return error;
}

export async function deleteRateCard(id: string) {
  const { error } = await supabase.from('customer_rate_cards').delete().eq('id', id);
  return error;
}
