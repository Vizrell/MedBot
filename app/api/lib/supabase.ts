import { createClient } from '@supabase/supabase-js';

// Reemplaza estos strings con los datos reales que acabas de copiar
const SUPABASE_URL = 'https://vwcwmxjztretyctasows.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_1lOb_co7p36h9I5c8STqTw_av0rQi-V';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);