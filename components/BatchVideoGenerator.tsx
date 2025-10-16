import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { VeoModel, AspectRatio } from '../types';
import SelectInput from './SelectInput';
import RadioButtonGroup from './RadioButtonGroup';
import TextAreaInput from './TextAreaInput';
import { ImageUploader } from './ImageUploader';
import Button from './Button';
import TextInput from './TextInput';
import { useApiKey } from '../contexts/ApiKeyContext';
import { useLanguage } from '../contexts/LanguageContext';
import { generateVideo } from '../services/geminiService';
import { Spinner } from './Spinner';
import VideoPlayer from './VideoPlayer';
import { DownloadIcon, MagnifyingGlassIcon } from './icons';
import JSZip from 'jszip';
import { triggerDownload } from '../utils/helpers';
import { VideoPreviewModal } from './VideoPreviewModal';

interface Episode {
  id: number;
  prompt: string;
  imageFile: File[];
}

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });

type OutputStatus = 'pending' | 'generating' | 'done';
interface Output {
  episodeId: number;
  status: OutputStatus;
  url?: string;
}

const BatchVideoGenerator: React.FC = () => {
  const { t } = useLanguage();
  const { apiKey, isApiKeySet } = useApiKey();
  
  const [episodes, setEpisodes] = useState<Episode[]>([{ id: Date.now(), prompt: '', imageFile: [] }]);
  const [veoModel, setVeoModel] = useState<VeoModel>('veo-3.0-fast-generate-preview');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16');
  const [delay, setDelay] = useState('10');
  const [retries, setRetries] = useState('2');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isStopping, setIsStopping] = useState<boolean>(false);
  const stopRequested = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [outputs, setOutputs] = useState<Output[]>([]);
  const [previewModalUrl, setPreviewModalUrl] = useState<string | null>(null);
  const [isProcessingZip, setIsProcessingZip] = useState(false);

  const isVeo3 = useMemo(() => veoModel.startsWith('veo-3.0'), [veoModel]);

  useEffect(() => {
    if (isVeo3) {
      setAspectRatio('16:9');
    }
  }, [isVeo3]);

  const addEpisode = useCallback(() => {
    setEpisodes(prevEpisodes => [...prevEpisodes, { id: Date.now(), prompt: '', imageFile: [] }]);
  }, []);

  const removeEpisode = useCallback((id: number) => {
    setEpisodes(prevEpisodes => prevEpisodes.filter(episode => episode.id !== id));
  }, []);

  const handleEpisodeChange = useCallback((id: number, field: 'prompt' | 'imageFile', value: string | File[]) => {
    setEpisodes(prevEpisodes => prevEpisodes.map(episode =>
      episode.id === id ? { ...episode, [field]: value } : episode
    ));
  }, []);
  
  const handleStop = useCallback(() => {
    stopRequested.current = true;
    setIsStopping(true);
  }, []);

  const clearProject = useCallback(() => {
    setEpisodes([{ id: Date.now(), prompt: '', imageFile: [] }]);
    setError(null);
    setOutputs([]);
    setIsLoading(false);
    setIsStopping(false);
    stopRequested.current = false;
  }, []);

  const handleDownload = (url: string, episodeIndex: number) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `ct-batch-episode-${episodeIndex + 1}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadZip = async () => {
    const videosToZip = outputs.filter(o => o.url);
    if (videosToZip.length === 0) return;

    setIsProcessingZip(true);
    try {
        const zip = new JSZip();
        const promptsContent = episodes.map((episode, index) => `Episode ${index + 1}:\n${episode.prompt}`).join('\n\n');
        zip.file('prompts.txt', promptsContent);

        for (let i = 0; i < videosToZip.length; i++) {
            const output = videosToZip[i];
            const response = await fetch(output.url!);
            const blob = await response.blob();
            zip.file(`episode_${i + 1}.mp4`, blob);
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        triggerDownload(URL.createObjectURL(zipBlob), `BatchProject_${Date.now()}.zip`);
    } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create ZIP file.');
    } finally {
        setIsProcessingZip(false);
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isApiKeySet) {
        setError(t('apiKeyMissingError'));
        return;
    }
    
    if (episodes.some(j => !j.prompt.trim())) {
        setError(t('promptRequiredForEpisodeError'));
        return;
    }

    setIsLoading(true);
    setIsStopping(false);
    stopRequested.current = false;
    setError(null);
    setOutputs(episodes.map(episode => ({ episodeId: episode.id, status: 'pending' })));

    try {
        for (let i = 0; i < episodes.length; i++) {
            if (stopRequested.current) {
                break;
            }

            const episode = episodes[i];
            
            setOutputs(prev => prev.map(o => o.episodeId === episode.id ? { ...o, status: 'generating' } : o));
            
            let imageBase64: string | null = null;
            let imageMimeType: string | null = null;

            if (episode.imageFile.length > 0) {
                const imageFile = episode.imageFile[0];
                imageBase64 = await fileToBase64(imageFile);
                imageMimeType = imageFile.type;
            }

            const generatedUrl = await generateVideo(
              apiKey,
              { prompt: episode.prompt, imageBase64, imageMimeType, model: veoModel },
              aspectRatio,
              true, // enableSound
              '1080p', // resolution
              'none', // characterVoice
              'Cinematic' // visualStyle
            );
            
            setOutputs(prev => prev.map(o => o.episodeId === episode.id ? { ...o, status: 'done', url: generatedUrl } : o));

            if (i < episodes.length - 1) {
                const delaySeconds = parseInt(delay, 10);
                if (delaySeconds > 0) {
                    await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
                }
            }
        }

        if (stopRequested.current) {
            setError(t('generationStoppedByUser'));
        }

    } catch (err) {
      if (!stopRequested.current) {
        const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred.';
        setError(`${t('generationFailedError')} ${errorMessage}`);
        setOutputs(prev => prev.map(o => ({ ...o, status: o.status === 'generating' ? 'pending' : o.status })));
      }
    } finally {
      setIsLoading(false);
      setIsStopping(false);
    }
  };

  const aspectRatioStyle: React.CSSProperties = {
    aspectRatio: aspectRatio.replace(':', ' / '),
  };

  // FIX: Explicitly typed the aspectRatioOptions array to match the expected SelectOption<AspectRatio>[] type.
  const aspectRatioOptions: { value: AspectRatio; label: string }[] = isVeo3
    ? [{ value: '16:9', label: '16:9' }]
    : [
        { value: '9:16', label: '9:16' },
        { value: '16:9', label: '16:9' },
      ];

  return (
    <>
    <div className="grid grid-cols-1 lg:grid-cols-12">
      <aside className="lg:col-span-4 bg-slate-800/20 p-4 border-r border-slate-700 overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-6 flex flex-col">
            <fieldset disabled={isLoading} className="space-y-6 flex-grow">
              <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700 space-y-4">
                <RadioButtonGroup
                  label=""
                  name="contentType"
                  options={[
                    { value: 'video', label: 'Video' },
                    { value: 'image', label: 'Image' },
                  ]}
                  value={'video'}
                  onChange={() => {}} // Placeholder
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SelectInput<VeoModel>
                    label="Model Video"
                    value={veoModel}
                    onChange={setVeoModel}
                    options={[
                      { value: 'veo-3.0-fast-generate-preview', label: 'VEO 3.0 Fast' },
                      { value: 'veo-2.0-generate-001', label: 'VEO 2.0 Stable' },
                    ]}
                  />
                  <SelectInput<AspectRatio>
                    label="Rasio Aspek"
                    value={aspectRatio}
                    onChange={setAspectRatio}
                    options={aspectRatioOptions}
                    disabled={isVeo3}
                  />
                </div>
                <p className="text-sm text-gray-400">
                  Buat beberapa episode sekaligus. Setiap episode dapat memiliki prompt dan gambar referensi sendiri. Pengaturan umum di bawah ini akan berlaku untuk semua episode.
                </p>
              </div>

              <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2">
                {episodes.map((episode, index) => (
                  <div key={episode.id} className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="font-semibold text-white">{t('episodeLabel')} #{index + 1}</h3>
                      {episodes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeEpisode(episode.id)}
                          className="p-1 rounded-full text-gray-400 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                          aria-label="Hapus Episode"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <TextAreaInput
                        label=""
                        value={episode.prompt}
                        onChange={(val) => handleEpisodeChange(episode.id, 'prompt', val)}
                        placeholder="Masukkan prompt di sini..."
                        rows={6}
                      />
                      <ImageUploader
                        files={episode.imageFile}
                        onFilesChange={(files) => handleEpisodeChange(episode.id, 'imageFile', files)}
                        maxFiles={1}
                      />
                    </div>
                  </div>
                ))}
              </div>
              
              <Button type="button" variant="secondary" onClick={addEpisode} className="w-full justify-center">
                + Tambah Episode
              </Button>

              <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700 grid grid-cols-1 md:grid-cols-2 gap-4">
                <TextInput
                  label="Jeda (detik)"
                  type="number"
                  value={delay}
                  onChange={(e) => setDelay(e.target.value)}
                />
                <TextInput
                  label="Coba Ulang Maks."
                  type="number"
                  value={retries}
                  onChange={(e) => setRetries(e.target.value)}
                  disabled // Placeholder for future implementation
                />
              </div>

              <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700 text-center">
                <h3 className="font-semibold text-white">Karakter (Opsional)</h3>
                <p className="text-sm text-gray-400 mb-4">Gunakan karakter konsisten.</p>
                <p className="text-sm text-gray-500 mb-4">Impor karakter dari Universe untuk menjaga konsistensi visual.</p>
                <Button variant="secondary" className="mx-auto" disabled>
                  Impor dari Universe
                </Button>
              </div>
          </fieldset>
            <div className="pt-4 border-t border-slate-700">
                {isLoading ? (
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={handleStop}
                        disabled={isStopping}
                        className="w-full !bg-red-600 hover:!bg-red-500 focus:!ring-red-500 !text-white"
                    >
                        {isStopping ? <><Spinner /> {t('stoppingButton')}</> : t('stopButton')}
                    </Button>
                ) : (
                    <Button type="submit" className="w-full text-lg justify-center">
                        {t('generateVideosButton').replace('{count}', String(episodes.length))}
                    </Button>
                )}
            </div>
        </form>
      </aside>

      <main className="lg:col-span-8 bg-slate-900 p-4 md:p-8 overflow-y-auto">
        {error && (
            <div className="text-center text-red-400 bg-red-900/30 p-4 rounded-lg mb-6 border border-red-800">
                <p className="font-bold">{t('errorTitle')}</p>
                <p className="text-sm">{error}</p>
            </div>
        )}
        
        {outputs.length > 0 ? (
          <>
            <div className="flex flex-wrap gap-2 mb-6">
                <Button onClick={() => {}} disabled={outputs.filter(o=>o.url).length === 0}>
                    {t('playAllButton')}
                </Button>
                <Button onClick={handleDownloadZip} variant="secondary" disabled={isProcessingZip || outputs.filter(o=>o.url).length === 0}>
                    {isProcessingZip ? <Spinner/> : <DownloadIcon className="w-5 h-5" />}
                    {isProcessingZip ? 'Zipping...' : t('downloadZipButton')}
                </Button>
            </div>
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {outputs.map((output, index) => (
                        <div key={output.episodeId} className="space-y-2 bg-slate-800 p-3 rounded-lg">
                             <h3 className="text-sm font-semibold text-gray-400 text-center mb-2">{t('episodeLabel')} #{index + 1}</h3>
                             {output.status === 'done' && output.url ? (
                                <>
                                    <div className="relative group">
                                        <VideoPlayer videoUrl={output.url} aspectRatio={aspectRatio} />
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                            <Button onClick={() => setPreviewModalUrl(output.url!)}>
                                                <MagnifyingGlassIcon className="w-5 h-5" />
                                                {t('preview')}
                                            </Button>
                                        </div>
                                    </div>
                                    <Button 
                                        variant="secondary" 
                                        onClick={() => handleDownload(output.url!, index)}
                                        className="w-full mt-2"
                                    >
                                        <DownloadIcon className="w-5 h-5" />
                                        {t('downloadVideoButton')}
                                    </Button>
                                </>
                             ) : output.status === 'generating' ? (
                                <div style={aspectRatioStyle} className="w-full bg-black rounded-md flex flex-col items-center justify-center text-gray-400">
                                    <Spinner className="h-8 w-8"/>
                                    <p className="mt-2 text-sm">{t('generatingSceneShort')}</p>
                                </div>
                             ) : (
                                <div style={aspectRatioStyle} className="w-full bg-black rounded-md flex items-center justify-center text-gray-600 gap-2">
                                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                     <p className="text-sm font-semibold">{t('scenePending')}</p>
                                </div>
                             )}
                        </div>
                    ))}
                </div>
                {/* Tombol 'Create Another Batch' telah dihapus dari sini */}
            </div>
            </>
          ) : !error && !isLoading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-700">
                <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-24 w-24" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                <p className="mt-4 text-lg">{t('videoPlaceholder')}</p>
              </div>
            </div>
          )
        }
      </main>
    </div>
    <VideoPreviewModal isOpen={!!previewModalUrl} onClose={() => setPreviewModalUrl(null)} videoUrl={previewModalUrl} />
    </>
  );
};

export default BatchVideoGenerator;
