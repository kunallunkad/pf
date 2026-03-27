import { supabase } from '../lib/supabase';
import { saveLastRatesBulk } from './rateService';
import type { SalesOrder } from '../types';

export async function fetchSalesOrders(filters?: { status?: string; customerId?: string }): Promise<SalesOrder[]> {
  let query = supabase
    .from('sales_orders')
    .select('*, items:sales_order_items(*), customer:customers(id, name, phone, city)')
    .order('created_at', { ascending: false });
  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.customerId) query = query.eq('customer_id', filters.customerId);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as SalesOrder[];
}

export async function fetchSalesOrderById(id: string): Promise<SalesOrder | null> {
  const { data } = await supabase
    .from('sales_orders')
    .select('*, items:sales_order_items(*), customer:customers(id, name, phone, city)')
    .eq('id', id)
    .maybeSingle();
  return data as SalesOrder | null;
}

export async function createSalesOrder(
  order: Partial<SalesOrder>,
  items: { product_id: string; product_name: string; quantity: number; rate: number; total_price: number; unit?: string }[]
): Promise<SalesOrder> {
  const so_number = await generateSoNumber();
  const { data, error } = await supabase
    .from('sales_orders')
    .insert({ ...order, so_number, status: order.status || 'draft' })
    .select()
    .single();
  if (error) throw error;

  if (items.length) {
    await supabase.from('sales_order_items').insert(
      items.map(item => ({ ...item, sales_order_id: data.id }))
    );
  }

  if (order.customer_id) {
    await saveLastRatesBulk(order.customer_id, items.map(i => ({ product_id: i.product_id, rate: i.rate })), 'sales_order', data.id);
  }

  return data as SalesOrder;
}

export async function updateSalesOrder(
  id: string,
  order: Partial<SalesOrder>,
  items?: { product_id: string; product_name: string; quantity: number; rate: number; total_price: number; unit?: string }[]
): Promise<void> {
  await supabase.from('sales_orders').update({ ...order, updated_at: new Date().toISOString() }).eq('id', id);
  if (items) {
    await supabase.from('sales_order_items').delete().eq('sales_order_id', id);
    if (items.length) {
      await supabase.from('sales_order_items').insert(items.map(item => ({ ...item, sales_order_id: id })));
    }
  }
}

export async function updateSalesOrderStatus(id: string, status: SalesOrder['status']): Promise<void> {
  await supabase.from('sales_orders').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
}

export async function generateSoNumber(): Promise<string> {
  const now = new Date();
  const prefix = `SO-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const { data } = await supabase
    .from('sales_orders')
    .select('so_number')
    .ilike('so_number', `${prefix}%`)
    .order('so_number', { ascending: false })
    .limit(1);
  const last = data?.[0]?.so_number;
  const seq = last ? parseInt(last.split('-').pop() || '0', 10) + 1 : 1;
  return `${prefix}-${String(seq).padStart(3, '0')}`;
}
