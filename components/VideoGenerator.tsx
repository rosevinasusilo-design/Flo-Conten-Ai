import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { generateVideo } from '../services/geminiService';
import { AspectRatio, Resolution, VeoModel, CharacterVoice, VisualStyle, Scene } from '../types';
import { getLastFrameAsBase64, isValidJson } from '../utils/videoUtils';

import Button from './Button';
import { ImageUploader } from './ImageUploader';
import { Spinner } from './Spinner';
import SelectInput from './SelectInput';
import TextAreaInput from './TextAreaInput';
import ToggleSwitch from './ToggleSwitch';
import VideoPlayer from './VideoPlayer';
import RadioButtonGroup from './RadioButtonGroup';
import { useLanguage } from '../contexts/LanguageContext';
import { useApiKey } from '../contexts/ApiKeyContext';
import { DownloadIcon } from './icons';

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
  id: number;
  status: OutputStatus;
  url?: string;
}

const VideoGenerator: React.FC = () => {
  const { t } = useLanguage();
  const { apiKey, isApiKeySet } = useApiKey();
  const [scenes, setScenes] = useState<Scene[]>([{ id: Date.now(), prompt: '', usePreviousScene: false }]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16');
  const [enableSound, setEnableSound] = useState<boolean>(true);
  const [resolution, setResolution] = useState<Resolution>('1080p');
  const [veoModel, setVeoModel] = useState<VeoModel>('veo-3.0-fast-generate-preview');
  const [visualStyle, setVisualStyle] = useState<VisualStyle>('Cinematic');
  const [characterVoice, setCharacterVoice] = useState<CharacterVoice>('bahasa-indonesia');
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isStopping, setIsStopping] = useState<boolean>(false);
  const stopRequested = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [outputs, setOutputs] = useState<Output[]>([]);

  const isVeo3 = useMemo(() => veoModel.startsWith('veo-3.0'), [veoModel]);

  useEffect(() => {
    if (veoModel === 'veo-2.0-generate-001') {
      setEnableSound(false);
    } else {
      setEnableSound(true);
    }
    if (isVeo3) {
      setAspectRatio('16:9');
    }
  }, [veoModel, isVeo3]);
  
  const handleAddScene = () => {
    setScenes([...scenes, { id: Date.now(), prompt: '', usePreviousScene: true }]);
  };

  const handleRemoveScene = (id: number) => {
    setScenes(scenes.filter(scene => scene.id !== id));
  };

  const handleSceneChange = (id: number, field: keyof Omit<Scene, 'id'>, value: any) => {
    setScenes(scenes.map(scene => {
      if (scene.id === id) {
        return { ...scene, [field]: value };
      }
      return scene;
    }));
  };

  const handleFilesChange = useCallback((files: File[]) => {
    setImageFiles(files);
  }, []);

  const handleStop = useCallback(() => {
    stopRequested.current = true;
    setIsStopping(true);
  }, []);

  const clearProject = useCallback(() => {
    setScenes([{ id: Date.now(), prompt: '', usePreviousScene: false }]);
    setImageFiles([]);
    setAspectRatio('9:16');
    setEnableSound(true);
    setResolution('1080p');
    setVeoModel('veo-3.0-fast-generate-preview');
    setVisualStyle('Cinematic');
    setCharacterVoice('bahasa-indonesia');
    setError(null);
    setOutputs([]);
  }, []);

  const handleDownload = (url: string, sceneIndex: number) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `veo-scene-${sceneIndex + 1}.mp4`; // Suggest a filename
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
    
    if (scenes.some(s => !s.prompt.trim())) {
        setError(t('promptRequiredForSceneError'));
        return;
    }

    setIsLoading(true);
    setIsStopping(false);
    stopRequested.current = false;
    setError(null);
    setOutputs(scenes.map(scene => ({ id: scene.id, status: 'pending' })));

    let lastFrame: { base64: string; mimeType: string } | null = null;

    try {
      if (imageFiles.length > 0) {
        const imageFile = imageFiles[0];
        lastFrame = {
          base64: await fileToBase64(imageFile),
          mimeType: imageFile.type,
        };
      }

      for (let i = 0; i < scenes.length; i++) {
        if (stopRequested.current) {
            break;
        }

        const scene = scenes[i];
        
        setOutputs(prev => prev.map((output, index) => index === i ? { ...output, status: 'generating' } : output));
        
        let imageBase64: string | null = null;
        let imageMimeType: string | null = null;

        const useImage = (i === 0 && imageFiles.length > 0) || (i > 0 && scene.usePreviousScene);

        if (useImage && lastFrame) {
            imageBase64 = lastFrame.base64;
            imageMimeType = lastFrame.mimeType;
        }

        let promptPayload: string | object = scene.prompt;
        if (isValidJson(scene.prompt)) {
            try {
                promptPayload = JSON.parse(scene.prompt);
            } catch (err) {
                 console.warn(`Could not parse supposedly valid JSON in scene ${i + 1}. Sending as plain text.`);
            }
        }

        const generatedUrl = await generateVideo(
          apiKey,
          { prompt: promptPayload, imageBase64, imageMimeType, model: veoModel },
          aspectRatio,
          enableSound,
          resolution,
          characterVoice,
          visualStyle
        );
        
        setOutputs(prev => prev.map((output, index) => index === i ? { ...output, status: 'done', url: generatedUrl } : output));

        if (i < scenes.length - 1 && scenes[i + 1].usePreviousScene) {
          lastFrame = await getLastFrameAsBase64(generatedUrl);
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
    ? [{ value: '16:9', label: t('aspectRatio16x9') }]
    : [
        { value: '9:16', label: t('aspectRatio9x16') },
        { value: '16:9', label: t('aspectRatio16x9') },
      ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 h-full">
      {/* Controls Panel */}
      <aside className="lg:col-span-3 bg-gray-800 p-4 border-r border-gray-700 overflow-y-auto h-full">
        <form onSubmit={handleSubmit} className="space-y-6 flex flex-col h-full">
          <fieldset disabled={isLoading} className="space-y-6 flex-grow">
            
            <div className="space-y-4 p-4 bg-gray-900/50 rounded-lg">
                <SelectInput<VeoModel>
                    label={t('veoModelLabel')}
                    value={veoModel}
                    onChange={setVeoModel}
                    options={[
                        { value: 'veo-3.0-fast-generate-preview', label: 'VEO 3.0 (Fast Preview)' },
                        { value: 'veo-2.0-generate-001', label: 'VEO 2.0 (Stable)' },
                    ]}
                />
                <ImageUploader files={imageFiles} onFilesChange={handleFilesChange} maxFiles={1} label={t('initialImageLabel')} />
            </div>

            <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-400 px-1">{t('scenesTitle')}</h3>
              {scenes.map((scene, index) => (
                <div key={scene.id} className="bg-gray-700/50 p-3 rounded-lg border border-gray-600/50 relative space-y-2">
                   <div className="flex items-center justify-between">
                     <span className="text-xs font-semibold text-gray-400">{t('sceneLabel')} {index + 1}</span>
                      {scenes.length > 1 && (
                        <button type="button" onClick={() => handleRemoveScene(scene.id)} className="text-gray-500 hover:text-red-400">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      )}
                   </div>
                  <TextAreaInput 
                    label=""
                    value={scene.prompt}
                    onChange={(val) => handleSceneChange(scene.id, 'prompt', val)}
                    placeholder={t('promptPlaceholder')}
                  />
                   <div className="flex items-center justify-end flex-wrap gap-2 text-xs">
                      {index > 0 && (
                          <ToggleSwitch label={t('usePreviousSceneLabel')} enabled={scene.usePreviousScene} onChange={(val) => handleSceneChange(scene.id, 'usePreviousScene', val)} />
                      )}
                  </div>
                </div>
              ))}
               <Button type="button" variant="secondary" onClick={handleAddScene} className="w-full">
                  {t('addSceneButton')}
              </Button>
            </div>
            
            <div className="space-y-4 p-4 bg-gray-900/50 rounded-lg">
                <h3 className="text-sm font-semibold text-gray-400 -mt-1 mb-2">{t('settingsTitle')}</h3>
                <SelectInput<VisualStyle>
                    label={t('visualStyleLabel')}
                    value={visualStyle}
                    onChange={setVisualStyle}
                    options={[
                        { value: 'Cinematic', label: t('styleCinematic') },
                        { value: 'Realistic', label: t('styleRealistic') },
                        { value: 'Anime', label: t('styleAnime') },
                        { value: 'Pixar3D', label: t('stylePixar3D') },
                        { value: 'Cyberpunk', label: t('styleCyberpunk') },
                        { value: "Retro 80's", label: t('styleRetro80s') },
                    ]}
                />
                <div className="grid grid-cols-2 gap-4">
                    <SelectInput<AspectRatio> 
                        label={t('aspectRatioLabel')}
                        value={aspectRatio}
                        onChange={setAspectRatio}
                        options={aspectRatioOptions}
                        disabled={isVeo3}
                    />
                    <SelectInput<Resolution> 
                        label={t('resolutionLabel')}
                        value={resolution}
                        onChange={setResolution}
                        options={[
                            { value: '1080p', label: t('resolution1080p') },
                            { value: '720p', label: t('resolution720p') },
                        ]}
                    />
                </div>
                <ToggleSwitch label={t('enableSoundLabel')} enabled={enableSound} onChange={setEnableSound} disabled={veoModel === 'veo-2.0-generate-001'} />
                {veoModel === 'veo-3.0-fast-generate-preview' && enableSound && (
                  <SelectInput<CharacterVoice> 
                      label={t('characterVoiceLabel')}
                      value={characterVoice}
                      onChange={setCharacterVoice}
                      options={[
                          { value: 'none', label: t('voiceNone') },
                          { value: 'english', label: t('voiceEnglish') },
                          { value: 'bahasa-indonesia', label: t('voiceIndonesian') },
                      ]}
                  />
                )}
            </div>
          </fieldset>
          
          <div className="pt-4 mt-auto border-t border-gray-700">
              {isLoading ? (
                  <Button
                      type="button"
                      variant="secondary"
                      onClick={handleStop}
                      disabled={isStopping}
                      className="w-full !bg-red-600 hover:!bg-red-700 focus:!ring-red-500 !text-white"
                  >
                      {isStopping ? (
                          <> <Spinner className="h-5 w-5" /> {t('stoppingButton')} </>
                      ) : (
                         <>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                          </svg>
                          {t('stopButton')}
                         </>
                      )}
                  </Button>
              ) : (
                  <Button 
                    type="submit"
                    className="w-full text-lg"
                  >
                      {t('generateVideoButton')} ({scenes.length} {scenes.length > 1 ? 'Scenes' : 'Scene'})
                  </Button>
              )}
          </div>
        </form>
      </aside>

      {/* Content Area */}
      <main className="lg:col-span-9 bg-gray-900 p-4 md:p-8 overflow-y-auto h-full">
        {error && (
            <div className="text-center text-red-400 bg-red-900/30 p-4 rounded-lg mb-6 border border-red-800">
                <p className="font-bold">{t('errorTitle')}</p>
                <p className="text-sm">{error}</p>
            </div>
        )}
        
        {outputs.length > 0 ? (
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {outputs.map((output, index) => (
                        <div key={output.id} className="space-y-2 bg-gray-800 p-3 rounded-lg">
                             <h3 className="text-sm font-semibold text-gray-400 text-center mb-2">{t('sceneLabel')} {index + 1}</h3>
                             {output.status === 'done' && output.url ? (
                                <>
                                    <VideoPlayer videoUrl={output.url} aspectRatio={aspectRatio} />
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
                 {/* Tombol 'Create Another' telah dihapus dari sini */}
            </div>
          ) : !error && !isLoading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-24 w-24" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                <p className="mt-4 text-lg">{t('videoPlaceholder')}</p>
              </div>
            </div>
          )
        }
      </main>
    </div>
  );
};

export default VideoGenerator;
