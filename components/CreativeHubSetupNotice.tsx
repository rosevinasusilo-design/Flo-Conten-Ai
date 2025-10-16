import React from 'react';

// FIX: Updated component definition to use React.FC for better type inference.
const SqlBlock: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm text-gray-300 border border-gray-700">
        <code>{children}</code>
    </pre>
);

const CreativeHubSetupNotice: React.FC = () => {
    return (
        <div className="flex h-full w-full items-center justify-center bg-dots-pattern p-4">
            <div className="w-full max-w-3xl p-8 space-y-6 bg-gray-800 border border-yellow-500 rounded-2xl shadow-2xl">
                <div className="text-center">
                    <div className="flex justify-center items-center gap-3">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <h1 className="text-2xl font-bold text-yellow-400">Creative Hub Setup Required</h1>
                    </div>
                    <p className="mt-2 text-gray-300">
                        To store and display your generated images, you need to configure your Supabase project.
                    </p>
                </div>

                <div className="space-y-6 text-gray-300 text-sm">
                    <div>
                        <h2 className="font-semibold text-lg text-white mb-2">Step 1: Create Database Table</h2>
                        <p className="mb-3">Go to the <span className="font-semibold text-emerald-400">SQL Editor</span> section in your Supabase dashboard and run the following command to create the `generated_images` table:</p>
                        <SqlBlock>
{`CREATE TABLE public.generated_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  prompt TEXT,
  image_path TEXT NOT NULL
);`}
                        </SqlBlock>
                    </div>

                    <div>
                        <h2 className="font-semibold text-lg text-white mb-2">Step 2: Create Storage Bucket</h2>
                        <ol className="list-decimal list-inside space-y-1 pl-2">
                            <li>Go to the <span className="font-semibold text-emerald-400">Storage</span> section in your Supabase dashboard.</li>
                            <li>Click <span className="font-semibold">"Create a new bucket"</span>.</li>
                            <li>Enter the bucket name as <code className="bg-gray-700 text-green-400 px-1.5 py-0.5 rounded">generated_images</code>.</li>
                            <li>Toggle the bucket to be <span className="font-semibold">Public</span>.</li>
                            <li>Click <span className="font-semibold">"Create bucket"</span>.</li>
                        </ol>
                    </div>

                    <div>
                        <h2 className="font-semibold text-lg text-white mb-2">Step 3: Secure Your Table (Recommended)</h2>
                        <p className="mb-3">For better security, go back to the <span className="font-semibold text-emerald-400">SQL Editor</span> and run these commands to enable Row Level Security (RLS). This ensures users can only see and save their own images.</p>
                        <SqlBlock>
{`-- Enable Row Level Security
ALTER TABLE public.generated_images ENABLE ROW LEVEL SECURITY;

-- Policy for users to view their own images
CREATE POLICY "Allow individual read access"
ON public.generated_images
FOR SELECT
USING (auth.uid() = user_id);

-- Policy for users to insert their own images
CREATE POLICY "Allow individual insert access"
ON public.generated_images
FOR INSERT
WITH CHECK (auth.uid() = user_id);`}
                        </SqlBlock>
                    </div>
                </div>

                 <p className="text-center text-gray-400 text-sm pt-4">
                    After you have completed these steps, <span className="font-semibold text-white">refresh this page</span>.
                </p>
            </div>
        </div>
    );
};

export default CreativeHubSetupNotice;