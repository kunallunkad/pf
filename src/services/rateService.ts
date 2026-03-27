import { supabase } from '../lib/supabase';

export async function getProductRateForCustomer(
  customerId: string,
  productId: string,
  defaultRate: number
): Promise<number> {
  const { data: rateCard } = await supabase
    .from('customer_rates')
    .select('rate')
    .eq('customer_id', customerId)
    .eq('product_id', productId)
    .maybeSingle();
  if (rateCard?.rate != null) return rateCard.rate;

  const { data: lastRate } = await supabase
    .from('customer_last_rates')
    .select('rate')
    .eq('customer_id', customerId)
    .eq('product_id', productId)
    .maybeSingle();
  if (lastRate?.rate != null) return lastRate.rate;

  return defaultRate;
}

export async function saveLastRate(
  customerId: string,
  productId: string,
  rate: number,
  referenceType: string,
  referenceId: string
): Promise<void> {
  await supabase.from('customer_last_rates').upsert({
    customer_id: customerId,
    product_id: productId,
    rate,
    last_used_at: new Date().toISOString(),
    reference_type: referenceType,
    reference_id: referenceId,
  });
}

export async function saveLastRatesBulk(
  customerId: string,
  items: { product_id: string; rate: number }[],
  referenceType: string,
  referenceId: string
): Promise<void> {
  if (!items.length) return;
  const rows = items.map(item => ({
    customer_id: customerId,
    product_id: item.product_id,
    rate: item.rate,
    last_used_at: new Date().toISOString(),
    reference_type: referenceType,
    reference_id: referenceId,
  }));
  await supabase.from('customer_last_rates').upsert(rows);
}

export async function setCustomerRate(
  customerId: string,
  productId: string,
  rate: number
): Promise<void> {
  await supabase.from('customer_rates').upsert({
    customer_id: customerId,
    product_id: productId,
    rate,
    updated_at: new Date().toISOString(),
  });
}

export async function getCustomerRates(customerId: string): Promise<Record<string, number>> {
  const { data } = await supabase
    .from('customer_rates')
    .select('product_id, rate')
    .eq('customer_id', customerId);
  const map: Record<string, number> = {};
  (data || []).forEach(r => { map[r.product_id] = r.rate; });
  return map;
}
