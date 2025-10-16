import { createClient } from '@supabase/supabase-js';

// --- GANTI DENGAN KREDENSIAL SUPABASE BARU ANDA ---
// Anda harus mengganti nilai placeholder di bawah ini dengan URL dan Kunci Anon
// dari proyek Supabase baru yang telah Anda buat.
//
// Cara menemukan kredensial Anda:
// 1. Buka dasbor Supabase Anda.
// 2. Pergi ke "Project Settings" (ikon gerigi).
// 3. Klik "API".
// 4. Salin "Project URL" dan tempel di `supabaseUrl`.
// 5. Salin "Project API Keys" (yang `anon` `public`) dan tempel di `supabaseAnonKey`.

const supabaseUrl: string = 'https://aciyiufghuhsplgisewb.supabase.co';
const supabaseAnonKey: string = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjaXlpdWZnaHVoc3BsZ2lzZXdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyMjg2MDcsImV4cCI6MjA3NTgwNDYwN30.oJ5o66OLqj7RLoRyM1bW6ZkFXoH3j182UF_zyZp-B94';

// Create and export the client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * A flag to check if the Supabase credentials have been configured.
 * The app will show a configuration notice if this is false.
 */
export const isSupabaseConfigured = 
    !supabaseUrl.includes('GANTI_DENGAN_URL_PROYEK_BARU_ANDA') &&
    !supabaseAnonKey.includes('GANTI_DENGAN_KUNCI_ANON_PUBLIK_BARU_ANDA');