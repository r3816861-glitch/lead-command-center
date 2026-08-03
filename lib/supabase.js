import { createClient } from '@supabase/supabase-js';

// Replace with your Supabase Project URL & Anon Key
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);