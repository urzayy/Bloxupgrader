/**
 * Local Vite / non-production should not block on Supabase.
 * Set BLOX_USE_SUPABASE=1 to force hybrid remote even in development.
 * Set BLOX_LOCAL_FILE_ONLY=1 to force file-only anywhere.
 */
export function preferLocalFileStore() {
  if (process.env.BLOX_LOCAL_FILE_ONLY === '1') return true;
  if (process.env.BLOX_USE_SUPABASE === '1') return false;
  if (process.env.DURABLE_JSON === '0') return true;
  return process.env.NODE_ENV !== 'production';
}
