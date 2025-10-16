// Ini adalah Vercel Serverless Function yang berjalan di lingkungan Node.js.
// Vercel akan menangani kompilasi TypeScript secara otomatis.
// Kami menggunakan signature generik untuk Request/Response agar tidak memerlukan dependensi @vercel/node.

// Definisikan tipe dasar untuk request dan response agar sesuai dengan lingkungan Vercel.
interface VercelRequest {
  // Kita tidak menggunakan properti apa pun dari objek request untuk fungsi ini.
}

interface VercelResponse {
  status: (statusCode: number) => VercelResponse;
  json: (body: any) => void;
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Mengakses kunci API secara aman dari environment variables Vercel.
  const apiKey = process.env.API_KEY;

  if (apiKey) {
    // Jika kunci ada, kirimkan ke frontend.
    res.status(200).json({ apiKey });
  } else {
    // Jika kunci tidak dikonfigurasi di server, kirimkan error.
    // Ini membantu dalam proses debug saat penyiapan.
    res.status(500).json({ error: "Kunci API tidak dikonfigurasi di server." });
  }
}
