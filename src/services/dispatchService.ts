import { supabase } from '../lib/supabase';
import type { Dispatch } from '../types';

export async function fetchDispatches(): Promise<Dispatch[]> {
  const { data, error } = await supabase
    .from('dispatches')
    .select('*, sales_order:sales_orders(so_number), invoice:invoices(invoice_number)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as Dispatch[];
}

export async function createDispatch(payload: Omit<Dispatch, 'id' | 'created_at' | 'dispatch_number'>): Promise<Dispatch> {
  const dispatch_number = await generateDispatchNumber();
  const { data, error } = await supabase
    .from('dispatches')
    .insert({ ...payload, dispatch_number })
    .select()
    .single();
  if (error) throw error;

  if (payload.sales_order_id) {
    await supabase
      .from('sales_orders')
      .update({ status: 'dispatched', updated_at: new Date().toISOString() })
      .eq('id', payload.sales_order_id);
  }

  return data as Dispatch;
}

export async function updateDispatchStatus(id: string, status: Dispatch['status']): Promise<void> {
  const { error } = await supabase
    .from('dispatches')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function generateDispatchNumber(): Promise<string> {
  const now = new Date();
  const prefix = `DSP-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const { data } = await supabase
    .from('dispatches')
    .select('dispatch_number')
    .ilike('dispatch_number', `${prefix}%`)
    .order('dispatch_number', { ascending: false })
    .limit(1);
  const last = data?.[0]?.dispatch_number;
  const seq = last ? parseInt(last.split('-').pop() || '0', 10) + 1 : 1;
  return `${prefix}-${String(seq).padStart(3, '0')}`;
}

export async function getDispatchesForOrder(salesOrderId: string): Promise<Dispatch[]> {
  const { data, error } = await supabase
    .from('dispatches')
    .select('*')
    .eq('sales_order_id', salesOrderId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as Dispatch[];
}
