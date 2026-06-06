/*
  supabase-config.js
  ------------------
  Supabase configuration for the review system.
  This file loads before script.js and provides a ready-to-use client.
*/

const SUPABASE_URL = 'https://hlfkpizctikpqeznknat.supabase.co';
const SUPABASE_KEY = 'sb_publishable_jNSWVpxJwbze4XulIoXkaw_0XbWy2HB';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Optional: warn if the client is not available
if (!supabaseClient) {
  console.warn('Supabase client could not be initialized. Reviews will fallback to UI-only mode.');
}
