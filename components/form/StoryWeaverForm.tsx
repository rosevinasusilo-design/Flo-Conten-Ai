import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
// FIX: Import response types to fix type errors on API call results.
import { GoogleGenAI, Type, GenerateContentResponse, GenerateImagesResponse } from "@google/genai";
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import JSZip from 'jszip';
import { SharedFormProps, StoryScene, ASSET_STYLES, StoryCharacter, VeoModel } from '../../types';
import { generateRandomString, getFriendlyApiErrorMessage, triggerDownload, sanitizeFileName, base64ToBlob, triggerFileInput, handleSingleImageUpload } from '../../utils/helpers';
import { generateVideoForStory, generateTextToSpeech } from '../../services/geminiService';
import Card from '../Card';
import Button from '../Button';
import LoadingIndicator from '../LoadingIndicator';
import Select from '../Select';
import Input from '../Input';

const VEO_MODELS = [
    { value: 'veo-3.0-fast-generate-001', label: 'VEO 3.0 Fast' },
    { value: 'veo-3.0-generate-001', label: 'VEO 3.0' },
];

const StoryWeaverForm: React.FC<SharedFormProps> = ({
    addLog,
    getNextApiKey,
    logUsage,
    addToMediaLibrary,
    universe,
    executeApiCallWithKeyRotation,
    setModalVideoUrl,
    setModalImageUrl,
}) => {
    const [storyIdea, setStoryIdea] = useState('Seorang astronot menemukan taman rahasia di bulan.');
    const [numScenes, setNumScenes] = useState(4);
    const [aspectRatio, setAspectRatio] = useState('9:16');
    const [visualStyle, setVisualStyle] = useState('Cinematic');
    const [videoModel, setVideoModel] = useState('veo-3.0-fast-generate-001');
    const [scenes, setScenes] = useState<StoryScene[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isGeneratingAll, setIsGeneratingAll] = useState<'images' | 'videos' | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [selectedCharacters, setSelectedCharacters] = useState<StoryCharacter[]>([]);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [selectedCharIds, setSelectedCharIds] = useState<Set<string>>(new Set());
    const imageInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

    const ffmpegRef = useRef<FFmpeg | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingProgress, setProcessingProgress] = useState(0);
    const [ffmpegLoadState, setFfmpegLoadState] = useState<'idle'|'loading'|'loaded'|'error'>('idle');

    // --- State for Sequential Player ---
    const [playAllState, setPlayAllState] = useState<{ isPlaying: boolean, currentIndex: number }>({ isPlaying: false, currentIndex: 0 });
    const playAllPlayerRef = useRef<HTMLVideoElement>(null);
    const scenesWithVideo = useMemo(() => scenes.filter(s => s.videoUrl), [scenes]);
    const isVeo3 = useMemo(() => videoModel.startsWith('veo-3.0'), [videoModel]);

    useEffect(() => {
        if (isVeo3) {
            setAspectRatio('16:9');
        }
    }, [isVeo3]);

    const loadFFmpeg = useCallback(async () => {
        if (ffmpegRef.current || ffmpegLoadState === 'loading' || ffmpegLoadState === 'loaded') return ffmpegRef.current;
        setFfmpegLoadState('loading');
        addLog('[StoryWeaver] Memuat FFmpeg...', 'info');
        const newFFmpeg = new FFmpeg();
        newFFmpeg.on('progress', ({ progress }) => setProcessingProgress(Math.round(progress * 100)));
        try {
            const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm";
            await newFFmpeg.load({
                coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
                wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
            });
            ffmpegRef.current = newFFmpeg;
            setFfmpegLoadState('loaded');
            addLog('[StoryWeaver] FFmpeg berhasil dimuat.', 'info');
            return newFFmpeg;
        } catch (err: any) {
            setFfmpegLoadState('error');
            addLog(`[StoryWeaver] Gagal memuat FFmpeg: ${err.message}.`, 'error');
            throw err;
        }
    }, [addLog, ffmpegLoadState]);

    const handleGenerateIdea = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [response]: [GenerateContentResponse, any] = await executeApiCallWithKeyRotation(
                (ai) => ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: 'Buat satu ide cerita acak yang menarik untuk sebuah video pendek, dalam satu kalimat, dalam Bahasa Indonesia.'
                }),
                'Generate Story Idea'
            );
            setStoryIdea(response.text.trim());
            addLog('Ide cerita baru dibuat!', 'info');
        } catch (err: any) {
            setError(getFriendlyApiErrorMessage(err));
        } finally {
            setIsLoading(false);
        }
    };

    const handleWeaveStory = async () => {
        setIsLoading(true);
        setError(null);
        setScenes([]);
    
        try {
            addLog('[StoryWeaver] AI Director sedang menulis naskah...', 'status');
            const charactersPrompt = selectedCharacters.length > 0
                ? `\n\n**Karakter yang Telah Ditentukan (WAJIB digunakan secara konsisten):**\n${selectedCharacters.map(c => `- ${c.name}: ${c.description}. Pakaian: ${c.clothing}.`).join('\n')}`
                : '';
    
            const scriptPrompt = `Anda adalah seorang sutradara film. Berdasarkan ide pengguna, tulis urutan ${numScenes} prompt yang detail untuk generator AI. Setiap prompt harus mendeskripsikan adegan yang berbeda untuk membentuk cerita mini.
    - Ide Cerita: "${storyIdea}"
    - Gaya Visual: "${visualStyle}"
    ${charactersPrompt}
    Kembalikan hasilnya sebagai objek JSON tunggal yang diminifikasi dengan kunci "scenes", yang merupakan array string.`;
    
            const [scriptResponse]: [GenerateContentResponse, any] = await executeApiCallWithKeyRotation(
                (ai) => ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: scriptPrompt,
                    config: {
                        responseMimeType: 'application/json',
                        responseSchema: { type: Type.OBJECT, properties: { scenes: { type: Type.ARRAY, items: { type: Type.STRING } } } }
                    }
                }),
                'Weave Story Script'
            );
            
            const { scenes: scenePrompts } = JSON.parse(scriptResponse.text);
            logUsage('text');
            addLog(`[StoryWeaver] Naskah dengan ${scenePrompts.length} adegan berhasil ditulis.`, 'info');
    
            const initialScenes: StoryScene[] = scenePrompts.map((prompt: string) => ({
                id: generateRandomString(8), prompt, status: 'pending'
            }));
            setScenes(initialScenes);
    
        } catch (err: any) {
            setError(getFriendlyApiErrorMessage(err));
        } finally {
            setIsLoading(false);
        }
    };

    const handleGenerateSceneImage = async (sceneId: string, scenePrompt: string) => {
        setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, status: 'generating-image' } : s));
        try {
            const [imageResponse]: [GenerateImagesResponse, any] = await executeApiCallWithKeyRotation(
                (ai) => ai.models.generateImages({
                    model: 'imagen-4.0-generate-001', prompt: scenePrompt,
                    config: { numberOfImages: 1, aspectRatio: aspectRatio as any, outputMimeType: 'image/png' }
                }),
                `Generate Scene Image ${sceneId}`
            );
            const imageBytes = imageResponse.generatedImages?.[0]?.image?.imageBytes;
            if (!imageBytes) throw new Error("Model tidak mengembalikan gambar.");
            const imageUrl = `data:image/png;base64,${imageBytes}`;
            const imageFileName = `storyweaver_img_${sceneId.substring(0,4)}.png`;

            setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, status: 'image-done', imageUrl, imageBase64: imageBytes, imageFileName } : s));
            logUsage('images');
        } catch (err: any) {
            addLog(`[StoryWeaver] Gagal membuat gambar untuk adegan: ${getFriendlyApiErrorMessage(err)}`, 'error');
            setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, status: 'error' } : s));
        }
    };

    const handleGenerateSceneVideo = async (sceneId: string) => {
        const scene = scenes.find(s => s.id === sceneId);
        if (!scene || !scene.imageBase64) {
            addLog('[StoryWeaver] Gambar harus dibuat terlebih dahulu sebelum video.', 'warning');
            return;
        }

        setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, status: 'generating-video' } : s));
        try {
            const videoPayload = {
                prompt: scene.prompt,
                image: { imageBytes: scene.imageBase64, mimeType: 'image/png' },
                config: { numberOfVideos: 1, aspectRatio: aspectRatio as any }
            };
            const [operation, { apiKey: usedApiKey }] = await executeApiCallWithKeyRotation(
                (ai) => generateVideoForStory(ai, videoModel as VeoModel, videoPayload, msg => addLog(`[Scene ${sceneId.substring(0,4)}] ${msg}`, 'status')),
                `Generate Scene Video ${sceneId}`
            );
            const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
            if (!downloadLink) throw new Error("API tidak mengembalikan video.");

            const url = new URL(downloadLink);
            url.searchParams.set('key', usedApiKey!);
            const finalVideoUrl = url.toString();

            const videoResponse = await fetch(finalVideoUrl);
            if (!videoResponse.ok) {
                const errorBody = await videoResponse.text();
                throw new Error(`Gagal mengunduh video: ${videoResponse.status} ${errorBody}`);
            }

            const videoBlob = await videoResponse.blob();
            const videoUrl = URL.createObjectURL(videoBlob);
            
            addLog(`[Scene ${sceneId.substring(0,4)}] Membuat narasi audio...`, 'status');
            const [audioResult]: [Blob, any] = await executeApiCallWithKeyRotation(
                (ai) => generateTextToSpeech(ai, scene.prompt),
                `Generate Scene Audio ${sceneId}`
            );
            const audioBlob = audioResult;
            const audioUrl = URL.createObjectURL(audioBlob);

            setScenes(prev => prev.map(s => s.id === sceneId ? { 
                ...s, status: 'done', videoUrl, audioUrl,
                videoFileName: `storyweaver_vid_${s.id.substring(0,4)}.mp4`,
                audioFileName: `storyweaver_audio_${s.id.substring(0,4)}.wav`
            } : s));
            logUsage('videos');
            logUsage('audio');
            addToMediaLibrary({ type: 'video', previewUrl: videoUrl, prompt: scene.prompt, model: videoModel, sourceComponent: 'StoryWeaver' });

        } catch (err: any) {
            addLog(`[StoryWeaver] Gagal membuat video untuk adegan: ${getFriendlyApiErrorMessage(err)}`, 'error');
            setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, status: 'error' } : s));
        }
    };
    
    const handleGenerateAllImages = async () => {
        setIsGeneratingAll('images');
        for (const scene of scenes) {
            if (scene.status === 'pending') {
                await handleGenerateSceneImage(scene.id, scene.prompt);
            }
        }
        setIsGeneratingAll(null);
    };

    const handleGenerateAllVideos = async () => {
        setIsGeneratingAll('videos');
        for (const scene of scenes) {
            if (scene.status === 'image-done') {
                await handleGenerateSceneVideo(scene.id);
            }
        }
        setIsGeneratingAll(null);
    };

    const handleMergeAndDownload = async () => {
        const ffmpeg = await loadFFmpeg();
        if (!ffmpeg) return;
        const scenesToMerge = scenes.filter(s => s.status === 'done' && s.videoUrl && s.audioUrl);
        if (scenesToMerge.length < 1) {
            addLog('[StoryWeaver] Butuh setidaknya 1 klip video & audio yang sudah dibuat untuk digabungkan.', 'warning');
            return;
        }

        setIsProcessing(true);
        addLog(`[StoryWeaver] Memulai penggabungan untuk ${scenesToMerge.length} klip...`, 'status');

        try {
            let ffmpegInputs: string[] = [];
            let videoStreams = '';
            let audioStreams = '';
            for (let i = 0; i < scenesToMerge.length; i++) {
                const scene = scenesToMerge[i];
                const videoFilename = `input${i}.mp4`;
                const audioFilename = `input${i}.wav`;
                
                const videoBlob = await fetch(scene.videoUrl!).then(r => r.blob());
                const audioBlob = await fetch(scene.audioUrl!).then(r => r.blob());
                await ffmpeg.writeFile(videoFilename, new Uint8Array(await videoBlob.arrayBuffer()));
                await ffmpeg.writeFile(audioFilename, new Uint8Array(await audioBlob.arrayBuffer()));

                ffmpegInputs.push('-i', videoFilename, '-i', audioFilename);
                videoStreams += `[${i*2}:v]`;
                audioStreams += `[${i*2+1}:a]`;
            }
            
            const filterComplex = `${videoStreams}concat=n=${scenesToMerge.length}:v=1[outv];${audioStreams}concat=n=${scenesToMerge.length}:v=0:a=1[outa]`;
            const outputFilename = `${sanitizeFileName(storyIdea)}.mp4`;
            
            await ffmpeg.exec([ ...ffmpegInputs, '-filter_complex', filterComplex, '-map', '[outv]', '-map', '[outa]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', outputFilename ]);
            
            const data = await ffmpeg.readFile(outputFilename);
            triggerDownload(URL.createObjectURL(new Blob([data], { type: 'video/mp4' })), outputFilename);
            addLog(`[StoryWeaver] Film pendek berhasil digabungkan dan diunduh!`, 'info');
        } catch(error: any) {
             addLog(`[StoryWeaver] Gagal menggabungkan: ${error.message}`, 'error');
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleDownloadZip = async () => {
        const scenesToZip = scenes.filter(s => s.status === 'done');
        if (scenesToZip.length === 0) return;
        setIsProcessing(true);
        addLog('[StoryWeaver] Menyiapkan proyek ZIP...', 'status');
        try {
            const zip = new JSZip();
            zip.file("script.txt", scenes.map((s, i) => `Scene ${i+1}:\n${s.prompt}`).join('\n\n'));
            const assets = zip.folder("assets");
            for (const scene of scenesToZip) {
                const imgBlob = await fetch(scene.imageUrl!).then(r => r.blob());
                const vidBlob = await fetch(scene.videoUrl!).then(r => r.blob());
                const audBlob = await fetch(scene.audioUrl!).then(r => r.blob());
                assets?.file(scene.imageFileName!, imgBlob);
                assets?.file(scene.videoFileName!, vidBlob);
                assets?.file(scene.audioFileName!, audBlob);
            }
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            triggerDownload(URL.createObjectURL(zipBlob), `StoryWeaver_${sanitizeFileName(storyIdea)}.zip`);
        } catch (error: any) {
             addLog(`[StoryWeaver] Gagal membuat ZIP: ${error.message}`, 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handlePlayAll = () => scenes.length > 0 && setPlayAllState({ isPlaying: true, currentIndex: 0 });
    const handleStopPlayAll = useCallback(() => {
        setPlayAllState({ isPlaying: false, currentIndex: 0 });
        if (playAllPlayerRef.current) {
            playAllPlayerRef.current.pause();
            playAllPlayerRef.current.removeAttribute('src');
            playAllPlayerRef.current.load();
        }
    }, []);
    const handlePlaybackEnded = useCallback(() => setPlayAllState(p => ({ ...p, currentIndex: p.currentIndex + 1 })), []);
    
    useEffect(() => {
        const player = playAllPlayerRef.current;
        if (!player || !playAllState.isPlaying) return;
        const scene = scenesWithVideo[playAllState.currentIndex];
        if (scene) {
            player.src = scene.videoUrl!;
            player.play().catch(e => console.error("Playback error:", e));
        } else {
            handleStopPlayAll();
        }
    }, [playAllState, scenesWithVideo, handleStopPlayAll]);

    const handleImportCheckboxChange = (charId: string) => {
        setSelectedCharIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(charId)) {
                newSet.delete(charId);
            } else {
                newSet.add(charId);
            }
            return newSet;
        });
    };

    const handleImportCharacters = () => {
        const charsToImport = universe.characters.filter(c => selectedCharIds.has(c.id));
        const existingIds = new Set(selectedCharacters.map(c => c.id));
        const newChars = charsToImport.filter(c => !existingIds.has(c.id));
        setSelectedCharacters(prev => [...prev, ...newChars]);
        addLog(`[StoryWeaver] Mengimpor ${newChars.length} karakter.`, 'info');
        setIsImportModalOpen(false);
        setSelectedCharIds(new Set());
    };

    const handleRemoveCharacter = (id: string) => setSelectedCharacters(prev => prev.filter(c => c.id !== id));

    const aspectRatioOptions = isVeo3
        ? [{ value: '16:9', label: '16:9 (Widescreen)' }]
        : [
            { value: '9:16', label: '9:16 (Vertikal)' },
            { value: '16:9', label: '16:9 (Widescreen)' },
            { value: '1:1', label: '1:1 (Persegi)' },
          ];

    return (
        <>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-2 space-y-6">
                <Card title="Panel Kontrol Story Weaver">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-green-400 mb-1">Ide Cerita</label>
                            <div className="flex gap-2">
                                <textarea value={storyIdea} onChange={e => setStoryIdea(e.target.value)} rows={3} className="w-full bg-slate-700 border border-green-500/30 rounded-md py-2 px-3"/>
                                <Button onClick={handleGenerateIdea} disabled={isLoading} variant="secondary" title="Sarankan Ide Cerita"><i className={`fa-solid fa-wand-magic-sparkles ${isLoading ? 'animate-spin' : ''}`}></i></Button>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <Input label="Jumlah Adegan" type="number" id="numScenes" min="2" max="10" value={numScenes} onChange={e => setNumScenes(parseInt(e.target.value))} />
                            <Select label="Rasio Aspek" id="aspectRatio" value={aspectRatio} onChange={e => setAspectRatio(e.target.value)} disabled={isVeo3}>
                                {aspectRatioOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                            </Select>
                        </div>
                        <Select label="Gaya Visual" id="visualStyle" value={visualStyle} onChange={e => setVisualStyle(e.target.value)}>
                            {ASSET_STYLES.map(s => <option key={s} value={s}>{s}</option>)}
                        </Select>
                        <Select label="Model Video" id="sw-video-model" value={videoModel} onChange={e => setVideoModel(e.target.value)}>
                            {VEO_MODELS.map(model => <option key={model.value} value={model.value}>{model.label}</option>)}
                        </Select>
                         <div className="pt-4 border-t border-slate-700">
                            <h4 className="text-sm font-semibold text-green-400 mb-2">Karakter Konsisten</h4>
                            <div className="space-y-2 max-h-24 overflow-y-auto pr-2">
                                {selectedCharacters.map(char => (
                                    <div key={char.id} className="flex items-center gap-2 bg-slate-700 p-1 rounded">
                                        <img src={char.imageUrl || `https://via.placeholder.com/32/030712/4ade80?text=${char.name.charAt(0)}`} alt={char.name} className="w-6 h-6 rounded-full object-cover" />
                                        <p className="flex-grow text-sm text-white truncate">{char.name}</p>
                                        <Button onClick={() => handleRemoveCharacter(char.id)} size="sm" variant="secondary" className="!p-0 h-5 w-5 flex-shrink-0 !text-red-400" title="Remove"><i className="fa-solid fa-times text-xs"></i></Button>
                                    </div>
                                ))}
                            </div>
                            <Button onClick={() => setIsImportModalOpen(true)} variant="secondary" size="sm" className="w-full mt-2">Impor dari Universe</Button>
                        </div>
                        <Button onClick={handleWeaveStory} disabled={isLoading} className="w-full !mt-6">
                            {isLoading ? 'Menulis Naskah...' : 'Weave Story (Buat Naskah)'}
                        </Button>
                    </div>
                </Card>
            </div>
            <div className="lg:col-span-3">
                <Card title="Storyboard Video">
                     {scenes.length > 0 && (
                        <div className="mb-4 grid grid-cols-2 lg:grid-cols-4 gap-2">
                            <Button onClick={handleGenerateAllImages} disabled={isGeneratingAll === 'images'} size="sm" variant="secondary" className="w-full">Buat Semua Gbr</Button>
                            <Button onClick={handleGenerateAllVideos} disabled={isGeneratingAll === 'videos'} size="sm" variant="secondary" className="w-full">Buat Semua Vid</Button>
                            <Button onClick={handlePlayAll} disabled={playAllState.isPlaying} size="sm" variant="secondary" className="w-full">Putar Semua</Button>
                            <Button onClick={handleMergeAndDownload} disabled={isProcessing || isLoading || !scenes.some(s=>s.status === 'done')} size="sm" variant="secondary" className="w-full">Gabungkan</Button>
                            <Button onClick={handleDownloadZip} disabled={isProcessing || isLoading || !scenes.some(s=>s.status === 'done')} size="sm" variant="secondary" className="w-full col-span-full mt-1">Unduh Proyek (ZIP)</Button>
                        </div>
                     )}
                     {playAllState.isPlaying && (
                        <div className="mb-4 relative">
                            <video ref={playAllPlayerRef} onEnded={handlePlaybackEnded} controls className="w-full aspect-video rounded-lg bg-black"/>
                            <Button onClick={handleStopPlayAll} size="sm" variant="secondary" className="!absolute top-2 right-2 !text-red-400">Stop</Button>
                        </div>
                     )}
                    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                        {scenes.map((scene, index) => (
                            <div key={scene.id} className="bg-black/20 p-3 rounded-lg animate-fade-in">
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-semibold text-green-400">Adegan {index + 1}</h4>
                                </div>
                                <textarea value={scene.prompt} onChange={(e) => setScenes(prev => prev.map(s => s.id === scene.id ? {...s, prompt: e.target.value} : s))} rows={3} className="w-full bg-slate-900/50 p-1 text-xs rounded mb-2"/>
                                
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="aspect-video bg-black rounded flex items-center justify-center relative group">
                                         <input type="file" ref={el => { imageInputRefs.current[scene.id] = el; }} onChange={(e) => handleSingleImageUpload(e, (img) => setScenes(p => p.map(s => s.id === scene.id ? {...s, imageUrl: img?.dataUrl, imageBase64: img?.base64, imageFileName: img?.name, status: 'image-done'} : s)), addLog)} accept="image/*" hidden />
                                        {scene.status === 'generating-image' && <LoadingIndicator statusText="Membuat..." />}
                                        {scene.imageUrl && <img src={scene.imageUrl} className="w-full h-full object-cover rounded" onClick={() => setModalImageUrl && setModalImageUrl(scene.imageUrl)} />}
                                        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                            <Button size="sm" variant="secondary" className="!p-1 h-6 w-6" onClick={() => imageInputRefs.current[scene.id]?.click()} title="Ganti Gambar"><i className="fa-solid fa-upload text-xs"></i></Button>
                                            <Button size="sm" variant="secondary" className="!p-1 h-6 w-6" onClick={() => handleGenerateSceneImage(scene.id, scene.prompt)} title="Buat Ulang Gambar"><i className="fa-solid fa-sync text-xs"></i></Button>
                                        </div>
                                    </div>
                                    <div className="aspect-video bg-black rounded flex items-center justify-center relative group">
                                        {(scene.status === 'generating-video') && <LoadingIndicator statusText="Membuat..." />}
                                        {scene.videoUrl && <video src={scene.videoUrl} controls className="w-full h-full rounded" onDoubleClick={() => setModalVideoUrl && setModalVideoUrl(scene.videoUrl!)} />}
                                        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button size="sm" variant="secondary" className="!p-1 h-6 w-6" onClick={() => handleGenerateSceneVideo(scene.id)} title="Buat Ulang Video"><i className="fa-solid fa-sync text-xs"></i></Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
        </div>
        
        {isImportModalOpen && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-fade-in" onClick={() => setIsImportModalOpen(false)}>
                <div className="bg-slate-800 p-6 rounded-lg w-full max-w-lg shadow-lg border border-slate-700 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                    <h2 className="text-xl font-bold text-green-400 mb-4 flex-shrink-0">Impor Karakter dari Universe</h2>
                    <div className="flex-grow overflow-y-auto pr-2 space-y-3">
                        {universe.characters.map(char => (
                            <div key={char.id} className="flex items-center gap-4 bg-slate-700 p-3 rounded-lg">
                                <input type="checkbox" id={`sw-import-${char.id}`} className="h-5 w-5 rounded bg-slate-900 text-green-600 focus:ring-green-500" checked={selectedCharIds.has(char.id)} onChange={() => handleImportCheckboxChange(char.id)} />
                                <img src={char.imageUrl || `https://via.placeholder.com/50/111827/4ade80?text=${char.name.charAt(0)}`} alt={char.name} className="w-12 h-12 rounded-md object-cover"/>
                                <div className="flex-grow">
                                    <label htmlFor={`sw-import-${char.id}`} className="font-semibold text-white cursor-pointer">{char.name}</label>
                                    <p className="text-xs text-gray-400 truncate">{char.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-end gap-2 mt-4 flex-shrink-0">
                        <Button variant="secondary" onClick={() => setIsImportModalOpen(false)}>Batal</Button>
                        <Button onClick={handleImportCharacters} disabled={selectedCharIds.size === 0}>Impor</Button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
};

export default StoryWeaverForm;