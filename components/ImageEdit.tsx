import React, { useState, useCallback, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useApiKey } from '../contexts/ApiKeyContext';
import { useAuth } from '../contexts/AuthContext';
import { editImage, generateImage } from '../services/geminiService';
import type { ImageInput, ImageModel, ImageAspectRatio } from '../types';
import { ImageUploader } from './ImageUploader';
import SelectInput from './SelectInput';
import TextAreaInput from './TextAreaInput';
import Button from './Button';
import { Spinner } from './Spinner';
import { DownloadIcon, MagnifyingGlassIcon } from './icons';
import { ImagePreviewModal } from './ImagePreviewModal';
import { supabase } from '../lib/supabaseClient';

const fileToImageInput = (file: File): Promise<ImageInput> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const [mimePart, dataPart] = result.split(';base64,');
      const mimeType = mimePart.split(':')[1];
      resolve({ data: dataPart, mimeType });
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

export const ImageEdit: React.FC = () => {
  const { t } = useLanguage();
  const { apiKey, isApiKeySet } = useApiKey();
  const { user } = useAuth();

  // FIX: Updated initial state to use the correct model name.
  const [imageModel, setImageModel] = useState<ImageModel>('gemini-2.5-flash-image');
  const [aspectRatio, setAspectRatio] = useState<ImageAspectRatio>('9:16');
  const [imageFile, setImageFile] = useState<File[]>([]);
  const [prompt, setPrompt] = useState('');
  const [originalImage, setOriginalImage] = useState<ImageInput | null>(null);
  const [editedImage, setEditedImage] = useState<ImageInput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);

  const isEditingMode = imageModel === 'gemini-2.5-flash-image';

  useEffect(() => {
    // Clear images if switching to generation mode with an image already uploaded
    if (!isEditingMode) {
      setImageFile([]);
      setOriginalImage(null);
    }
  }, [imageModel, isEditingMode]);

  const handleFilesChange = useCallback(async (files: File[]) => {
    setImageFile(files);
    if (files.length > 0) {
      const imgInput = await fileToImageInput(files[0]);
      setOriginalImage(imgInput);
      setEditedImage(null); // Clear previous edit
      setError(null);
    } else {
      setOriginalImage(null);
    }
  }, []);

  const handleClear = useCallback(() => {
    // FIX: Updated reset state to use the correct model name.
    setImageModel('gemini-2.5-flash-image');
    setAspectRatio('9:16');
    setImageFile([]);
    setPrompt('');
    setOriginalImage(null);
    setEditedImage(null);
    setError(null);
    setIsLoading(false);
  }, []);

  const handleDownload = useCallback(() => {
    if (!editedImage) return;
    const link = document.createElement('a');
    link.href = `data:${editedImage.mimeType};base64,${editedImage.data}`;
    link.download = `frame-lab-edited-image.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [editedImage]);

  const saveToCreativeHub = async (image: ImageInput, usedPrompt: string) => {
    if (!user) return;
    try {
        const response = await fetch(`data:${image.mimeType};base64,${image.data}`);
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
                prompt: usedPrompt,
                image_path: filePath,
            });

        if (dbError) throw dbError;

    } catch (err) {
        console.error("Error saving to Creative Hub:", err);
        // Optionally, inform the user that saving failed but the image was generated.
        setError("Image generated, but failed to save to Creative Hub.");
    }
};

  const handleSubmit = async () => {
    if (!isApiKeySet || !prompt.trim() || (isEditingMode && !originalImage)) {
        setError(t('apiKeyMissingError')); // Or a more specific error
      return;
    }
    setIsLoading(true);
    setError(null);
    setEditedImage(null);

    try {
      let result;
      if (isEditingMode && originalImage) {
        result = await editImage(apiKey, originalImage, prompt);
      } else {
        result = await generateImage(apiKey, prompt, aspectRatio);
        setOriginalImage(null); // No original image in generation mode
      }
      setEditedImage(result);
      await saveToCreativeHub(result, prompt);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };


  const ResultPanel = ({ title, image, placeholderText, isLoading = false, showActions = false, onPreview, onDownload }: { title: string, image: ImageInput | null, placeholderText: string, isLoading?: boolean, showActions?: boolean, onPreview?: () => void, onDownload?: () => void }) => (
    <div className="bg-gray-800/50 rounded-lg p-3 flex flex-col h-full">
        <h2 className="text-center font-semibold text-gray-400 text-sm mb-2">{title}</h2>
        <div className="flex-grow bg-black rounded-md flex items-center justify-center relative aspect-square group">
            {isLoading ? (
                 <div className="flex flex-col items-center justify-center text-gray-400">
                    <Spinner className="h-8 w-8"/>
                    <p className="mt-2 text-sm">{t('generatingSceneShort')}</p>
                </div>
            ) : image ? (
                <>
                    <img 
                        src={`data:${image.mimeType};base64,${image.data}`} 
                        alt={title}
                        className="max-w-full max-h-full object-contain"
                    />
                    {showActions && (
                       <>
                         <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-md">
                            <button
                                onClick={onPreview}
                                className="bg-green-500 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 hover:bg-green-600 transition-all duration-300"
                            >
                                <MagnifyingGlassIcon className="w-5 h-5" />
                                {t('preview')}
                            </button>
                        </div>
                        <button
                            onClick={onDownload}
                            className="absolute bottom-3 right-3 bg-green-500 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 hover:bg-green-600 transition-all duration-300"
                        >
                            <DownloadIcon className="w-5 h-5" />
                            {t('download')}
                        </button>
                      </>
                    )}
                </>
            ) : (
                <div className="text-center text-gray-600 p-4">
                     <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M19 14.5v5.25c0 .621-.504 1.125-1.125 1.125H6.125c-.621 0-1.125-.504-1.125-1.125V14.5m14-11.396c.251.023.501.05.75.082M4.5 5.438a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L14.25 14.5" /></svg>
                    <p className="text-sm">{placeholderText}</p>
                </div>
            )}
        </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 h-full">
      {/* Controls Panel */}
      <aside className="lg:col-span-4 bg-gray-900 p-4 border-r border-gray-800 overflow-y-auto h-full">
        <div className="space-y-6 flex flex-col h-full">
            <h2 className="text-lg font-bold">{t('imageEditSettingsTitle')}</h2>
            <fieldset className="space-y-6 flex-grow">
                <SelectInput<ImageModel>
                    label={t('imageModelLabel')}
                    value={imageModel}
                    onChange={setImageModel}
                    options={[
                        // FIX: Updated select option to use the correct model name and label.
                        { value: 'gemini-2.5-flash-image', label: 'gemini-2.5-flash-image (Edit)' },
                        { value: 'imagen-4.0-generate-001', label: 'imagen-4.0-generate-001 (Generate)' },
                    ]}
                />
                
                { !isEditingMode && (
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">{t('aspectRatioLabel')}</label>
                        <div className="flex items-center gap-6">
                            {(['9:16', '16:9', '1:1'] as ImageAspectRatio[]).map(ratio => (
                                <div key={ratio} className="flex items-center">
                                    <input
                                        id={`ratio-${ratio}`}
                                        name="aspect-ratio"
                                        type="radio"
                                        checked={aspectRatio === ratio}
                                        onChange={() => setAspectRatio(ratio)}
                                        className="h-4 w-4 text-green-600 bg-gray-700 border-gray-600 focus:ring-green-500 focus:ring-offset-gray-900"
                                    />
                                    <label htmlFor={`ratio-${ratio}`} className="ml-2 block text-sm font-medium text-gray-300">
                                        {ratio}
                                    </label>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className={`${!isEditingMode ? 'opacity-50' : ''}`}>
                    <ImageUploader 
                        files={imageFile} 
                        onFilesChange={handleFilesChange} 
                        label={isEditingMode ? t('uploadReferenceImageLabel') : ''}
                        disabled={!isEditingMode}
                    />
                    {!isEditingMode && <p className="text-xs text-gray-500 mt-1">{t('generationModelNotice')}</p>}
                </div>

                <TextAreaInput 
                    label={t('editInstructionLabel')}
                    value={prompt}
                    onChange={setPrompt}
                    placeholder={t('editInstructionPlaceholder')}
                    rows={4}
                />
            </fieldset>

            {error && (
                <div className="text-center text-red-400 bg-red-900/30 p-2 rounded-lg text-sm">
                    <p>{error}</p>
                </div>
            )}
            
            <div className="pt-4 border-t border-gray-800 grid grid-cols-2 gap-3">
                <Button 
                    type="button" 
                    onClick={handleSubmit}
                    disabled={!isApiKeySet || !prompt.trim() || (isEditingMode && !originalImage) || isLoading}
                    title={!isApiKeySet ? t('apiKeyMissingError') : ''}
                >
                    {isLoading ? <Spinner /> : null}
                    {isEditingMode ? t('createEditButton') : t('createImageButton')}
                </Button>
                <Button variant="secondary" onClick={handleClear}>
                    {t('clearButton')}
                </Button>
            </div>
        </div>
      </aside>

      {/* Content Area */}
      <main className="lg:col-span-8 bg-black p-4 md:p-8 overflow-y-auto h-full">
        <div className={`grid grid-cols-1 ${isEditingMode ? 'md:grid-cols-2' : ''} gap-6 h-full`}>
            {isEditingMode && (
              <ResultPanel 
                  title={t('originalTitle')}
                  image={originalImage}
                  placeholderText={t('uploadToStart')}
              />
            )}
             <div className={`${!isEditingMode ? 'md:col-span-2' : ''}`}>
                <ResultPanel 
                    title={isEditingMode ? t('editedTitle') : t('generatedTitle')}
                    image={editedImage}
                    placeholderText={isEditingMode ? t('editedImagePlaceholder') : t('generatedImagePlaceholder')}
                    isLoading={isLoading}
                    showActions={!!editedImage && !isLoading}
                    onPreview={() => setIsPreviewOpen(true)}
                    onDownload={handleDownload}
                />
             </div>
        </div>
      </main>

      <ImagePreviewModal 
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        imageUrl={editedImage ? `data:${editedImage.mimeType};base64,${editedImage.data}` : null}
      />
    </div>
  );
};
