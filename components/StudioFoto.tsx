import React, { useState, useEffect, useRef } from 'react';
import { useApiKey } from '../contexts/ApiKeyContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { Spinner } from './Spinner';
import Button from './Button';
import { ImageInput, ImageAspectRatio } from '../types';
import { generateStudioPhotos, generatePhotographyPrompt, analyzeCharacterImages } from '../services/geminiService';
import { ImagePreviewModal } from './ImagePreviewModal';
import SelectInput from './SelectInput';
import TextAreaInput from './TextAreaInput';
import TextInput from './TextInput';
import { DownloadIcon, MagnifyingGlassIcon, SparklesIcon, CameraIcon, XIcon } from './icons';

const cameraOptions = [
    { value: 'Canon EOS R5', label: 'Canon EOS R5' },
    { value: 'Sony A7R IV', label: 'Sony A7R IV' },
    { value: 'Nikon Z7 II', label: 'Nikon Z7 II' },
    { value: 'Fujifilm XT-5 (retro tone)', label: 'Fujifilm XT-5 (tone retro)' },
    { value: 'Hasselblad X2D (premium color tone)', label: 'Hasselblad X2D (color tone premium)' },
    { value: 'Leica M11 (rich, film-like colors)', label: 'Leica M11 (warna kaya film)'},
    { value: 'Phase One XF IQ4 (ultimate detail)', label: 'Phase One XF IQ4 (detail ultimate)'},
    { value: 'custom', label: 'Custom' },
];

const styleOptions = [
    { value: 'Classic Portrait (soft lighting, natural tones)', label: 'Classic Portrait' },
    { value: 'Fashion Editorial (high contrast, magazine look)', label: 'Fashion Editorial' },
    { value: 'Product Lightbox (clean white background)', label: 'Product Lightbox' },
    { value: 'Cinematic Moody (dark, elegant, dramatic atmosphere)', label: 'Cinematic Moody' },
    { value: 'Korean Style (bright pastels, clean aesthetic)', label: 'Korean Style' },
    { value: 'Outdoor Natural Light (realistic, natural tones)', label: 'Outdoor Natural Light' },
    { value: 'Elegant Monochrome (artistic black and white)', label: 'Monokrom Elegan' },
    { value: 'custom', label: 'Custom' },
];

const backgroundOptions = [
    { value: 'a clean white studio background', label: 'Studio Putih Bersih' },
    { value: 'a moody, dark studio background', label: 'Studio Gelap Dramatis' },
    { value: 'a seamless paper backdrop (e.g., beige, soft blue)', label: 'Latar Belakang Kertas Mulus'},
    { value: 'a textured wall (e.g., brick, plaster)', label: 'Dinding Bertekstur (Bata, Plester)'},
    { value: 'a set with vintage furniture', label: 'Set dengan Furnitur Antik'},
    { value: 'an industrial loft with large windows', label: 'Loteng Industri dengan Jendela Besar'},
    { value: 'an outdoor city street at night with neon lights', label: 'Jalanan Kota (Malam)' },
    { value: 'a beautiful beach at sunset', label: 'Pantai (Matahari Terbenam)' },
    { value: 'a lush green forest with soft light filtering through trees', label: 'Hutan / Alam' },
    { value: 'an abstract, colorful, painterly backdrop', label: 'Abstrak Berwarna' },
    { value: 'a minimalist concrete interior', label: 'Interior Minimalis Beton' },
    { value: 'custom', label: 'Custom' },
];

const poseOptions = [
    { value: 'standing still, looking at camera', label: 'Berdiri, melihat kamera' },
    { value: 'walking towards camera', label: 'Berjalan ke arah kamera' },
    { value: 'sitting on a chair', label: 'Duduk di kursi' },
    { value: 'leaning against a wall', label: 'Bersandar di dinding' },
    { value: 'a dynamic action pose', label: 'Pose aksi dinamis' },
    { value: 'looking away from the camera', label: 'Melihat ke arah lain' },
    { value: 'with hands in pockets', label: 'Tangan di saku' },
    { value: 'custom', label: 'Custom' },
];

const aspectRatioOptions: { value: ImageAspectRatio; label: string }[] = [
    { value: '1:1', label: '1:1' },
    { value: '3:4', label: '3:4' },
    { value: '4:3', label: '4:3' },
    { value: '9:16', label: '9:16' },
    { value: '16:9', label: '16:9' },
];

