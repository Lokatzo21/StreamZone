import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://xmlobzzlszwprjtrkicv.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtbG9ienpsc3p3cHJqdHJraWN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0OTQ3MjksImV4cCI6MjEwMjA3MDcyOX0.vqxcGLSrSGxlbP7yGwnQvdDT52wgbxyH56mTGi8eNEM';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache'
    }
  }
});
