import { createClient } from '@supabase/supabase-js';

// IMPORTANT: Ensure you have created a public bucket named 'payment_proofs' in your Supabase project.
// 1. Go to your Supabase dashboard -> Storage.
// 2. Click "New bucket".
// 3. Name it "payment_proofs" and check "Public bucket".
// 4. Save.

const supabaseUrl = 'https://lsmryfzqxmfbvwnafgfy.supabase.co';
const supabaseAnonKey = 'sb_publishable_Zs9hxRQWf7YgK2GF-e4afA_DsXXYEqo';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
