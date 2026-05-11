import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const FALLBACK_SUPABASE_URL = "https://vjkocqsqnhhgegagnjtj.supabase.co";
const FALLBACK_SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqa29jcXNxbmhoZ2VnYWduanRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODExODYsImV4cCI6MjA4NDY1NzE4Nn0.-VvH3zdttZ8lain-DRLH10btJxe5vuPieLT-8mevBMs";

const RESOLVED_SUPABASE_URL = SUPABASE_URL || FALLBACK_SUPABASE_URL;
const RESOLVED_SUPABASE_PUBLISHABLE_KEY =
  SUPABASE_PUBLISHABLE_KEY || FALLBACK_SUPABASE_PUBLISHABLE_KEY;

// Auth is always available because we ship a working fallback URL + publishable key.
export const hasSupabaseEnv = true;

export const supabase = createClient<Database>(
  RESOLVED_SUPABASE_URL,
  RESOLVED_SUPABASE_PUBLISHABLE_KEY,
);
