// js/auth-guard.js
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const supabase = window.supabase?.createClient ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
(async function authGuard() {
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  if (!data?.session) {
    const r = encodeURIComponent(location.pathname + location.search);
    location.href = `auth.html?redirect=${r}`;
  }
})();
