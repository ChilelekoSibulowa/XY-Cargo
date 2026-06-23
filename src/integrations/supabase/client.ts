import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const FALLBACK_SUPABASE_URL = "https://ktnfzvfeprcspsabgjhd.supabase.co";
const FALLBACK_SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0bmZ6dmZlcHJjc3BzYWJnamhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwOTE2NjUsImV4cCI6MjA5NzY2NzY2NX0.ZfSjXpNO7n9LayQz6KVrDW_XIAqOGG4UEOlRilS553U";

const RESOLVED_SUPABASE_URL = SUPABASE_URL || FALLBACK_SUPABASE_URL;
const RESOLVED_SUPABASE_PUBLISHABLE_KEY =
  SUPABASE_PUBLISHABLE_KEY || FALLBACK_SUPABASE_PUBLISHABLE_KEY;

// Auth is always available because we ship a working fallback URL + publishable key.
export const hasSupabaseEnv = true;

export const supabase = createClient<Database>(
  RESOLVED_SUPABASE_URL,
  RESOLVED_SUPABASE_PUBLISHABLE_KEY,
);
