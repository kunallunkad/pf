import { supabase } from '../lib/supabase';
import type { Invoice } from '../types';

export async function fetchInvoices(filters?: { status?: string; customerId?: string }): Promise<Invoice[]> {
  let query = supabase
    .from('invoices')
    .select('*, items:invoice_items(*)')
    .order('created_at', { ascending: false });
  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.customerId) query = query.eq('customer_id', filters.customerId);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as Invoice[];
}

export async function fetchInvoiceById(id: string): Promise<Invoice | null> {
  const { data } = await supabase
    .from('invoices')
    .select('*, items:invoice_items(*)')
    .eq('id', id)
    .maybeSingle();
  return data as Invoice | null;
}

export async function createInvoice(
  invoice: Partial<Invoice>,
  items: { product_id: string; product_name: string; quantity: number; rate: number; total_price: number; unit?: string; hsn_code?: string }[]
): Promise<{ invoice: Invoice; errors: string[] }> {
  const invoice_number = await generateInvoiceNumber();
  const { data, error } = await supabase
    .from('invoices')
    .insert({ ...invoice, invoice_number })
    .select()
    .single();
  if (error) throw error;

  if (items.length) {
    await supabase.from('invoice_items').insert(
      items.map(item => ({ ...item, invoice_id: data.id }))
    );
  }

  return { invoice: data as Invoice, errors: [] };
}

export async function generateInvoiceNumber(): Promise<string> {
  const now = new Date();
  const prefix = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const { data } = await supabase
    .from('invoices')
    .select('invoice_number')
    .ilike('invoice_number', `${prefix}%`)
    .order('invoice_number', { ascending: false })
    .limit(1);
  const last = data?.[0]?.invoice_number;
  const seq = last ? parseInt(last.split('-').pop() || '0', 10) + 1 : 1;
  return `${prefix}-${String(seq).padStart(3, '0')}`;
}

export async function recordPayment(
  invoiceId: string,
  amount: number,
  mode: string,
  date: string,
  notes?: string
): Promise<void> {
  const { data: invoice } = await supabase
    .from('invoices')
    .select('customer_id, total_amount, paid_amount, outstanding_amount, sales_order_id')
    .eq('id', invoiceId)
    .maybeSingle();
  if (!invoice) throw new Error('Invoice not found');

  await supabase.from('payments').insert({
    invoice_id: invoiceId,
    customer_id: invoice.customer_id,
    amount,
    payment_mode: mode,
    payment_date: date,
    notes,
    payment_type: 'receipt',
  });
}