const fileToImageInput = (file: File): Promise<ImageInput> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const [mimePart, dataPart] = result.split(';base64,');
      resolve({ data: dataPart, mimeType: mimePart.split(':')[1] });
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

const cropImageToAspectRatio = (
  base64Data: string,
  mimeType: string,
  targetAspectRatioString: string
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const sourceWidth = img.naturalWidth;
      const sourceHeight = img.naturalHeight;
      const sourceAspectRatio = sourceWidth / sourceHeight;

      const [targetW, targetH] = targetAspectRatioString.split(':').map(Number);
      if (!targetW || !targetH) {
          return reject(new Error('Invalid aspect ratio string'));
      }
      const targetAspectRatio = targetW / targetH;

      let sx = 0, sy = 0, sWidth = sourceWidth, sHeight = sourceHeight;

      if (Math.abs(sourceAspectRatio - targetAspectRatio) > 0.01) {
          if (sourceAspectRatio > targetAspectRatio) {
            sWidth = sourceHeight * targetAspectRatio;
            sx = (sourceWidth - sWidth) / 2;
          } 
          else {
            sHeight = sourceWidth / targetAspectRatio;
            sy = (sourceHeight - sHeight) / 2;
          }
      }
      
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(sWidth);
      canvas.height = Math.round(sHeight);
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        return reject(new Error('Could not get canvas context'));
      }

      ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);

      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => {
      reject(new Error('Image failed to load for cropping.'));
    };
    img.src = `data:${mimeType};base64,${base64Data}`;
  });
};

interface Result {
    id: string;
    url: string;
    image: ImageInput;
    isSaving: boolean;
}

