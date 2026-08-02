import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://vwcwmxjztretyctasows.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_1lOb_co7p36h9I5c8STqTw_av0rQi-V';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);