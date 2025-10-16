import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { VeoModel, AspectRatio } from '../types';
import SelectInput from './SelectInput';
import Button from './Button';
import TextInput from './TextInput';
import { useApiKey } from '../contexts/ApiKeyContext';
import { useLanguage } from '../contexts/LanguageContext';
import { generateVideo } from '../services/geminiService';
import { Spinner } from './Spinner';
import VideoPlayer from './VideoPlayer';
import { DownloadIcon } from './icons';

type OutputStatus = 'pending' | 'generating' | 'done';
interface Output {
  id: number;
  status: OutputStatus;
  url?: string;
}

const BatchJsonGenerator: React.FC = () => {
  const { t } = useLanguage();
  const { apiKey, isApiKeySet } = useApiKey();
  
  const [prompts, setPrompts] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [veoModel, setVeoModel] = useState<VeoModel>('veo-3.0-fast-generate-preview');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16');
  const [delay, setDelay] = useState('10');
  const [retries, setRetries] = useState('2');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isStopping, setIsStopping] = useState<boolean>(false);
  const stopRequested = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [outputs, setOutputs] = useState<Output[]>([]);

  const isVeo3 = useMemo(() => veoModel.startsWith('veo-3.0'), [veoModel]);

  useEffect(() => {
    if (isVeo3) {
      setAspectRatio('16:9');
    }
  }, [isVeo3]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const text = e.target?.result as string;
            const parsed = JSON.parse(text);
            let loadedPrompts: string[] = [];

            if (Array.isArray(parsed)) {
                loadedPrompts = parsed.map((item: any) => item.prompt).filter(Boolean);
            } else if (parsed && Array.isArray(parsed.scenes)) {
                 loadedPrompts = parsed.scenes.map((scene: any) => scene.prompt).filter(Boolean);
            }

            if (loadedPrompts.length > 0) {
                setPrompts(loadedPrompts);
                setError(null);
            } else {
                 setError(t('invalidJsonStructure'));
            }
        } catch (err: any) {
            setError(t('errorParsingJson').replace('{message}', err.message));
        }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset input
  };
  
  const clearProject = useCallback(() => {
    setPrompts([]);
    setError(null);
    setOutputs([]);
    setIsLoading(false);
    setIsStopping(false);
    stopRequested.current = false;
  }, []);

  const handleDownload = (url: string, jobIndex: number) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `ct-batch-json-job-${jobIndex + 1}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isApiKeySet) {
      setError(t('apiKeyMissingError'));
      return;
    }
    
    if (prompts.length === 0) {
      setError(t('noValidPromptsError'));
      return;
    }

    setIsLoading(true);
    setIsStopping(false);
    stopRequested.current = false;
    setError(null);
    setOutputs(prompts.map((_, index) => ({ id: index, status: 'pending' })));

    try {
      for (let i = 0; i < prompts.length; i++) {
        if (stopRequested.current) break;

        const prompt = prompts[i];
        
        setOutputs(prev => prev.map(o => o.id === i ? { ...o, status: 'generating' } : o));
        
        const generatedUrl = await generateVideo(
          apiKey,
          { prompt, imageBase64: null, imageMimeType: null, model: veoModel },
          aspectRatio, true, '1080p', 'none', 'Cinematic'
        );
        
        setOutputs(prev => prev.map(o => o.id === i ? { ...o, status: 'done', url: generatedUrl } : o));

        if (i < prompts.length - 1) {
          const delaySeconds = parseInt(delay, 10);
          if (delaySeconds > 0) {
            await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
          }
        }
      }
      if (stopRequested.current) setError(t('generationStoppedByUser'));
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
    <div className="grid grid-cols-1 lg:grid-cols-12">
      <aside className="lg:col-span-4 bg-slate-800/20 p-4 border-r border-slate-700 overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-6 flex flex-col">
            <fieldset disabled={isLoading} className="space-y-6 flex-grow">
              <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SelectInput<VeoModel> label="Model Video" value={veoModel} onChange={setVeoModel} options={[{ value: 'veo-3.0-fast-generate-preview', label: 'VEO 3.0 Fast' }, { value: 'veo-2.0-generate-001', label: 'VEO 2.0 Stable' }]} />
                  <SelectInput<AspectRatio> label="Rasio Aspek" value={aspectRatio} onChange={setAspectRatio} options={aspectRatioOptions} disabled={isVeo3} />
                </div>
              </div>

              <div className="space-y-2 text-center p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json,application/json" hidden />
                <Button type="button" onClick={() => fileInputRef.current?.click()} className="w-full justify-center">{t('selectJsonFile')}</Button>
                {prompts.length > 0 && <p className="text-sm text-green-500 mt-2">{t('jobsLoaded').replace('{count}', String(prompts.length))}</p>}
              </div>

              <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700 grid grid-cols-1 md:grid-cols-2 gap-4">
                <TextInput label="Jeda (detik)" type="number" value={delay} onChange={(e) => setDelay(e.target.value)} />
                <TextInput label="Coba Ulang Maks." type="number" value={retries} onChange={(e) => setRetries(e.target.value)} disabled />
              </div>
          </fieldset>
            <div className="pt-4 border-t border-slate-700">
                {isLoading ? (
                    <Button type="button" variant="secondary" onClick={() => { stopRequested.current = true; setIsStopping(true); }} disabled={isStopping} className="w-full !bg-red-600 hover:!bg-red-500 !text-white">{isStopping ? <><Spinner /> {t('stoppingButton')}</> : t('stopButton')}</Button>
                ) : (
                    <Button type="submit" className="w-full text-lg justify-center">{t('generateVideosButton').replace('{count}', String(prompts.length))}</Button>
                )}
            </div>
        </form>
      </aside>
      <main className="lg:col-span-8 bg-slate-900 p-4 md:p-8 overflow-y-auto">
        {error && <div className="text-center text-red-400 bg-red-900/30 p-4 rounded-lg mb-6 border border-red-800"><p className="font-bold">{t('errorTitle')}</p><p className="text-sm">{error}</p></div>}
        {outputs.length > 0 ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {outputs.map((output, index) => (
                <div key={output.id} className="space-y-2 bg-slate-800 p-3 rounded-lg">
                  <h3 className="text-sm font-semibold text-gray-400 text-center mb-2">{t('jobLabel')} #{index + 1}</h3>
                  {output.status === 'done' && output.url ? (
                    <><VideoPlayer videoUrl={output.url} aspectRatio={aspectRatio} /><Button variant="secondary" onClick={() => handleDownload(output.url!, index)} className="w-full mt-2"><DownloadIcon className="w-5 h-5" />{t('downloadVideoButton')}</Button></>
                  ) : output.status === 'generating' ? (
                    <div style={aspectRatioStyle} className="w-full bg-black rounded-md flex flex-col items-center justify-center text-gray-400"><Spinner className="h-8 w-8"/><p className="mt-2 text-sm">{t('generatingSceneShort')}</p></div>
                  ) : (
                    <div style={aspectRatioStyle} className="w-full bg-black rounded-md flex items-center justify-center text-gray-600 gap-2"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><p className="text-sm font-semibold">{t('scenePending')}</p></div>
                  )}
                </div>
              ))}
            </div>
            {/* Tombol 'Create Another Batch' telah dihapus dari sini */}
          </div>
        ) : !error && !isLoading && (
          <div className="flex items-center justify-center h-full"><div className="text-center text-gray-700"><svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-24 w-24" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg><p className="mt-4 text-lg">{t('videoPlaceholder')}</p></div></div>
        )}
      </main>
    </div>
  );
};

export default BatchJsonGenerator;
