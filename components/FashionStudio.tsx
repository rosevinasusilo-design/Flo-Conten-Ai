import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useApiKey } from '../contexts/ApiKeyContext';
import { Spinner } from './Spinner';
import Button from './Button';
import { ImageInput, ImageAspectRatio, VeoModel } from '../types';
import { GoogleGenAI, Modality } from "@google/genai";
import { DownloadIcon, LightbulbIcon, VideoIcon } from './icons';
import { generateImage, suggestVideoPrompt, generateVideo } from '../services/geminiService';


// Helper function to convert File to ImageInput
const fileToImageInput = (file: File): Promise<ImageInput> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            const [mimePart, dataPart] = result.split(';base64,');
            if (!dataPart) {
                reject(new Error("Could not extract base64 data from file."));
                return;
            }
            const mimeType = mimePart.split(':')[1];
            resolve({ data: dataPart, mimeType });
        };
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
    });
};

const generateRandomString = (length: number): string => Math.random().toString(36).substring(2, 2 + length);

/**
 * Crops an image from a base64 string to a target aspect ratio, removing black bars.
 * This assumes the content is centered and the image is padded (pillarboxed/letterboxed).
 */
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

      // Use a small tolerance for floating point comparisons
      if (Math.abs(sourceAspectRatio - targetAspectRatio) > 0.01) {
          // Pillarboxed: Image is wider than target (e.g., 1:1 source, 9:16 target)
          if (sourceAspectRatio > targetAspectRatio) {
            sWidth = sourceHeight * targetAspectRatio;
            sx = (sourceWidth - sWidth) / 2;
          } 
          // Letterboxed: Image is taller than target (e.g., 1:1 source, 16:9 target)
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

      resolve(canvas.toDataURL(mimeType));
    };
    img.onerror = () => {
      reject(new Error('Image failed to load for cropping.'));
    };
    img.src = `data:${mimeType};base64,${base64Data}`;
  });
};


interface CustomImageUploaderProps {
    files: File[];
    onFilesChange: (files: File[]) => void;
    title: string;
    placeholder: string;
    disabled?: boolean;
    generatedImageUrl?: string | null;
    onClearGeneratedImage?: () => void;
}

