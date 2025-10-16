import React, { useState, useCallback } from 'react';
import { ImageUploader } from './ImageUploader';
import { Spinner } from './Spinner';
import { DownloadIcon, MagnifyingGlassIcon, SparklesIcon } from './icons';
import { ImagePreviewModal } from './ImagePreviewModal';
import { changeImageAspectRatio } from '../services/geminiService';
import { createAspectRatioCanvas } from '../utils/aspectRatioCanvases';
import type { ImageInput } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useApiKey } from '../contexts/ApiKeyContext';
import Button from './Button';

const ASPECT_RATIO_OPTIONS = [
  { value: '9:16', label: '9:16 (Vertical)' },
  { value: '16:9', label: '16:9 (Widescreen)' },
  { value: '4:3', label: '4:3 (Standard)' },
  { value: '3:4', label: '3:4 (Portrait)' },
  { value: '1:1', label: '1:1 (Square)' },
];

const fileToBase64 = (file: File): Promise<ImageInput> => {
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


export const AspectRatioSettings: React.FC = () => {
  const { t } = useLanguage();
  const { apiKey, isApiKeySet } = useApiKey();
  const [mainImage, setMainImage] = useState<{ file: File; base64: string; mimeType: string; } | null>(null);
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<string>('9:16');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);

  const handleFilesChange = useCallback(async (
    files: File[]
  ) => {
    const file = files[0] || null;
    if (file) {
      const { data, mimeType } = await fileToBase64(file);
      setMainImage({ file, base64: data, mimeType });
    } else {
      setMainImage(null);
    }
  }, []);

  const handleGenerate = async () => {
    if (!isApiKeySet) {
      setError(t('apiKeyMissingError'));
      return;
    }
    if (!mainImage) {
      setError(t('errorAspectRatioImage'));
      return;
    }
    setIsLoading(true);
    setGeneratedImage(null);
    setError(null);

    try {
      const aspectReferenceImage = createAspectRatioCanvas(selectedAspectRatio);

      const result = await changeImageAspectRatio(apiKey, {
        mainImage: { data: mainImage.base64, mimeType: mainImage.mimeType },
        aspectReferenceImage,
      });
      setGeneratedImage(`data:${result.mimeType};base64,${result.data}`);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : t('errorUnknown'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = useCallback(() => {
    if (!generatedImage) return;
    const link = document.createElement('a');
    link.href = generatedImage;
    link.download = `ai-image-${selectedAspectRatio.replace(':', 'x')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [generatedImage, selectedAspectRatio]);
  
  return (
    <div className="flex flex-col lg:flex-row bg-gray-900 font-sans h-full overflow-y-auto">
      {/* Control Panel */}
      <aside className="w-full lg:w-[450px] lg:min-w-[450px] bg-gray-800/50 backdrop-blur-sm lg:h-full lg:overflow-y-auto p-6 lg:p-8 space-y-8 border-r border-gray-700/50">
        <header>
          <h1 className="text-2xl font-bold text-white">{t('aspectRatioTitle')}</h1>
          <p className="text-sm text-gray-400">{t('aspectRatioSubtitle')}</p>
        </header>

        <div className="space-y-6">
          <ImageUploader
            label={t('yourImageLabel')}
            files={mainImage ? [mainImage.file] : []}
            onFilesChange={handleFilesChange}
            maxFiles={1}
          />
        </div>

        <div className="space-y-6 pt-4 border-t border-gray-700/50">
            <div>
              <label htmlFor="aspect-ratio" className="block text-sm font-medium text-gray-300 mb-2">
                {t('targetAspectRatioLabel')}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {ASPECT_RATIO_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setSelectedAspectRatio(option.value)}
                    className={`px-3 py-2 text-sm font-semibold rounded-md transition-colors duration-200 ${
                      selectedAspectRatio === option.value
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
          </div>
        </div>

        <div className="pt-4">
          <Button
            onClick={handleGenerate}
            disabled={!isApiKeySet || !mainImage || isLoading}
            className="w-full"
            title={!isApiKeySet ? t('apiKeyMissingError') : ''}
          >
            {isLoading ? <><Spinner /> {t('generating')}...</> : <><SparklesIcon className="w-5 h-5" /> {t('changeAspectRatioButton')}</>}
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 lg:p-12">
        <div className="w-full h-full max-w-5xl max-h-[85vh] bg-gray-800/30 rounded-2xl border-2 border-dashed border-gray-700 flex items-center justify-center relative overflow-hidden group">
          {isLoading ? (
            <div className="z-10 absolute inset-0 bg-black/50 backdrop-blur-md flex flex-col items-center justify-center gap-4 text-white">
              <Spinner className="w-12 h-12" />
              <p className="text-lg font-medium">{t('expandingImage')}</p>
              <p className="text-sm text-gray-400">{t('takeAMoment')}</p>
            </div>
          ) : error ? (
            <div className="text-center text-red-400 p-8">
              <h3 className="text-xl font-semibold mb-2">{t('generationFailed')}</h3>
              <p>{error}</p>
            </div>
          ) : generatedImage ? (
            <>
              <img
                src={generatedImage}
                alt={t('generatedImageAlt')}
                className="w-full h-full object-contain"
              />
               <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <button
                      onClick={() => setIsPreviewOpen(true)}
                      className="bg-green-500 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 hover:bg-green-600 transition-all duration-300"
                  >
                      <MagnifyingGlassIcon className="w-5 h-5" />
                      {t('preview')}
                  </button>
              </div>
              <button
                onClick={handleDownload}
                className="absolute bottom-6 right-6 bg-green-500 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 hover:bg-green-600 transition-all duration-300"
              >
                <DownloadIcon className="w-5 h-5" />
                {t('download')}
              </button>
            </>
          ) : (
            <div className="text-center text-gray-500 p-8">
              <SparklesIcon className="w-16 h-16 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-300">{t('expandCanvasTitle')}</h2>
              <p className="mt-2">{t('expandCanvasSubtitle')}</p>
            </div>
          )}
        </div>
      </main>

      <ImagePreviewModal 
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        imageUrl={generatedImage}
      />
    </div>
  );
};
