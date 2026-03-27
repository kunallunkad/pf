import { supabase } from './supabase';
import { generateId } from './utils';

export async function createLedgerEntryPair(
  entryDate: string,
  partyId: string,
  partyName: string,
  description: string,
  amount: number,
  referenceType: string,
  referenceId: string,
  debitAccountType: string,
  creditAccountType: string
): Promise<void> {
  const entries = [
    {
      entry_date: entryDate,
      entry_type: 'debit',
      account_type: debitAccountType,
      party_id: partyId,
      party_name: partyName,
      reference_type: referenceType,
      reference_id: referenceId,
      description,
      amount,
      running_balance: 0,
    },
    {
      entry_date: entryDate,
      entry_type: 'credit',
      account_type: creditAccountType,
      party_id: partyId,
      party_name: partyName,
      reference_type: referenceType,
      reference_id: referenceId,
      description,
      amount,
      running_balance: 0,
    },
  ];
  await supabase.from('ledger_entries').insert(entries);
}

export async function autoCreateLedgerOnPayment(
  paymentId: string,
  paymentDate: string,
  customerId: string,
  customerName: string,
  amount: number,
  paymentMode: string
): Promise<void> {
  const description = `Payment received from ${customerName} via ${paymentMode}`;
  await createLedgerEntryPair(
    paymentDate,
    customerId,
    customerName,
    description,
    amount,
    'payment',
    paymentId,
    'cash',
    'customer'
  );
}

export async function autoCreateLedgerOnInvoice(
  invoiceId: string,
  invoiceDate: string,
  customerId: string,
  customerName: string,
  amount: number,
  invoiceNumber: string
): Promise<void> {
  const description = `Invoice ${invoiceNumber} raised for ${customerName}`;
  await createLedgerEntryPair(
    invoiceDate,
    customerId,
    customerName,
    description,
    amount,
    'invoice',
    invoiceId,
    'customer',
    'income'
  );
}
