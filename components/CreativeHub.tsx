import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Spinner } from './Spinner';
import CreativeHubSetupNotice from './CreativeHubSetupNotice'; // Import the new notice component

interface GeneratedImage {
    id: string;
    created_at: string;
    prompt: string;
    image_path: string;
    imageUrl: string;
    user_email: string;
}

const CreativeHub: React.FC = () => {
    const [images, setImages] = useState<GeneratedImage[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [showSetupNotice, setShowSetupNotice] = useState<boolean>(false);

    useEffect(() => {
        const fetchImages = async () => {
            setLoading(true);
            setError(null);
            setShowSetupNotice(false);

            try {
                // Fetch image records and join with profiles table to get email
                const { data, error: dbError } = await supabase
                    .from('generated_images')
                    .select(`
                        id,
                        created_at,
                        prompt,
                        image_path,
                        profiles (
                            email
                        )
                    `)
                    .order('created_at', { ascending: false });

                if (dbError) {
                    // This is the specific error for a missing table.
                    if (dbError.code === 'PGRST205' || dbError.message.includes('relation "public.generated_images" does not exist')) {
                        setShowSetupNotice(true);
                        return; // Stop processing and show the setup guide.
                    }
                    if (dbError.message.includes('relation "profiles" does not exist')) {
                         throw new Error('Could not fetch user emails. Please ensure the "profiles" table from the authentication starter template exists.');
                    }
                    throw dbError;
                }

                if (!data) {
                    setImages([]);
                    return;
                }

                // Create public URLs for each image
                const imageList = data.map(item => {
                    const { data: { publicUrl } } = supabase.storage
                        .from('generated_images')
                        .getPublicUrl(item.image_path);
                    
                    const profile = (item.profiles as any)?.[0] || item.profiles;

                    return {
                        id: item.id,
                        created_at: item.created_at,
                        prompt: item.prompt,
                        image_path: item.image_path,
                        imageUrl: publicUrl,
                        user_email: profile?.email || 'Unknown User'
                    };
                });

                setImages(imageList);

            } catch (err: any) {
                setError('Failed to fetch images. ' + err.message);
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchImages();
    }, []);

    if (showSetupNotice) {
        return <CreativeHubSetupNotice />;
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Spinner className="h-10 w-10" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8 text-center text-red-400">
                <p><strong>Error:</strong> {error}</p>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            {images.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-slate-600 pt-16">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    <h2 className="mt-4 text-xl font-semibold text-slate-400">The Creative Hub is Empty</h2>
                    <p className="mt-1 text-slate-500">Generate some images in the "Generate Image" tab, and they will appear here!</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                    {images.map(image => (
                        <div key={image.id} className="group relative aspect-square block w-full overflow-hidden rounded-lg bg-slate-800 shadow-lg">
                            <img 
                                src={image.imageUrl} 
                                alt={image.prompt} 
                                className="pointer-events-none h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
                            <div className="absolute inset-x-0 bottom-0 p-3">
                                <p className="text-xs text-slate-300 truncate opacity-0 transition-opacity duration-300 group-hover:opacity-100">{image.user_email}</p>
                                <p className="text-sm font-medium text-white truncate opacity-0 transition-opacity duration-300 group-hover:opacity-100">{image.prompt}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default CreativeHub;