const StudioFoto: React.FC = () => {
    const { apiKey, isApiKeySet } = useApiKey();
    const { user } = useAuth();

    const [modelFile, setModelFile] = useState<File[]>([]);
    const [previewUrls, setPreviewUrls] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // Prompt states
    const [useManualPrompt, setUseManualPrompt] = useState(false);
    const [manualPrompt, setManualPrompt] = useState('');
    const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);

    // Structured mode states
    const [camera, setCamera] = useState(cameraOptions[0].value);
    const [customCamera, setCustomCamera] = useState('');
    const [style, setStyle] = useState(styleOptions[0].value);
    const [customStyle, setCustomStyle] = useState('');
    const [background, setBackground] = useState(backgroundOptions[0].value);
    const [customBackground, setCustomBackground] = useState('');
    const [pose, setPose] = useState(poseOptions[0].value);
    const [customPose, setCustomPose] = useState('');
    const [otherModelDescription, setOtherModelDescription] = useState('');
    
    const [aspectRatio, setAspectRatio] = useState<ImageAspectRatio>('3:4');
    
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [results, setResults] = useState<Result[]>([]);
    
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const isPreviewOpen = !!previewUrl;

    useEffect(() => {
        const urls = modelFile.map(file => URL.createObjectURL(file));
        setPreviewUrls(urls);
        // Cleanup object URLs on unmount or when files change
        return () => {
            urls.forEach(url => URL.revokeObjectURL(url));
        };
    }, [modelFile]);

    const handleAddFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
        const newFiles = event.target.files ? Array.from(event.target.files) : [];
        if (newFiles.length > 0) {
            setModelFile(prevFiles => {
                const combined = [...prevFiles, ...newFiles];
                // Prevent duplicates based on name and size
                const uniqueFiles = combined.filter((file, index, self) =>
                    index === self.findIndex((f) => f.name === file.name && f.size === file.size)
                );
                return uniqueFiles.slice(0, 5); // Enforce max 5 files
            });
        }
    };

    const handleRemoveFile = (indexToRemove: number) => {
        setModelFile(prevFiles => prevFiles.filter((_, index) => index !== indexToRemove));
    };

    const handleGenerateNewPrompt = async () => {
        if (!isApiKeySet) { setError("Kunci API belum diatur."); return; }
        setIsGeneratingPrompt(true);
        setError(null);
        try {
            let baseIdea = manualPrompt || 'a fashionable model';

            if (modelFile.length > 0) {
                const modelImages = await Promise.all(modelFile.map(fileToImageInput));
                baseIdea = await analyzeCharacterImages(apiKey, modelImages);
            }

            const scenePrompt = await generatePhotographyPrompt(apiKey, baseIdea);
            
            let referenceInstruction = '';
            if (modelFile.length > 0) {
                referenceInstruction = "This prompt creates a new scene. **Use the face(s) from the uploaded image(s) as a reference for the character(s)**, but generate a new body, pose, clothing, and background as described below.\n\n";
            }
            
            setManualPrompt(referenceInstruction + scenePrompt);

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Gagal membuat prompt.');
        } finally {
            setIsGeneratingPrompt(false);
        }
    };

    const handleGenerate = async () => {
        if (!isApiKeySet) { setError("Kunci API belum diatur."); return; }
        if (modelFile.length === 0) { setError("Silakan unggah setidaknya satu foto model."); return; }
        
        setIsLoading(true);
        setError(null);
        setResults([]);

        try {
            let fullPrompt: string;
            
            let characterInstruction = '';
            if (modelFile.length === 1) {
                characterInstruction = "The final image must feature one person. Use the face from the provided reference image for this person, but generate a new body, pose, and clothing.";
            } else if (modelFile.length > 1) {
                characterInstruction = `The final image must feature exactly ${modelFile.length} people interacting together in the same scene. For each person, use one of the unique faces from the provided reference images. Ensure all faces are used and are distinct. Generate new bodies, poses, and clothing for all characters.`;
            }

            if (useManualPrompt) {
                if (!manualPrompt.trim()) throw new Error("Prompt manual tidak boleh kosong.");
                fullPrompt = `${manualPrompt}. The final image must have a ${aspectRatio} aspect ratio. ${characterInstruction}`;
            } else {
                const cameraValue = camera === 'custom' ? customCamera.trim() : camera;
                const styleValue = style === 'custom' ? customStyle.trim() : style;
                const backgroundValue = background === 'custom' ? customBackground.trim() : background;
                const poseValue = pose === 'custom' ? customPose.trim() : pose;
                const otherDescValue = otherModelDescription.trim();

                if (!cameraValue || !styleValue || !backgroundValue || !poseValue) throw new Error("Silakan lengkapi semua pilihan (Kamera, Gaya, Latar, Pose).");

                fullPrompt = `A professional studio photoshoot.
- The photo should look like it was taken with a ${cameraValue}.
- The lighting and mood should be ${styleValue}.
- The background is ${backgroundValue}.
- The model's pose is: ${poseValue}.
- The composition is a ${aspectRatio} frame.
- IMPORTANT: ${characterInstruction} The final result must be a high-quality, photorealistic image.`;

                if (otherDescValue) {
                    fullPrompt += `\n- Additional model description: ${otherDescValue}.`;
                }
            }

            const modelImages = await Promise.all(modelFile.map(fileToImageInput));
            const generatedImages = await generateStudioPhotos(apiKey, {
                modelImages,
                prompt: fullPrompt,
                count: 4,
            });

            const processedResults = await Promise.all(generatedImages.map(async (img) => {
                const croppedDataUrl = await cropImageToAspectRatio(img.data, img.mimeType, aspectRatio);
                const [mimePart, dataPart] = croppedDataUrl.split(';base64,');
                
                return {
                    id: `result-${Math.random()}`,
                    url: croppedDataUrl,
                    image: {
                        data: dataPart,
                        mimeType: 'image/png'
                    },
                    isSaving: false,
                };
            }));
            
            setResults(processedResults);

        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleSave = async (resultId: string) => {
        const result = results.find(r => r.id === resultId);
        if (!result || !user) return;

        setResults(prev => prev.map(r => r.id === resultId ? { ...r, isSaving: true } : r));
        
        try {
            const response = await fetch(result.url);
            const blob = await response.blob();
            const filePath = `${user.id}/${Date.now()}.png`;

            const { error: uploadError } = await supabase.storage
                .from('generated_images')
                .upload(filePath, blob);
            if (uploadError) throw uploadError;

            const { error: dbError } = await supabase
                .from('generated_images')
                .insert({
                    user_id: user.id,
                    prompt: `Studio Foto: ${camera}, ${style}`,
                    image_path: filePath,
                });
            if (dbError) throw dbError;
            
        } catch (err) {
            setError(err instanceof Error ? `Failed to save: ${err.message}` : 'Failed to save to Creative Hub.');
        } finally {
            setResults(prev => prev.map(r => r.id === resultId ? { ...r, isSaving: false } : r));
        }
    };

    const handleDownload = (url: string) => {
        const link = document.createElement('a');
        link.href = url;
        link.download = `studio-foto-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <>
            <div className="h-full overflow-y-auto bg-gray-900 p-4 sm:p-6 lg:p-8">
                <div className="max-w-6xl mx-auto space-y-8">
                    {/* Controls */}
                    <section>
                         <h1 className="text-3xl font-bold text-white mb-6 text-center">Studio Foto</h1>
                         <div className="bg-gray-800/50 p-6 rounded-2xl border border-gray-700">
                             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <div className="lg:col-span-1 space-y-4">
                                     <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">Upload Foto Model</label>
                                        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-3 gap-2">
                                            {previewUrls.map((url, index) => (
                                                <div key={index} className="relative group aspect-square">
                                                    <img src={url} alt={`Model preview ${index + 1}`} className="w-full h-full object-cover rounded-md" />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveFile(index)}
                                                        className="absolute top-1 right-1 p-1 bg-black/60 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80"
                                                        aria-label="Hapus foto"
                                                        disabled={isLoading}
                                                    >
                                                        <XIcon className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            ))}
                                            {modelFile.length < 5 && (
                                                <button
                                                    type="button"
                                                    onClick={() => fileInputRef.current?.click()}
                                                    disabled={isLoading}
                                                    className="flex items-center justify-center w-full aspect-square rounded-lg border-2 border-dashed border-gray-600 text-gray-500 hover:border-emerald-500 hover:text-emerald-500 transition-colors"
                                                >
                                                    <div className="text-center">
                                                        <i className="fa-solid fa-plus text-xl"></i>
                                                        <span className="text-xs block mt-1">Tambah Foto</span>
                                                    </div>
                                                </button>
                                            )}
                                        </div>
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={handleAddFiles}
                                            className="hidden"
                                            accept="image/png, image/jpeg"
                                            multiple
                                            disabled={isLoading}
                                        />
                                        <p className="text-xs text-gray-500 mt-2">Anda dapat mengunggah hingga 5 foto referensi wajah.</p>
                                    </div>
                                </div>

                                <div className="lg:col-span-2 space-y-4">
                                    <div className="flex items-center gap-3">
                                        <input id="manual-prompt-toggle" type="checkbox" checked={useManualPrompt} onChange={(e) => setUseManualPrompt(e.target.checked)} disabled={isLoading} className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-gray-900"/>
                                        <label htmlFor="manual-prompt-toggle" className="text-sm font-medium text-gray-300">Prompt Manual</label>
                                    </div>
                                    
                                    {useManualPrompt ? (
                                        <div className="relative">
                                            <TextAreaInput label="" value={manualPrompt} onChange={setManualPrompt} placeholder="e.g., A full body shot of a female model wearing a red dress, in a minimalist concrete studio, cinematic lighting..." rows={8} />
                                             <Button
                                                type="button"
                                                variant="secondary"
                                                onClick={handleGenerateNewPrompt}
                                                disabled={isGeneratingPrompt || isLoading}
                                                className="!absolute top-2 right-2 !p-2 h-8 w-8"
                                                title="Generate ide prompt"
                                            >
                                                {isGeneratingPrompt ? <Spinner className="w-4 h-4" /> : <SparklesIcon className="w-4 h-4" />}
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="space-y-4 animate-fade-in-fast">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div>
                                                    <SelectInput label="Tipe Kamera" value={camera} onChange={(val) => setCamera(val)} options={cameraOptions} />
                                                    {camera === 'custom' && <TextInput label="" value={customCamera} onChange={(e) => setCustomCamera(e.target.value)} placeholder="Tulis tipe kamera..." className="mt-2 !bg-gray-900"/>}
                                                </div>
                                                <div>
                                                    <SelectInput label="Gaya Visual Studio" value={style} onChange={(val) => setStyle(val)} options={styleOptions} />
                                                    {style === 'custom' && <TextInput label="" value={customStyle} onChange={(e) => setCustomStyle(e.target.value)} placeholder="Tulis gaya visual..." className="mt-2 !bg-gray-900"/>}
                                                </div>
                                                <div>
                                                    <SelectInput label="Latar" value={background} onChange={(val) => setBackground(val)} options={backgroundOptions} />
                                                    {background === 'custom' && <TextInput label="" value={customBackground} onChange={(e) => setCustomBackground(e.target.value)} placeholder="Tulis latar belakang..." className="mt-2 !bg-gray-900"/>}
                                                </div>
                                                <div>
                                                    <SelectInput label="Pose" value={pose} onChange={(val) => setPose(val)} options={poseOptions} />
                                                    {pose === 'custom' && <TextInput label="" value={customPose} onChange={(e) => setCustomPose(e.target.value)} placeholder="Tulis pose custom..." className="mt-2 !bg-gray-900"/>}
                                                </div>
                                            </div>
                                            <div>
                                                <TextAreaInput
                                                    label="Deskripsi Lain Model"
                                                    value={otherModelDescription}
                                                    onChange={setOtherModelDescription}
                                                    placeholder="Contoh: mengenakan jaket perak futuristik, memiliki mata biru menyala..."
                                                    rows={2}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                             </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6 mt-6 border-t border-gray-700">
                               <div>
                                    <SelectInput label="Rasio Gambar" value={aspectRatio} onChange={(val) => setAspectRatio(val as ImageAspectRatio)} options={aspectRatioOptions} />
                               </div>
                            </div>
                            
                            <div className="pt-6 mt-6 border-t border-gray-700">
                                <Button onClick={handleGenerate} disabled={isLoading || modelFile.length === 0} className="w-full max-w-md mx-auto">
                                    {isLoading ? <Spinner /> : <SparklesIcon className="w-5 h-5" />}
                                    Generate 4 Variasi
                                </Button>
                                {error && <p className="text-sm text-red-400 text-center mt-4 bg-red-900/20 p-3 rounded-md">{error}</p>}
                            </div>
                         </div>
                    </section>
                    
                    {/* Results */}
                    <section className="min-h-[500px]">
                        {isLoading ? (
                            <div className="flex h-full items-center justify-center flex-col gap-4 py-16">
                                <Spinner className="w-12 h-12" />
                                <p className="text-gray-400">AI sedang memproses foto Anda...</p>
                            </div>
                        ) : results.length > 0 ? (
                            <div>
                                <h2 className="text-2xl font-bold text-white mb-6 text-center">Hasil Foto</h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    {results.map(result => (
                                        <div key={result.id} className="group relative bg-black rounded-lg overflow-hidden border border-gray-700" style={{ aspectRatio: aspectRatio.replace(':', ' / ') }}>
                                            <img src={result.url} alt="Generated studio" className="w-full h-full object-contain"/>
                                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 sm:gap-4 p-2">
                                                <Button variant="secondary" size="sm" onClick={() => setPreviewUrl(result.url)}>
                                                    <MagnifyingGlassIcon className="w-4 h-4" /> Perbesar
                                                </Button>
                                                <Button variant="secondary" size="sm" onClick={() => handleDownload(result.url)}>
                                                    <DownloadIcon className="w-4 h-4" /> Download
                                                </Button>
                                            </div>
                                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="secondary" size="sm" onClick={() => handleSave(result.id)} disabled={result.isSaving} className="!p-2 h-8 w-8">
                                                    {result.isSaving ? <Spinner className="w-4 h-4" /> : <i className="fa-solid fa-save"></i>}
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="flex h-full items-center justify-center text-center text-gray-600 py-16">
                               <div className="flex flex-col items-center gap-4">
                                   <CameraIcon className="w-16 h-16"/>
                                   <h2 className="text-xl font-bold text-gray-400">Area Preview</h2>
                                   <p>Hasil foto Anda akan muncul di sini setelah proses generate.</p>
                               </div>
                            </div>
                        )}
                    </section>
                </div>
            </div>
            <ImagePreviewModal isOpen={isPreviewOpen} onClose={() => setPreviewUrl(null)} imageUrl={previewUrl} />
            <style>{`
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                .animate-fade-in-fast { animation: fadeIn 0.3s ease-in-out; }
            `}</style>
        </>
    );
};

export default StudioFoto;
