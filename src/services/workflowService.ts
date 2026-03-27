import { supabase } from '../lib/supabase';
import { reduceGodownStock } from './godownService';
import { saveLastRatesBulk } from './rateService';

export async function onInvoiceCreated(invoiceId: string): Promise<{ errors: string[] }> {
  const errors: string[] = [];

  const { data: invoice } = await supabase
    .from('invoices')
    .select('*, items:invoice_items(*)')
    .eq('id', invoiceId)
    .maybeSingle();

  if (!invoice) return { errors: ['Invoice not found'] };

  const godownId = invoice.godown_id;
  if (godownId) {
    for (const item of invoice.items || []) {
      const result = await reduceGodownStock(item.product_id, godownId, item.quantity);
      if (result.error) errors.push(`${item.product_name}: ${result.error}`);

      await supabase.from('stock_movements').insert({
        product_id: item.product_id,
        movement_type: 'sale',
        quantity: item.quantity,
        reference_number: invoice.invoice_number,
        notes: `Invoice ${invoice.invoice_number}`,
      });

      const { data: prod } = await supabase
        .from('products')
        .select('stock_quantity')
        .eq('id', item.product_id)
        .maybeSingle();
      if (prod) {
        await supabase.from('products').update({
          stock_quantity: Math.max(0, prod.stock_quantity - item.quantity),
          updated_at: new Date().toISOString(),
        }).eq('id', item.product_id);
      }
    }
  }

  await supabase.from('ledger_entries').insert({
    customer_id: invoice.customer_id,
    entry_type: 'debit',
    amount: invoice.total_amount,
    description: `Invoice ${invoice.invoice_number}`,
    reference_type: 'invoice',
    reference_id: invoiceId,
    entry_date: invoice.invoice_date,
  });

  if (invoice.customer_id) {
    const items = (invoice.items || []).map((item: { product_id: string; rate: number }) => ({
      product_id: item.product_id,
      rate: item.rate,
    }));
    await saveLastRatesBulk(invoice.customer_id, items, 'invoice', invoiceId);
  }

  if (invoice.sales_order_id) {
    await supabase
      .from('sales_orders')
      .update({ status: 'invoiced', updated_at: new Date().toISOString() })
      .eq('id', invoice.sales_order_id);
  }

  return { errors };
}

export async function onPaymentCreated(paymentId: string): Promise<void> {
  const { data: payment } = await supabase
    .from('payments')
    .select('*')
    .eq('id', paymentId)
    .maybeSingle();

  if (!payment) return;

  const { data: invoice } = await supabase
    .from('invoices')
    .select('id, total_amount, paid_amount, outstanding_amount, sales_order_id')
    .eq('id', payment.invoice_id)
    .maybeSingle();

  if (!invoice) return;

  const newPaid = (invoice.paid_amount || 0) + payment.amount;
  const newOutstanding = Math.max(0, invoice.total_amount - newPaid);
  const newStatus = newOutstanding <= 0 ? 'paid' : newPaid > 0 ? 'partial' : 'sent';

  await supabase.from('invoices').update({
    paid_amount: newPaid,
    outstanding_amount: newOutstanding,
    status: newStatus,
    updated_at: new Date().toISOString(),
  }).eq('id', invoice.id);

  await supabase.from('ledger_entries').insert({
    customer_id: payment.customer_id,
    entry_type: 'credit',
    amount: payment.amount,
    description: `Payment received — ${payment.payment_mode || 'cash'}`,
    reference_type: 'payment',
    reference_id: paymentId,
    entry_date: payment.payment_date,
  });

  if (newStatus === 'paid' && invoice.sales_order_id) {
    await supabase
      .from('sales_orders')
      .update({ status: 'closed', updated_at: new Date().toISOString() })
      .eq('id', invoice.sales_order_id);
  }
}
