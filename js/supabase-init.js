// ============================================================
// SUPABASE INITIALIZATION
// Replace the two values below with YOUR project's values:
// Supabase Dashboard > Project Settings > API
//   - Project URL          -> SUPABASE_URL
//   - anon / public key    -> SUPABASE_ANON_KEY
// (The anon key is safe to expose in frontend code — Row Level
// Security policies, not secrecy of this key, protect your data.)
// ============================================================
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://aepmxyyggglkdtgqyjom.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_CaNtbcBCQcpWDvEindA8jA_NqhtEmwY";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helper: current month key, e.g. "2026-09"
export function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
