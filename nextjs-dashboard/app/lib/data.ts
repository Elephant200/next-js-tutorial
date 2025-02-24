import { createClient } from '@supabase/supabase-js';
import {
  CustomerField,
  CustomersTableType,
  InvoiceForm,
  InvoicesTable,
  LatestInvoiceRaw,
  Revenue,
} from './definitions';
import { formatCurrency } from './utils';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function fetchRevenue() {
  try {
    console.log('Fetching revenue data...');
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const { data, error } = await supabase.from('revenue').select('*');

    if (error) throw error;

    console.log('Data fetch completed after 3 seconds.');
    return data;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch revenue data.');
  }
}

export async function fetchLatestInvoices() {
  try {
    const { data, error } = await supabase.rpc('get_latest_invoices');

    
    if (error) throw error

    const latestInvoices = data.map((invoice: LatestInvoiceRaw) => ({
      ...invoice,
      amount: formatCurrency(invoice.amount),
    }));
    return latestInvoices;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch the latest invoices.');
  }
}

export async function fetchCardData() {
  try {
    const invoiceCountPromise = supabase.from('invoices').select('*', { count: 'exact', head: true })
    const customerCountPromise = supabase.from('customers').select('*', { count: 'exact', head: true });
    const invoiceStatusPromise = supabase.rpc('get_invoice_status')
    
    const [invoiceCount, customerCount, invoiceStatus] = await Promise.allSettled([
      invoiceCountPromise,
      customerCountPromise,
      invoiceStatusPromise,
    ]);

    const errors: String[] = []
    if (invoiceCount.status !== 'fulfilled') {
      errors.push(`Invoice Count Error: ${invoiceCount.reason.message || invoiceCount.reason}`);
    }
    if (customerCount.status !== 'fulfilled') {
      errors.push(`Customer Count Error: ${customerCount.reason.message || customerCount.reason}`);
    }
    if (invoiceStatus.status !== 'fulfilled') {
      errors.push(`Invoice Status Error: ${invoiceStatus.reason.message || invoiceStatus.reason}`);
    }

    if (invoiceCount.status !== "fulfilled" || customerCount.status !== "fulfilled" || invoiceStatus.status !== "fulfilled") {
      throw new Error(errors.join(' | '));
    }

    return {
      numberOfInvoices: invoiceCount.value.count || 0,
      numberOfCustomers: customerCount.value.count || 0,
      totalPaidInvoices: formatCurrency(invoiceStatus.value.data?.[0].paid || 0),
      totalPendingInvoices: formatCurrency(invoiceStatus.value.data?.[0].pending || 0),
    };
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch card data.');
  }
}

const ITEMS_PER_PAGE = 6;
export async function fetchFilteredInvoices(query: string, currentPage: number) {
  try {
    const offset = (currentPage - 1) * ITEMS_PER_PAGE;

    const { data, error } = await supabase
      .from('invoices')
      .select(`
        id,
        amount,
        date,
        status,
        customers(name, email, image_url)
      `)
      .or(
        `customers.name.ilike.%${query}%,customers.email.ilike.%${query}%,amount::text.ilike.%${query}%,date::text.ilike.%${query}%,status.ilike.%${query}%`
      )
      .order('date', { ascending: false })
      .range(offset, offset + ITEMS_PER_PAGE - 1);

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoices.');
  }
}

export async function fetchInvoicesPages(query: string) {
  try {
    const { data, error } = await supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .or(
        `customers.name.ilike.%${query}%,customers.email.ilike.%${query}%,amount::text.ilike.%${query}%,date::text.ilike.%${query}%,status.ilike.%${query}%`
      );
    
    if (error) throw error;

    const totalPages = Math.ceil(Number(data[0].count) / ITEMS_PER_PAGE);
    return totalPages;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch total number of invoices.');
  }
}

export async function fetchInvoiceById(id: string) {
  try {
    const { data, error } = await supabase
      .from('invoices')
      .select('id, customer_id, amount, status')
      .eq('id', id);
    
    if (error) throw error;

    const invoice = data.map((invoice) => ({
      ...invoice,
      amount: invoice.amount / 100,
    }));

    return invoice[0];
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoice.');
  }
}

export async function fetchCustomers() {
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('id, name')
      .order('name', { ascending: true });
    
    if (error) throw error;
    
    return data;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch all customers.');
  }
}

export async function fetchFilteredCustomers(query: string) {
  try {
    const { data, error } = await supabase.rpc('get_customers_for_search', { search_text: query });    
    if (error) throw error;

    const customers = data.map((customer: CustomersTableType) => ({
      ...customer,
      total_pending: customer.total_pending || 0,
      total_paid: formatCurrency(customer.total_paid),
    }));

    return customers;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch customer table.');
  }
}
