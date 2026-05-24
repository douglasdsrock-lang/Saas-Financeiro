import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

console.log('Supabase: Environment check...', { 
  hasUrl: !!supabaseUrl, 
  hasKey: !!supabaseAnonKey,
  urlPrefix: supabaseUrl ? supabaseUrl.substring(0, 10) : 'none'
});

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase: Environment variables NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY are missing!');
}

let supabaseClient: any;
try {
  console.log('Supabase: Attempting to create client...');
  supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  console.log('Supabase: Client created successfully');
} catch (e) {
  console.error('Supabase: Failed to create client:', e);
  supabaseClient = null;
}

export const supabase = supabaseClient;

export type Database = {
  public: {
    Tables: {
      expenses: {
        Row: {
          id: string;
          description: string;
          amount: number;
          date: string;
          category_id: string;
          person_id: string;
          payment_method: string;
          is_fixed: boolean;
          recurring_bill_id: string | null;
          bank_id: string | null;
          credit_card_id: string | null;
          notes: string | null;
          status: 'pending' | 'paid';
          user_id: string;
          created_at: string;
        };
      };
      incomes: {
        Row: {
          id: string;
          description: string;
          amount: number;
          date: string;
          category_id: string;
          person_id: string;
          bank_id: string | null;
          recurring_income_id: string | null;
          notes: string | null;
          user_id: string;
          created_at: string;
        };
      };
      investments: {
        Row: {
          id: string;
          asset_name: string;
          amount: number;
          date: string;
          category_id: string;
          person_id: string;
          bank_id: string | null;
          notes: string | null;
          user_id: string;
          created_at: string;
        };
      };
      categories: {
        Row: {
          id: string;
          name: string;
          type: 'income' | 'expense' | 'investment';
          color: string | null;
          user_id: string;
        };
      };
      people: {
        Row: {
          id: string;
          name: string;
          color: string | null;
          user_id: string;
        };
      };
      banks: {
        Row: {
          id: string;
          name: string;
          color: string | null;
          user_id: string;
        };
      };
      credit_cards: {
        Row: {
          id: string;
          name: string;
          bank_id: string;
          holder_id: string;
          closing_day: number;
          due_day: number;
          limit_amount: number;
          active: boolean;
          user_id: string;
        };
      };
      card_purchases: {
        Row: {
          id: string;
          description: string;
          total_amount: number;
          date: string;
          card_id: string;
          category_id: string;
          installments_count: number;
          bank_id: string | null;
          notes: string | null;
          user_id: string;
        };
      };
      installments: {
        Row: {
          id: string;
          purchase_id: string;
          amount: number;
          due_date: string;
          installment_number: number;
          status: 'pending' | 'paid';
          user_id: string;
        };
      };
      recurring_bills: {
        Row: {
          id: string;
          name: string;
          amount: number;
          due_day: number;
          category_id: string;
          responsible_id: string;
          payment_method: string;
          credit_card_id: string | null;
          active: boolean;
          user_id: string;
        };
      };
      recurring_incomes: {
        Row: {
          id: string;
          name: string;
          amount: number;
          due_day: number;
          category_id: string;
          person_id: string;
          bank_id: string;
          active: boolean;
          user_id: string;
        };
      };
    };
  };
};
