import React from 'react';

const SupabaseConfigNotice: React.FC = () => {
    return (
        <div className="flex h-screen w-screen items-center justify-center bg-gray-900 text-gray-200 p-4">
            <div className="w-full max-w-2xl p-8 space-y-6 bg-gray-800 border border-red-500 rounded-2xl shadow-2xl text-center">
                <div className="flex justify-center items-center gap-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <h1 className="text-2xl font-bold text-red-400">Konfigurasi Supabase Diperlukan</h1>
                </div>
                <p className="text-gray-300">
                    Aplikasi ini belum terhubung ke database Supabase. Anda perlu mengatur kredensial di dalam kode.
                </p>
                <div className="text-left bg-gray-900 p-4 rounded-lg font-mono text-sm text-gray-400 space-y-3 border border-gray-700">
                    <p><strong>Langkah 1:</strong> Buka file berikut di editor Anda:</p>
                    <code className="block bg-gray-700 text-green-500 px-3 py-2 rounded w-full">lib/supabaseClient.ts</code>
                    <p><strong>Langkah 2:</strong> Salin <strong>URL Proyek</strong> dan <strong>Kunci `anon`</strong> dari dasbor Supabase Anda.</p>
                    <p><strong>Langkah 3:</strong> Tempelkan kredensial tersebut ke dalam file untuk menggantikan nilai placeholder:</p>
                    <pre className="bg-black p-3 rounded overflow-x-auto text-xs"><code>
                        <span className="text-gray-500">// Ganti ini:</span><br/>
                        const supabaseUrl: string = 'https://<span className="text-red-400">GANTI_DENGAN_URL_PROYEK_BARU_ANDA</span>.supabase.co';<br/>
                        const supabaseAnonKey: string = '<span className="text-red-400">GANTI_DENGAN_KUNCI_ANON_PUBLIK_BARU_ANDA</span>';
                    </code></pre>
                </div>
                 <p className="text-gray-400 text-sm pt-2">
                    Setelah Anda menyimpan perubahan pada file, muat ulang halaman ini. Jika Anda belum membuat proyek, kunjungi <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="text-green-500 hover:underline">supabase.com</a>.
                </p>
            </div>
        </div>
    );
};

export default SupabaseConfigNotice;