import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = "https://mlmstxyixynfsbolgnxu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sbXN0eHlpeHluZnNib2xnbnh1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODIzMjk4NSwiZXhwIjoyMDgzODA4OTg1fQ.vi2gPU4mscqOOedCPKEorCXjSHjpxTVkZo_4Ke06XRg";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