const CustomImageUploader: React.FC<CustomImageUploaderProps> = ({
    files, onFilesChange, title, placeholder, disabled,
    generatedImageUrl, onClearGeneratedImage
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    useEffect(() => {
        let objectUrl: string | null = null;
        if (files.length > 0) {
            objectUrl = URL.createObjectURL(files[0]);
            setPreviewUrl(objectUrl);
        } else if (generatedImageUrl) {
            setPreviewUrl(generatedImageUrl);
        } else {
            setPreviewUrl(null);
        }
        return () => {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [files, generatedImageUrl]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = event.target.files ? Array.from(event.target.files) : [];
        if (selectedFiles.length > 0) {
            onFilesChange(selectedFiles.slice(0, 1));
        }
    };

    const triggerUpload = () => {
        if (!disabled) fileInputRef.current?.click();
    };
    
    return (
        <div className="space-y-3">
            <h3 className="font-semibold text-emerald-400">{title}</h3>
            <div
                className={`group relative w-full h-48 lg:h-64 flex items-center justify-center rounded-lg border-2 border-dashed border-gray-600 bg-gray-900/50 transition-colors ${disabled ? 'cursor-not-allowed' : 'hover:border-emerald-500 cursor-pointer'}`}
                onClick={triggerUpload}
            >
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/png, image/jpeg" disabled={disabled} />
                {previewUrl ? (
                    <>
                        <img src={previewUrl} alt="Preview" className="w-full h-full object-contain rounded-md p-2" />
                         <button 
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (files.length > 0) {
                                    onFilesChange([]);
                                    if (fileInputRef.current) fileInputRef.current.value = "";
                                } else if (onClearGeneratedImage) {
                                    onClearGeneratedImage();
                                }
                            }}
                            className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80"
                            aria-label="Remove image"
                            disabled={disabled}
                            >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        </button>
                    </>
                ) : (
                    <span className="text-gray-500">{placeholder}</span>
                )}
            </div>
        </div>
    );
};

const Dropdown: React.FC<{ label: string; value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; options: { value: string; label: string }[]; disabled?: boolean; }> = ({ label, value, onChange, options, disabled }) => (
    <div>
        <label className="block text-sm font-medium text-emerald-400 mb-2">{label}</label>
        <div className="relative">
            <select
                value={value}
                onChange={onChange}
                className="w-full appearance-none bg-gray-800 border border-gray-600 text-white rounded-lg py-2.5 px-3 pr-8 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                disabled={disabled}
            >
                {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
            </div>
        </div>
    </div>
);

const backgroundOptions = [
    { value: '', label: 'Pilih Latar Belakang...' },
    { value: 'a clean white studio background', label: 'Studio Putih' },
    { value: 'a clean gray studio background', label: 'Studio Abu-abu' },
    { value: 'an outdoor city street at night', label: 'Jalanan Kota (Malam)' },
    { value: 'an outdoor city street during the day', label: 'Jalanan Kota (Siang)' },
    { value: 'a lush nature forest', label: 'Hutan / Alam Hijau' },
    { value: 'a sunny beach with ocean', label: 'Pantai Cerah' },
    { value: 'a cozy cafe interior', label: 'Interior Kafe' },
    { value: 'a luxury hotel lobby', label: 'Lobi Hotel Mewah' },
    { value: 'an abstract gradient background', label: 'Latar Belakang Gradien' },
    { value: 'custom', label: 'Custom...' },
];

const cameraAngleOptions = [
    { value: '', label: 'Pilih Angle Kamera...' },
    { value: 'Full Body Shot', label: 'Full Body Shot' },
    { value: 'Medium Shot (waist up)', label: 'Medium Shot (Pinggang ke atas)' },
    { value: 'Cowboy Shot (mid-thighs up)', label: 'Cowboy Shot (Paha ke atas)' },
    { value: 'Close-up Shot', label: 'Close-up' },
    { value: 'Low Angle Shot', label: 'Low Angle' },
    { value: 'High Angle Shot', label: 'High Angle' },
    { value: 'custom', label: 'Custom...' },
];

const poseOptions = [
    { value: '', label: 'Pilih Pose...' },
    { value: 'standing still, looking at camera', label: 'Berdiri, melihat kamera' },
    { value: 'walking towards camera', label: 'Berjalan ke arah kamera' },
    { value: 'sitting on a chair', label: 'Duduk di kursi' },
    { value: 'leaning against a wall', label: 'Bersandar di dinding' },
    { value: 'a dynamic action pose', label: 'Pose aksi dinamis' },
    { value: 'looking away from the camera', label: 'Melihat ke arah lain' },
    { value: 'with hands in pockets', label: 'Tangan di saku' },
    { value: 'custom', label: 'Custom...' },
];

interface Result {
  id: string;
  url: string; // image url
  base64: string;
  mimeType: string;
  // Video-related properties
  videoPrompt?: string;
  videoUrl?: string;
  videoStatus?: 'idle' | 'suggesting' | 'generating' | 'done' | 'error';
}

const FashionStudio: React.FC = () => {
    const { apiKey, isApiKeySet } = useApiKey();

    const [modelFile, setModelFile] = useState<File[]>([]);
    const [generatedModelImage, setGeneratedModelImage] = useState<ImageInput | null>(null);
    const [isGeneratingFace, setIsGeneratingFace] = useState(false);
    const [facePrompt, setFacePrompt] = useState('');
    const [generateFace, setGenerateFace] = useState(false);
    
    const [productFile, setProductFile] = useState<File[]>([]);
    const [imagePrompt, setImagePrompt] = useState("A photorealistic, fashion magazine style image. IMPORTANT: Use ONLY the face from the first input image (the model) as a face reference. Generate a new body and pose. The model MUST be wearing the EXACT product shown in the second input image. The product's details, color, texture, and shape must be replicated with 100% accuracy. Do not alter or change the product.");
    const [numOutputs, setNumOutputs] = useState('4');
    const [aspectRatio, setAspectRatio] = useState<ImageAspectRatio>('9:16');
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState('');
    const [results, setResults] = useState<Result[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [useManualPrompt, setUseManualPrompt] = useState(true);

    // State for dropdowns
    const [background, setBackground] = useState('');
    const [cameraAngle, setCameraAngle] = useState('');
    const [pose, setPose] = useState('');
    
    // State for custom inputs
    const [customBackground, setCustomBackground] = useState('');
    const [customCameraAngle, setCustomCameraAngle] = useState('');
    const [customPose, setCustomPose] = useState('');
    
    const handleModelFileChange = (files: File[]) => {
        if (files.length > 0) {
            setGeneratedModelImage(null); // Prioritize user upload over generated face
        }
        setModelFile(files);
    };

    const generateAndSetFace = async (): Promise<ImageInput> => {
        setStatus('Generating a model face...');
        if (!isApiKeySet) throw new Error('API Key is not set.');
        
        const userPrompt = facePrompt.trim();
        const finalFacePrompt = userPrompt 
            ? `photorealistic headshot of ${userPrompt}, fashion model, looking at the camera, neutral expression, clean studio background, 3:4 aspect ratio`
            : "photorealistic headshot of a beautiful fashion model, looking at the camera, neutral expression, clean studio background, 3:4 aspect ratio";
        
        const generatedFace = await generateImage(apiKey, finalFacePrompt, '3:4');
        
        setGeneratedModelImage(generatedFace);
        return generatedFace;
    };

    const handleGenerateFace = async () => {
        setIsGeneratingFace(true);
        setError(null);
        try {
            await generateAndSetFace();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred.');
        } finally {
            setIsGeneratingFace(false);
        }
    };


    const handleGenerate = async () => {
        if (!isApiKeySet) { setError('API Key is not set.'); return; }
        if (productFile.length === 0) { setError('Please upload a product image.'); return; }

        setIsLoading(true);
        setError(null);
        setResults([]);
        
        try {
            let modelImageInput: ImageInput;
            setStatus('Preparing model...');
            if (modelFile.length > 0) {
                modelImageInput = await fileToImageInput(modelFile[0]);
            } else if (generatedModelImage) {
                modelImageInput = generatedModelImage;
            } else {
                if(generateFace) {
                    modelImageInput = await generateAndSetFace();
                } else {
                    throw new Error('Please upload or generate a model face.');
                }
            }

            setStatus('Converting product image...');
            const productImageInput = await fileToImageInput(productFile[0]);

            const ai = new GoogleGenAI({ apiKey });

            const count = parseInt(numOutputs, 10) || 1;
            setStatus(`Generating ${count} image(s)...`);

            let finalImagePrompt = '';
            if (useManualPrompt) {
                if (!imagePrompt.trim()) {
                    throw new Error("Prompt manual tidak boleh kosong.");
                }
                finalImagePrompt = `${imagePrompt}. The final image must have a ${aspectRatio} aspect ratio.`;
            } else {
                const bgValue = background === 'custom' ? customBackground.trim() : background;
                const angleValue = cameraAngle === 'custom' ? customCameraAngle.trim() : cameraAngle;
                const poseValue = pose === 'custom' ? customPose.trim() : pose;

                if (!bgValue) throw new Error('Latar belakang harus diisi atau dipilih.');
                if (!angleValue) throw new Error('Angle kamera harus diisi atau dipilih.');
                if (!poseValue) throw new Error('Pose harus diisi atau dipilih.');

                finalImagePrompt = `A ${angleValue} of a fashion model. IMPORTANT: Use ONLY the face from the first input image (the model) as a face reference. The pose is ${poseValue}. The model MUST be wearing the EXACT product shown in the second input image. The product's details, color, texture, and shape must be replicated with 100% accuracy. Do not alter or change the product. The background is ${bgValue}. The style should be photorealistic, like a fashion magazine. The final image must have a ${aspectRatio} aspect ratio.`;
            }

            const imagePromises = Array(count).fill(0).map(() => {
                return ai.models.generateContent({
                    model: 'gemini-2.5-flash-image',
                    contents: {
                        parts: [
                            { inlineData: { data: modelImageInput.data, mimeType: modelImageInput.mimeType } },
                            { inlineData: { data: productImageInput.data, mimeType: productImageInput.mimeType } },
                            { text: finalImagePrompt }
                        ]
                    },
                    config: {
                        responseModalities: [Modality.IMAGE, Modality.TEXT],
                    },
                });
            });
            
            const responses = await Promise.all(imagePromises);

            const newResults: Result[] = responses.map((response, index) => {
                const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
                if (!imagePart?.inlineData) {
                    let reason = `Failed to generate image #${index + 1}.`;
                    if (response.promptFeedback?.blockReason) {
                        reason += ` Blocked due to safety policy: ${response.promptFeedback.blockReason}.`;
                    }
                    throw new Error(reason);
                }
                const generatedImage: ImageInput = {
                    data: imagePart.inlineData.data,
                    mimeType: imagePart.inlineData.mimeType,
                };
                return {
                    id: generateRandomString(8),
                    url: `data:${generatedImage.mimeType};base64,${generatedImage.data}`,
                    base64: generatedImage.data,
                    mimeType: generatedImage.mimeType,
                    videoStatus: 'idle',
                };
            });

            setResults(newResults);

        } catch (err) {
            const message = err instanceof Error ? err.message : 'An unknown error occurred.';
            setError(message);
        } finally {
            setIsLoading(false);
            setStatus('');
        }
    };

    const handleSuggestVideoPrompt = async (resultId: string) => {
        const resultIndex = results.findIndex(r => r.id === resultId);
        if (resultIndex === -1) return;

        // Show input field immediately and set status to suggesting
        setResults(prev => prev.map(r => r.id === resultId ? { ...r, videoStatus: 'suggesting', videoPrompt: r.videoPrompt ?? '' } : r));
        setError(null);

        try {
            if (!isApiKeySet) throw new Error('API Key not set.');
            const result = results[resultIndex];
            const suggestion = await suggestVideoPrompt(apiKey, { data: result.base64, mimeType: result.mimeType });
            
            setResults(prev => prev.map(r => r.id === resultId ? { ...r, videoPrompt: suggestion, videoStatus: 'idle' } : r));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to suggest prompt.');
            setResults(prev => prev.map(r => r.id === resultId ? { ...r, videoStatus: 'error' } : r));
        }
    };
    
    const handleUpdateVideoPrompt = (resultId: string, prompt: string) => {
        setResults(prev => prev.map(r => r.id === resultId ? { ...r, videoPrompt: prompt } : r));
    };

    const handleGenerateVideo = async (resultId: string) => {
        const result = results.find(r => r.id === resultId);
        if (!result || !result.videoPrompt) return;

        setResults(prev => prev.map(r => r.id === resultId ? { ...r, videoStatus: 'generating' } : r));
        setError(null);

        try {
            if (!isApiKeySet) throw new Error('API Key not set.');

            const generatedUrl = await generateVideo(
                apiKey,
                { 
                    prompt: result.videoPrompt, 
                    imageBase64: result.base64, 
                    imageMimeType: result.mimeType, 
                    model: 'veo-2.0-generate-001' as VeoModel
                },
                aspectRatio,
                false, // enableSound
                '720p', // resolution
                'none', // characterVoice
                'Cinematic' // visualStyle
            );

            setResults(prev => prev.map(r => r.id === resultId ? { ...r, videoUrl: generatedUrl, videoStatus: 'done' } : r));

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to generate video.');
            setResults(prev => prev.map(r => r.id === resultId ? { ...r, videoStatus: 'error' } : r));
        }
    };


    const handleDownload = async (result: Result, index: number) => {
        // If it's a video
        if (result.videoUrl) {
            const link = document.createElement('a');
            link.href = result.videoUrl;
            link.download = `fashion-studio-video-${index + 1}.mp4`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            return;
        }
        
        // If it's an image (existing logic)
        try {
            setStatus(`Processing image ${index + 1} for download...`);
            const croppedDataUrl = await cropImageToAspectRatio(result.base64, result.mimeType, aspectRatio);
            
            const link = document.createElement('a');
            link.href = croppedDataUrl;
            link.download = `fashion-studio-image-${index + 1}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setStatus('');
        } catch (e) {
            console.error("Failed to crop and download image:", e);
            setError("Failed to process image for download. Please try again.");
            setStatus('');
        }
    };
    
    return (
        <div className="p-4 sm:p-6 lg:p-8 h-full overflow-y-auto bg-gray-900 text-gray-300">
            <div className="max-w-4xl mx-auto">
                <form onSubmit={(e) => { e.preventDefault(); handleGenerate(); }} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                          <CustomImageUploader 
                              files={modelFile}
                              onFilesChange={handleModelFileChange}
                              title="Model/Manusia"
                              placeholder="Tempel atau Buat Model"
                              disabled={isLoading}
                              generatedImageUrl={generatedModelImage ? `data:${generatedModelImage.mimeType};base64,${generatedModelImage.data}` : null}
                              onClearGeneratedImage={() => setGeneratedModelImage(null)}
                          />
                          <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <input
                                        id="generate-face-toggle"
                                        type="checkbox"
                                        checked={generateFace}
                                        onChange={(e) => setGenerateFace(e.target.checked)}
                                        disabled={isLoading || modelFile.length > 0 || !!generatedModelImage}
                                        className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-gray-900"
                                    />
                                    <label htmlFor="generate-face-toggle" className="text-sm font-medium text-gray-300">
                                        Buat Wajah
                                    </label>
                                </div>

                                {generateFace && (
                                    <div className="space-y-2 animate-fade-in-fast">
                                        <label htmlFor="face-prompt-uploader" className="block text-sm font-medium text-gray-400">
                                            Referensi Wajah (Opsional)
                                        </label>
                                        <textarea
                                            id="face-prompt-uploader"
                                            value={facePrompt}
                                            onChange={(e) => setFacePrompt(e.target.value)}
                                            rows={2}
                                            className="w-full bg-gray-900 border border-gray-600 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                            placeholder="cth: seorang pria Asia dengan rambut pendek, wanita Kaukasia dengan rambut pirang"
                                            disabled={isLoading || isGeneratingFace}
                                        />
                                        <p className="text-xs text-gray-500">
                                            AI dapat membuat wajah pria atau wanita. Biarkan kosong untuk hasil acak, atau berikan deskripsi untuk wajah yang lebih spesifik.
                                        </p>
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            onClick={handleGenerateFace}
                                            className="w-full"
                                            disabled={isLoading || isGeneratingFace}
                                        >
                                            {isGeneratingFace ? <Spinner /> : <><i className="fa-solid fa-wand-magic-sparkles mr-2"></i>Buat Wajah</>}
                                        </Button>
                                    </div>
                                )}
                            </div>
                      </div>
                      <CustomImageUploader 
                          files={productFile}
                          onFilesChange={setProductFile}
                          title="Produk"
                          placeholder="Tempel Produk"
                          disabled={isLoading}
                      />
                  </div>

                  <div className="space-y-3">
                      <div className="flex items-center gap-3">
                          <input
                              id="manual-prompt-toggle"
                              type="checkbox"
                              checked={useManualPrompt}
                              onChange={(e) => setUseManualPrompt(e.target.checked)}
                              disabled={isLoading}
                              className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-gray-900"
                          />
                          <label htmlFor="manual-prompt-toggle" className="text-sm font-medium text-gray-300">
                              Tulis Manual Prompt
                          </label>
                      </div>
                      {useManualPrompt ? (
                          <textarea
                              value={imagePrompt}
                              onChange={(e) => setImagePrompt(e.target.value)}
                              rows={4}
                              className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition disabled:opacity-50"
                              disabled={isLoading}
                          />
                      ) : (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                            <div>
                                  <Dropdown
                                      label="Latar Belakang"
                                      value={background}
                                      onChange={(e) => setBackground(e.target.value)}
                                      options={backgroundOptions}
                                      disabled={isLoading}
                                />
                                {background === 'custom' && (
                                    <div className="mt-2">
                                        <input
                                            type="text"
                                            value={customBackground}
                                            onChange={(e) => setCustomBackground(e.target.value)}
                                            placeholder="Tulis latar belakang custom..."
                                            className="w-full bg-gray-900 border border-gray-600 text-white rounded-lg py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                            disabled={isLoading}
                                        />
                                    </div>
                                )}
                            </div>
                            <div>
                                <Dropdown
                                      label="Angle Kamera"
                                      value={cameraAngle}
                                      onChange={(e) => setCameraAngle(e.target.value)}
                                      options={cameraAngleOptions}
                                      disabled={isLoading}
                                />
                                {cameraAngle === 'custom' && (
                                    <div className="mt-2">
                                        <input
                                            type="text"
                                            value={customCameraAngle}
                                            onChange={(e) => setCustomCameraAngle(e.target.value)}
                                            placeholder="Tulis angle kamera custom..."
                                            className="w-full bg-gray-900 border border-gray-600 text-white rounded-lg py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                            disabled={isLoading}
                                        />
                                    </div>
                                )}
                            </div>
                            <div>
                                  <Dropdown
                                      label="Pose"
                                      value={pose}
                                      onChange={(e) => setPose(e.target.value)}
                                      options={poseOptions}
                                      disabled={isLoading}
                                />
                                {pose === 'custom' && (
                                    <div className="mt-2">
                                        <input
                                            type="text"
                                            value={customPose}
                                            onChange={(e) => setCustomPose(e.target.value)}
                                            placeholder="Tulis pose custom..."
                                            className="w-full bg-gray-900 border border-gray-600 text-white rounded-lg py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                            disabled={isLoading}
                                        />
                                    </div>
                                )}
                            </div>
                          </div>
                      )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div>
                          <label className="block text-sm font-medium text-emerald-400 mb-2">Jumlah Output</label>
                          <input
                              type="number"
                              value={numOutputs}
                              onChange={(e) => setNumOutputs(e.target.value)}
                              min="1"
                              max="4"
                              className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                              disabled={isLoading}
                          />
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-emerald-400 mb-2">Aspek Rasio</label>
                          <div className="relative">
                              <select
                                  value={aspectRatio}
                                  onChange={(e) => setAspectRatio(e.target.value as ImageAspectRatio)}
                                  className="w-full appearance-none bg-gray-800 border border-gray-600 text-white rounded-lg py-2.5 px-3 pr-8 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                                  disabled={isLoading}
                              >
                                  <option value="9:16">9:16 (Vertikal)</option>
                                  <option value="16:9">16:9 (Widescreen)</option>
                                  <option value="1:1">1:1 (Square)</option>
                                  <option value="4:3">4:3 (Standard)</option>
                                  <option value="3:4">3:4 (Portrait)</option>
                              </select>
                              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                                <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                              </div>
                          </div>
                      </div>
                  </div>

                  <div>
                      <Button type="submit" disabled={isLoading || !isApiKeySet} className="w-full text-lg !py-3 rounded-xl !bg-emerald-500 hover:!bg-emerald-600" title={!isApiKeySet ? 'API Key is not set' : ''}>
                          {isLoading ? <><Spinner /> {status || 'Generating...'}</> : 'Generate'}
                      </Button>
                  </div>
                </form>
                
                {error && (
                  <div className="text-center text-red-400 bg-red-900/30 p-4 rounded-lg mt-8 border border-red-800">
                      <p className="font-bold">An Error Occurred</p>
                      <p className="text-sm">{error}</p>
                  </div>
                )}
                
                {results.length > 0 && (
                    <div className="mt-12">
                        <h2 className="text-2xl font-bold text-white mb-4 text-center">Results</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {results.map((result, index) => (
                                <div key={result.id} className="group bg-gray-800 rounded-lg overflow-hidden border border-gray-700 relative" style={{ aspectRatio: aspectRatio.replace(':', ' / ') }}>
                                    {result.videoStatus === 'generating' && (
                                        <div className="absolute inset-0 z-20 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center gap-2 text-white">
                                            <Spinner className="w-8 h-8" />
                                            <p className="text-sm font-medium animate-pulse">Generating video...</p>
                                        </div>
                                    )}

                                    {result.videoUrl ? (
                                        <video src={result.videoUrl} autoPlay loop muted className="w-full h-full object-cover" />
                                    ) : (
                                        <img src={result.url} alt={`Generated image ${index + 1}`} className="w-full h-full object-cover" />
                                    )}

                                    <div className="absolute inset-0 z-10 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-4">
                                         <div className="absolute top-2 right-2 flex items-center gap-2">
                                            <Button variant="secondary" size="sm" className="!p-2 h-8 w-8" title="Generate Video" onClick={() => handleGenerateVideo(result.id)} disabled={!result.videoPrompt || result.videoStatus === 'generating' || result.videoStatus === 'suggesting'}>
                                                <VideoIcon className="w-4 h-4" />
                                            </Button>
                                            <Button variant="secondary" size="sm" className="!p-2 h-8 w-8" title="Suggest Video Prompt" onClick={() => handleSuggestVideoPrompt(result.id)} disabled={result.videoStatus === 'generating' || result.videoStatus === 'suggesting'}>
                                                {result.videoStatus === 'suggesting' ? <Spinner className="w-4 h-4" /> : <LightbulbIcon className="w-4 h-4" />}
                                            </Button>
                                            <Button variant="secondary" size="sm" className="!p-2 h-8 w-8" title="Download" onClick={() => handleDownload(result, index)}>
                                                <DownloadIcon className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                     {typeof result.videoPrompt !== 'undefined' && (
                                        <div className="absolute bottom-0 left-0 right-0 p-2 z-10 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <input 
                                                type="text"
                                                value={result.videoPrompt}
                                                onChange={(e) => handleUpdateVideoPrompt(result.id, e.target.value)}
                                                onClick={e => e.stopPropagation()} // Prevent card click
                                                placeholder="Enter video prompt..."
                                                className="w-full bg-gray-900 border border-gray-600 text-white text-xs rounded py-1 px-2 focus:ring-emerald-500 focus:border-emerald-500"
                                            />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .animate-fade-in-fast {
                    animation: fadeIn 0.2s ease-in-out;
                }
            `}</style>
        </div>
    );
};

export default FashionStudio;