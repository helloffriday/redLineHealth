/* =========================================================
   Supabase connection config
   ---------------------------------------------------------
   Fill these in with your project's values:
   Supabase Dashboard → Project Settings → API
   - Project URL          -> SUPABASE_URL
   - anon / public API key -> SUPABASE_ANON_KEY

   Never put your service_role key in frontend code.
   ========================================================= */

const SUPABASE_URL = "https://xedrhpkwuevblxkmsxcl.supabase.co"; // e.g. https://xxxxxxxx.supabase.co
const SUPABASE_ANON_KEY = "sb_publishable_NS_pUJIxY3Ot4xBMjWJmIA__OfCvRYl";

// Single shared client instance used across every page.
// Relies on the Supabase JS library loaded via <script> tag before this file.
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
