import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
// FIX: Import response types to fix type errors on API call results.
import { GoogleGenAI, Type, GenerateContentResponse, GenerateImagesResponse } from "@google/genai";
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import JSZip from 'jszip';
import { SharedFormProps, LtxProject, LtxScene, LtxCharacter, StoryCharacter, ASSET_STYLES, LtxTransition, VeoModel } from '../../types';
// FIX: Removed `generateVideo` from this import as it does not exist in the helpers file.
import { generateRandomString, getTimestamp, sanitizeFileName, triggerDownload, getFriendlyApiErrorMessage, base64ToBlob } from '../../utils/helpers';
// FIX: Imported the correct video generation function from the gemini service.
import { generateVideoForStory } from '../../services/geminiService';
import Card from '../Card';
import Button from '../Button';
import Input from '../Input';
import Select from '../Select';
import LoadingIndicator from '../LoadingIndicator';

interface CTLTXFormProps extends SharedFormProps {
    ltxProject: LtxProject;
    setLtxProject: React.Dispatch<React.SetStateAction<LtxProject>>;
    initialLtxProjectState: LtxProject;
}

const VEO_MODELS_LTX = [
    { value: 'veo-3.0-fast-generate-001', label: 'VEO 3.0 Fast' },
    { value: 'veo-3.0-generate-001', label: 'VEO 3.0' },
];

const GENRES = ["Sci-Fi", "Fantasy", "Horror", "Comedy", "Drama", "Action", "Thriller", "Documentary", "Animation", "Romance", "Custom..."];

const SortableSceneItem: React.FC<{
    scene: LtxScene;
    aspectRatio: string;
    onGenerateImage: (id: string) => void;
    onGenerateVideo: (id: string) => void;
    onPreview: (url: string) => void;
    onPromptChange: (id: string, field: 'description' | 'imagePrompt' | 'videoPrompt', value: string) => void;
    onTransitionChange: (id: string, transition: LtxTransition) => void;
    onImageUpload: (sceneId: string, imageData: { name: string; base64: string; mimeType: string; dataUrl: string; }) => void;
}> = ({ scene, aspectRatio, onGenerateImage, onGenerateVideo, onPreview, onPromptChange, onTransitionChange, onImageUpload }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: scene.id });
    const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
    const imageInputRef = useRef<HTMLInputElement>(null);

    const getStatusInfo = () => {
        switch (scene.status) {
            case 'pending': return { text: 'Menunggu', color: 'bg-gray-700 text-gray-300' };
            case 'generating-image': return { text: 'Membuat Gbr...', color: 'bg-yellow-500/20 text-yellow-300' };
            case 'image-done': return { text: 'Gbr Selesai', color: 'bg-sky-500/20 text-sky-300' };
            case 'generating-video': return { text: 'Membuat Vid...', color: 'bg-blue-500/20 text-blue-300' };
            case 'done': return { text: 'Selesai', color: 'bg-green-500/20 text-green-300' };
            case 'error': return { text: 'Error', color: 'bg-red-500/20 text-red-300' };
        }
    };
    const statusInfo = getStatusInfo();

    const isGenerating = scene.status === 'generating-image' || scene.status === 'generating-video';
    const canGenerateVideo = scene.status === 'image-done' || scene.status === 'done' || (scene.status === 'error' && !!scene.imageBase64);
    
    const processFile = (file: File) => {
        if (!file || !file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target?.result as string;
            const base64 = dataUrl.split(',')[1];
            if (base64) {
                onImageUpload(scene.id, { name: file.name, base64, mimeType: file.type, dataUrl });
            }
        };
        reader.readAsDataURL(file);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) processFile(e.target.files[0]);
    };
    
    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            processFile(e.dataTransfer.files[0]);
        }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
        const items = e.clipboardData.items;
        for (const item of items) {
            if (item.type.includes('image')) {
                const file = item.getAsFile();
                if (file) {
                    e.preventDefault();
                    processFile(file);
                    break;
                }
            }
        }
    };
    
    const aspectRatioClass = aspectRatio === '9:16' ? 'aspect-[9/16]' : 'aspect-video';

    return (
        <div ref={setNodeRef} style={style} className={`bg-slate-700 p-3 rounded-lg flex gap-4 items-start`}>
            <button {...attributes} {...listeners} className="cursor-grab touch-none p-2 text-gray-500 hover:text-white mt-8"><i className="fa-solid fa-grip-vertical"></i></button>
            <div 
                className={`${aspectRatioClass} w-1/3 bg-black rounded flex items-center justify-center relative group`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onPaste={handlePaste}
            >
                {isGenerating && <LoadingIndicator statusText={scene.status === 'generating-image' ? 'Menggambar...' : 'Merender...'} />}
                {scene.status === 'error' && <i className="fa-solid fa-exclamation-triangle text-red-400 text-2xl"></i>}
                {scene.videoUrl && <video src={scene.videoUrl + '#t=0.1'} className="w-full h-full rounded object-contain" preload="metadata" />}
                {scene.imageUrl && !scene.videoUrl && <img src={scene.imageUrl} alt={`Scene ${scene.sceneNumber}`} className="w-full h-full object-contain rounded" />}
                
                {!scene.imageUrl && !isGenerating && scene.status !== 'error' && (
                    <div 
                        className="w-full h-full border-2 border-dashed border-gray-600 rounded flex flex-col items-center justify-center text-gray-500 cursor-pointer hover:bg-gray-800 hover:border-amber-500"
                        onClick={() => imageInputRef.current?.click()}
                        tabIndex={0}
                    >
                        <i className="fa-solid fa-upload text-2xl"></i>
                        <p className="text-xs mt-2 text-center">Unggah / Seret / Tempel</p>
                    </div>
                )}

                {scene.videoUrl ? (
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <Button size="sm" onClick={() => onPreview(scene.videoUrl!)}>Pratinjau</Button>
                        <Button size="sm" variant="secondary" onClick={() => triggerDownload(scene.videoUrl!, scene.videoFileName || `scene_${scene.sceneNumber}.mp4`)} title="Unduh Klip">
                            <i className="fa-solid fa-download"></i>
                        </Button>
                    </div>
                ) : scene.imageUrl && (
                     <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Button size="sm" onClick={() => imageInputRef.current?.click()}>
                            <i className="fa-solid fa-sync-alt mr-2"></i> Ganti Gambar
                        </Button>
                    </div>
                )}
                 <input type="file" ref={imageInputRef} onChange={handleFileChange} accept="image/*" hidden />
            </div>
            <div className="w-2/3 space-y-2">
                <div className="flex justify-between items-center mb-1">
                    <h4 className="font-bold text-sm text-green-400">Adegan {scene.sceneNumber}</h4>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusInfo.color}`}>{statusInfo.text}</span>
                </div>
                
                <textarea
                    value={scene.description}
                    onChange={(e) => onPromptChange(scene.id, 'description', e.target.value)}
                    rows={2}
                    className="w-full bg-black/20 border border-transparent hover:border-slate-600 focus:border-green-500/50 rounded-md py-1 px-2 text-xs text-gray-400 focus:ring-0 focus:outline-none transition-colors"
                    placeholder="Deskripsi adegan..."
                />
                 <textarea
                    value={scene.imagePrompt}
                    onChange={(e) => onPromptChange(scene.id, 'imagePrompt', e.target.value)}
                    rows={2}
                    className="w-full bg-black/20 border border-transparent hover:border-slate-600 focus:border-green-500/50 rounded-md py-1 px-2 text-xs text-gray-400 focus:ring-0 focus:outline-none transition-colors"
                    placeholder="Prompt gambar..."
                />
                 <textarea
                    value={scene.videoPrompt}
                    onChange={(e) => onPromptChange(scene.id, 'videoPrompt', e.target.value)}
                    rows={2}
                    className="w-full bg-black/20 border border-transparent hover:border-slate-600 focus:border-green-500/50 rounded-md py-1 px-2 text-xs text-gray-400 focus:ring-0 focus:outline-none transition-colors"
                    placeholder="Prompt video..."
                />

                <div className="flex gap-2">
                    <Button onClick={() => onGenerateImage(scene.id)} size="sm" variant="secondary" className="w-full" disabled={isGenerating}>
                        {scene.imageUrl ? 'Ulang Gbr' : 'Buat Gbr'}
                    </Button>
                    <Button onClick={() => onGenerateVideo(scene.id)} size="sm" variant="secondary" className="w-full" disabled={isGenerating || !canGenerateVideo}>
                        {scene.videoUrl ? 'Ulang Vid' : 'Buat Vid'}
                    </Button>
                </div>
                <Select label="" id={`transition-${scene.id}`} value={scene.transition} onChange={e => onTransitionChange(scene.id, e.target.value as LtxTransition)} className="text-xs">
                    <option value="none">Transisi: Cut</option>
                    <option value="crossfade">Transisi: Crossfade</option>
                </Select>
            </div>
        </div>
    );
};

const CTLTXForm: React.FC<CTLTXFormProps> = ({
    ltxProject, setLtxProject, initialLtxProjectState,
    addLog, getNextApiKey, logUsage, universe, executeApiCallWithKeyRotation, addToMediaLibrary, runningRef, setStatus, setModalVideoUrl
}) => {
    const [isGeneratingScript, setIsGeneratingScript] = useState(false);
    const [isGeneratingAll, setIsGeneratingAll] = useState(false);
    const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
    
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [selectedCharIds, setSelectedCharIds] = useState<Set<string>>(new Set());
    
    const ffmpegRef = useRef<FFmpeg | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingProgress, setProcessingProgress] = useState(0);
    const [ffmpegLoadState, setFfmpegLoadState] = useState<'idle'|'loading'|'loaded'|'error'>('idle');

    // --- State for REFACTORED Sequential Player ---
    const [playAllState, setPlayAllState] = useState<{ isPlaying: boolean, currentIndex: number }>({ isPlaying: false, currentIndex: 0 });
    const playAllPlayerRef = useRef<HTMLVideoElement>(null);
    
    const updateProject = useCallback((updates: Partial<LtxProject> | ((prev: LtxProject) => LtxProject)) => {
        setLtxProject(prev => {
            const newState = typeof updates === 'function' ? updates(prev) : { ...prev, ...updates };
            return newState;
        });
    }, [setLtxProject]);
    
    const isVeo3Model = useMemo(() => ltxProject.videoModel.includes('veo-3.0'), [ltxProject.videoModel]);

    useEffect(() => {
        const model = ltxProject.videoModel;
        const currentAspectRatio = ltxProject.aspectRatio;
        const currentResolution = ltxProject.resolution;
        let updates: Partial<LtxProject> = {};

        if (model === 'veo-3.0-generate-001' && currentAspectRatio !== '16:9') {
            updates.aspectRatio = '16:9';
        } else if (model.includes('veo-3.0-fast') && !['16:9', '9:16'].includes(currentAspectRatio)) {
            updates.aspectRatio = '16:9';
        }
        
        if (model.includes('veo-3.0-fast') && currentResolution !== '720p') {
            updates.resolution = '720p';
        }
        
        if (currentAspectRatio !== '16:9' && currentResolution === '1080p') {
            updates.resolution = '720p';
        }

        if (Object.keys(updates).length > 0) {
            updateProject(updates);
        }
    }, [ltxProject.videoModel, ltxProject.aspectRatio, ltxProject.resolution, updateProject]);

    const aspectRatioOptions = useMemo(() => {
        if (ltxProject.videoModel === 'veo-3.0-generate-001') return ['16:9'];
        return ['16:9', '9:16'];
    }, [ltxProject.videoModel]);

    const resolutionOptions = useMemo(() => {
        if (ltxProject.videoModel.includes('veo-3.0-fast')) return ['720p'];
        return ['720p', '1080p'];
    }, [ltxProject.videoModel]);


    const loadFFmpeg = useCallback(async () => {
        if (ffmpegRef.current || ffmpegLoadState === 'loading' || ffmpegLoadState === 'loaded') {
            return ffmpegRef.current;
        }
        setFfmpegLoadState('loading');
        addLog('[CT-LTX] Memuat FFmpeg (sesuai permintaan)...', 'info');
        const newFFmpeg = new FFmpeg();
        newFFmpeg.on('log', ({ message }) => {
            // console.log(message); // Uncomment for deep debugging
        });
        newFFmpeg.on('progress', ({ progress }) => {
             setProcessingProgress(Math.min(99, Math.round(progress * 100)));
        });
        try {
            const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm";
            await newFFmpeg.load({
                coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
                wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
            });
            ffmpegRef.current = newFFmpeg;
            setFfmpegLoadState('loaded');
            addLog('[CT-LTX] FFmpeg berhasil dimuat.', 'info');
            return newFFmpeg;
        } catch (err: any) {
            setFfmpegLoadState('error');
            addLog(`[CT-LTX] Gagal memuat FFmpeg: ${err.message}.`, 'error');
            throw err;
        }
    }, [addLog, ffmpegLoadState]);


    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            updateProject(prev => ({
                ...prev,
                scenes: arrayMove(prev.scenes,
                    prev.scenes.findIndex(s => s.id === active.id),
                    prev.scenes.findIndex(s => s.id === over.id)
                ).map((scene, index) => ({ ...scene, sceneNumber: index + 1 }))
            }));
        }
    };

    const handleGenerateScript = async () => {
        setIsGeneratingScript(true);
        updateProject({ scenes: [] });
        addLog(`[CT-LTX] Membuat naskah untuk: "${ltxProject.title}"...`, 'status');
    
        try {
            // FIX: Explicitly type the API response to avoid type errors.
            const [parsed]: [any, any] = await executeApiCallWithKeyRotation(
                async (ai) => {
                    const charactersPrompt = ltxProject.characters.length > 0
                        ? `\n\n**Karakter yang Telah Ditentukan (WAJIB digunakan secara konsisten dalam naskah dan prompt visual):**\n${ltxProject.characters.map(c => `- ${c.name}: ${c.description}. Pakaian: ${c.clothing}. Ekspresi khas: ${c.expression}.`).join('\n')}`
                        : '';
                    const estimatedScenes = Math.ceil(parseFloat(ltxProject.duration) * (ltxProject.durationUnit === 'minutes' ? 2.5 : 0.1));
                    const directorPrompt = `Anda adalah sutradara dan penulis naskah film AI. Berdasarkan spesifikasi, tulis naskah yang dibagi menjadi ${estimatedScenes} adegan. Untuk setiap adegan, berikan 'description' (deskripsi naratif), 'imagePrompt' (prompt detail untuk gambar), 'videoPrompt' (prompt sinematik untuk video), dan 'audioPrompt' (ide suara). ${charactersPrompt}

Spesifikasi:
- Judul: ${ltxProject.title}, Genre: ${ltxProject.genre}, Gaya Visual: ${ltxProject.visualStyle}

FORMAT OUTPUT KRITIS: Kembalikan hasilnya sebagai objek JSON tunggal yang diminifikasi dengan satu kunci: "scenes". Nilai dari "scenes" harus berupa array berisi ${estimatedScenes} objek, di mana setiap objek berisi empat kunci string: "description", "imagePrompt", "videoPrompt", dan "audioPrompt".`;
                    
                    const response = await ai.models.generateContent({
                        model: 'gemini-2.5-flash', contents: directorPrompt,
                        config: { responseMimeType: 'application/json', responseSchema: { type: Type.OBJECT, properties: { scenes: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { description: { type: Type.STRING }, imagePrompt: { type: Type.STRING }, videoPrompt: { type: Type.STRING }, audioPrompt: { type: Type.STRING } } } } } } }
                    });
                    return JSON.parse(response.text.replace(/\\`\\`\\`json|\\`\\`\\`/g, '').trim());
                }, "Generate LTX Script"
            );
            
            if (!parsed.scenes || !Array.isArray(parsed.scenes)) throw new Error("Respon AI tidak berisi array 'scenes' yang valid.");
    
            const newScenes: LtxScene[] = parsed.scenes.map((data: any, i: number) => ({
                id: generateRandomString(8), sceneNumber: i + 1, status: 'pending', transition: 'crossfade', // Default to crossfade
                description: data.description || '', imagePrompt: data.imagePrompt || '', videoPrompt: data.videoPrompt || '', audioPrompt: data.audioPrompt || ''
            }));
            
            updateProject({ scenes: newScenes });
            addLog(`[CT-LTX] Naskah berhasil dibuat dengan ${newScenes.length} adegan.`, 'info');
            logUsage('text');
    
        } catch (error: any) {
            addLog(`[CT-LTX] Error membuat naskah: ${getFriendlyApiErrorMessage(error)}`, 'error');
        } finally {
            setIsGeneratingScript(false);
        }
    };

    const handleGenerateVisualsForScene = useCallback(async (sceneId: string, type: 'image' | 'video'): Promise<string | undefined> => {
        let scene: LtxScene | undefined;
        let project: LtxProject | undefined;
        
        setLtxProject(p => {
            project = p;
            scene = p.scenes.find(s => s.id === sceneId);
            return p;
        });
        
        await new Promise(resolve => setTimeout(resolve, 0));

        if (!scene || !project) {
            addLog(`[CT-LTX] Adegan ${sceneId} tidak ditemukan.`, 'error');
            return;
        }

        if (type === 'video' && !scene.imageBase64) {
            addLog(`[CT-LTX] Buat gambar terlebih dahulu untuk Adegan ${scene.sceneNumber}.`, 'warning');
            return;
        }
        
        const newStatus = type === 'image' ? 'generating-image' : 'generating-video';
        updateProject(p => ({ ...p, scenes: p.scenes.map(s => s.id === sceneId ? { ...s, status: newStatus } : s) }));
        addLog(`[CT-LTX] Adegan ${scene.sceneNumber}: Membuat ${type}...`, 'status');

        try {
            const charactersPrompt = project.characters.length > 0
                ? `\n\n**Character Consistency Info (CRITICAL):** You MUST adhere to these character descriptions.\n${project.characters.map(c => `- ${c.name}: ${c.description}. Clothing: ${c.clothing}. Expression: ${c.expression}.`).join('\n')}`
                : '';

            if (type === 'image') {
                const finalImagePrompt = `${scene.imagePrompt}${charactersPrompt}`;
                // FIX: Explicitly type the API response to avoid type errors.
                const [imageResponse]: [GenerateImagesResponse, any] = await executeApiCallWithKeyRotation(
                    (ai) => ai.models.generateImages({
                        model: 'imagen-4.0-generate-001', prompt: finalImagePrompt,
                        config: { numberOfImages: 1, aspectRatio: project!.aspectRatio as any, outputMimeType: 'image/png' }
                    }), `LTX Image Scene ${scene.sceneNumber}`
                );
                const imageBytes = imageResponse.generatedImages?.[0]?.image?.imageBytes;
                if (!imageBytes) throw new Error("Gagal membuat gambar.");
                const imageUrl = `data:image/png;base64,${imageBytes}`;
                const imageFileName = `${getTimestamp()}_ltx_scene_${scene.sceneNumber}_img.png`;
                updateProject(p => ({ ...p, scenes: p.scenes.map(s => s.id === sceneId ? { ...s, status: 'image-done', imageUrl, imageBase64: imageBytes, imageFileName } : s) }));
                logUsage('images');
                addToMediaLibrary({ type: 'image', previewUrl: imageUrl, prompt: scene.imagePrompt, model: 'imagen-4.0-generate-001', sourceComponent: 'CT-LTX', base64: imageBytes, mimeType: 'image/png' });
                return imageBytes;
            } else { // video
                const finalVideoPrompt = `${scene.videoPrompt}${charactersPrompt}`;
                const videoConfig: any = {
                    numberOfVideos: 1,
                    aspectRatio: project.aspectRatio,
                };
                if (isVeo3Model) {
                    videoConfig.resolution = project.resolution;
                }

                // FIX: Explicitly type the API response to avoid type errors.
                const [operation, { apiKey: videoApiKey }]: [any, any] = await executeApiCallWithKeyRotation(
                    // FIX: Changed to `generateVideoForStory` to match the correct imported function.
                    (ai) => generateVideoForStory(ai, project!.videoModel as VeoModel, {
                        prompt: finalVideoPrompt, 
                        image: { imageBytes: scene!.imageBase64!, mimeType: 'image/png' },
                        config: videoConfig
                    }, (msg) => addLog(`[CT-LTX Adegan ${scene!.sceneNumber}] ${msg}`, 'status')), 
                    `LTX Video Scene ${scene.sceneNumber}`
                );

                const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
                if (!downloadLink) throw new Error("Tidak ada URL unduhan video yang diterima.");

                const url = new URL(downloadLink);
                url.searchParams.set('key', videoApiKey!);
                const finalVideoUrl = url.toString();

                const videoResponse = await fetch(finalVideoUrl);
                if (!videoResponse.ok) {
                    const errorBody = await videoResponse.text();
                    throw new Error(`Gagal mengunduh video: ${videoResponse.status} ${errorBody}`);
                }

                const videoBlob = await videoResponse.blob();
                const videoUrl = URL.createObjectURL(videoBlob);
                const videoFileName = `${getTimestamp()}_ltx_scene_${scene.sceneNumber}_vid.mp4`;
                updateProject(p => ({ ...p, scenes: p.scenes.map(s => s.id === sceneId ? { ...s, status: 'done', videoUrl, videoFileName } : s) }));
                logUsage('videos');
                const reader = new FileReader();
                reader.readAsDataURL(videoBlob);
                reader.onloadend = () => addToMediaLibrary({ type: 'video', previewUrl: reader.result as string, prompt: scene!.videoPrompt, model: project!.videoModel, sourceComponent: 'CT-LTX', base64: (reader.result as string).split(',')[1], mimeType: 'video/mp4' });
            }
        } catch (err: any) {
            const friendlyError = getFriendlyApiErrorMessage(err);
            addLog(`[CT-LTX] Gagal pada Adegan ${scene.sceneNumber} (${type}): ${friendlyError}`, 'error');
            updateProject(p => ({...p, scenes: p.scenes.map(s => s.id === sceneId ? { ...s, status: 'error' } : s) }));
        }
    }, [setLtxProject, addLog, logUsage, addToMediaLibrary, executeApiCallWithKeyRotation, isVeo3Model, updateProject]);
    
    const handleGenerateAllVisuals = async () => {
        const scenesToProcess = ltxProject.scenes;
        if (scenesToProcess.length === 0) {
            addLog("[CT-LTX] Tidak ada adegan untuk diproses. Buat naskah terlebih dahulu.", 'info');
            return;
        }
        setIsGeneratingAll(true);
        setStatus('Running');
        runningRef.current = true;
        addLog(`[CT-LTX] Memulai pembuatan visual untuk ${scenesToProcess.length} adegan...`, 'status');
    
        for (const scene of scenesToProcess) {
            if (!runningRef.current) {
                addLog("[CT-LTX] Pembuatan dihentikan oleh pengguna.", "warning");
                break;
            }
            if (!scene.imageBase64 && scene.status !== 'done' && scene.status !== 'image-done') {
                 await handleGenerateVisualsForScene(scene.id, 'image');
            }
            let sceneForVideo: LtxScene | undefined;
            setLtxProject(currentProject => {
                sceneForVideo = currentProject.scenes.find(s => s.id === scene.id);
                return currentProject;
            });
            await new Promise(resolve => setTimeout(resolve, 0)); 
            
            if (sceneForVideo?.imageBase64 && !sceneForVideo.videoUrl) {
                await handleGenerateVisualsForScene(scene.id, 'video');
            }
        }
    
        setIsGeneratingAll(false);
        setStatus(runningRef.current ? 'Done' : 'Idle');
        runningRef.current = false;
        addLog('[CT-LTX] Proses pembuatan semua visual selesai.', 'info');
    };

    const handleGenerateAllVideos = async () => {
        const scenesToProcess = ltxProject.scenes.filter(s => s.imageBase64 && !s.videoUrl && s.status !== 'generating-video');
        if (scenesToProcess.length === 0) {
            addLog("[CT-LTX] Tidak ada adegan dengan gambar yang siap untuk pembuatan video.", 'warning');
            return;
        }
        setIsGeneratingAll(true);
        setStatus('Running');
        runningRef.current = true;
        addLog(`[CT-LTX] Memulai pembuatan video untuk ${scenesToProcess.length} adegan...`, 'status');
    
        for (const scene of scenesToProcess) {
            if (!runningRef.current) {
                addLog("[CT-LTX] Pembuatan video dihentikan oleh pengguna.", "warning");
                break;
            }
            await handleGenerateVisualsForScene(scene.id, 'video');
        }
        
        setIsGeneratingAll(false);
        setStatus(runningRef.current ? 'Done' : 'Idle');
        runningRef.current = false;
        addLog('[CT-LTX] Semua tugas pembuatan video telah selesai.', 'info');
    };
    

    const handleReset = () => {
        if (window.confirm("Apakah Anda yakin ingin memulai proyek baru? Semua perubahan yang belum disimpan akan hilang.")) {
            setLtxProject(initialLtxProjectState);
            addLog("[CT-LTX] Proyek baru dimulai.", 'info');
        }
    };

    const handleMergeClips = async () => {
        let ffmpeg = ffmpegRef.current;
        if (ffmpegLoadState !== 'loaded') {
            try {
                ffmpeg = await loadFFmpeg();
                if (!ffmpeg) throw new Error("FFmpeg instance is null after loading.");
            } catch (error) {
                addLog('[CT-LTX] Gagal memuat FFmpeg. Tidak dapat menggabungkan klip.', 'error');
                return;
            }
        }
        
        const scenesToMerge = ltxProject.scenes.filter(s => s.status === 'done' && s.videoUrl);
        if (scenesToMerge.length < 1) {
            addLog('[CT-LTX] Butuh setidaknya 1 klip video yang sudah dibuat untuk digabungkan.', 'warning');
            return;
        }
    
        setIsProcessing(true);
        addLog(`[CT-LTX] Memulai penggabungan untuk ${scenesToMerge.length} klip... Ini mungkin memakan waktu beberapa menit.`, 'status');
    
        try {
            const inputFiles: string[] = [];
            for (let i = 0; i < scenesToMerge.length; i++) {
                const scene = scenesToMerge[i];
                const fileName = `input${i}.mp4`;
                inputFiles.push(fileName);
                setProcessingProgress(Math.round(((i + 1) / (scenesToMerge.length + 1)) * 50));
                addLog(`[CT-LTX] Membaca klip ${i + 1} ke memori...`, 'info');
                const videoBlob = await fetch(scene.videoUrl!).then(res => res.blob());
                await ffmpeg!.writeFile(fileName, new Uint8Array(await videoBlob.arrayBuffer()));
            }
            
            addLog('[CT-LTX] Menggabungkan klip dengan FFmpeg... Ini adalah langkah terlama.', 'status');
            const outputFilename = `${sanitizeFileName(ltxProject.title || 'My_Movie')}.mp4`;
            const [w, h] = ltxProject.aspectRatio.split(':').map(Number);
            const targetHeight = ltxProject.resolution === '1080p' ? 1080 : 720;
            const targetWidth = Math.round((targetHeight * w / h) / 2) * 2; // Pastikan lebar genap
            
            let filterComplex = '';
            let concatInputs = '';
            let lastOutput = '0:v';

            for (let i = 0; i < scenesToMerge.length; i++) {
                const scene = scenesToMerge[i];
                const nextScene = scenesToMerge[i+1];

                // Scale and prepare current stream
                filterComplex += `[${i}:v]scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease,pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2,setsar=1[v${i}];`;

                if (scene.transition === 'crossfade' && nextScene) {
                    const duration = 0.5; // Crossfade duration in seconds
                    // We need video duration, which we don't have easily. Let's assume 4 seconds per clip for fades.
                    const assumedDuration = 4; 
                    const fadeStartTime = assumedDuration - duration;
                    filterComplex += `[v${i}]fade=t=out:st=${fadeStartTime}:d=${duration}[f${i}];`;
                    lastOutput = `f${i}`;
                } else {
                    lastOutput = `v${i}`;
                }
                concatInputs += `[${lastOutput}]`;
            }
            filterComplex += `${concatInputs}concat=n=${scenesToMerge.length}:v=1:a=0[v]`;

            const ffmpegInputs = inputFiles.flatMap(name => ['-i', name]);
            const command = scenesToMerge.length === 1 
                ? ['-i', 'input0.mp4', '-vf', `scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease,pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2,setsar=1`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', outputFilename]
                : [...ffmpegInputs, '-filter_complex', filterComplex, '-map', '[v]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', outputFilename];
            
            await ffmpeg!.exec(command);
            
            setProcessingProgress(100);
            addLog('[CT-LTX] Penggabungan selesai. Membaca file output...', 'info');
            const data = await ffmpeg!.readFile(outputFilename);
            
            triggerDownload(URL.createObjectURL(new Blob([data], { type: 'video/mp4' })), outputFilename);
            addLog(`[CT-LTX] Unduhan dimulai untuk "${outputFilename}".`, 'info');

            for(const fileName of inputFiles) await ffmpeg!.deleteFile(fileName);
    
        } catch (error: any) {
            addLog(`[CT-LTX] Error saat penggabungan: ${error.message}`, 'error');
            console.error("FFMPEG Error:", error);
        } finally {
            setIsProcessing(false);
            setProcessingProgress(0);
        }
    };
    
    const handleDownloadZip = async () => {
        const scenesToZip = ltxProject.scenes.filter(s => s.imageUrl && s.videoUrl);
        if (scenesToZip.length === 0) { addLog("[CT-LTX] Tidak ada adegan yang selesai untuk di-zip.", 'warning'); return; }
        setIsProcessing(true);
        addLog(`[CT-LTX] Menyiapkan file ZIP...`, 'status');
        try {
            const zip = new JSZip();
            let scriptContent = `Proyek: ${ltxProject.title}\n\n`;
            scenesToZip.forEach(s => {
                scriptContent += `--- ADEGAN ${s.sceneNumber} ---\nDeskripsi: ${s.description}\nPrompt Gbr: ${s.imagePrompt}\nPrompt Vid: ${s.videoPrompt}\n\n`;
            });
            zip.file("naskah_dan_prompt.txt", scriptContent);
            const imageFolder = zip.folder("images");
            const videoFolder = zip.folder("videos");
            for (let i = 0; i < scenesToZip.length; i++) {
                const scene = scenesToZip[i];
                setProcessingProgress(Math.round(((i + 1) / scenesToZip.length) * 100));
                if (scene.imageUrl) imageFolder?.file(scene.imageFileName || `scene_${scene.sceneNumber}_img.png`, await fetch(scene.imageUrl).then(res => res.blob()));
                if (scene.videoUrl) videoFolder?.file(scene.videoFileName || `scene_${scene.sceneNumber}_vid.mp4`, await fetch(scene.videoUrl).then(res => res.blob()));
            }
            addLog('[ZIP] Mengompres file...', 'status');
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            triggerDownload(URL.createObjectURL(zipBlob), `LTX-Proyek_${sanitizeFileName(ltxProject.title)}.zip`);
            addLog(`[ZIP] Unduhan dimulai.`, 'info');
        } catch (error: any) {
            addLog(`[ZIP] Error saat membuat ZIP: ${error.message}`, 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleImportCharacters = () => {
        const charsToImport = universe.characters.filter(c => selectedCharIds.has(c.id));
        const existingIds = new Set(ltxProject.characters.map(c => c.id));
        const newChars = charsToImport.filter(c => !existingIds.has(c.id));
        updateProject({ characters: [...ltxProject.characters, ...newChars] });
        addLog(`[CT-LTX] Mengimpor ${newChars.length} karakter ke proyek.`, 'info');
        setIsImportModalOpen(false);
        setSelectedCharIds(new Set());
    };

    const handleRemoveCharacter = (id: string) => updateProject({ characters: ltxProject.characters.filter(c => c.id !== id) });
    
    // --- REFACTORED "PLAY ALL" LOGIC ---
    const scenesWithVideo = useMemo(() => ltxProject.scenes.filter(s => s.videoUrl), [ltxProject.scenes]);

    const handleStopPlayAll = useCallback(() => {
        setPlayAllState({ isPlaying: false, currentIndex: 0 });
        const player = playAllPlayerRef.current;
        if (player) {
            player.pause();
            player.removeAttribute('src');
            player.load();
        }
    }, []);

    const handlePlayAll = () => {
        if (scenesWithVideo.length === 0) {
            addLog("[CT-LTX] Tidak ada klip yang selesai untuk diputar.", 'warning');
            return;
        }
        addLog('[CT-LTX] Memulai pemutaran semua klip...', 'info');
        setPlayAllState({ isPlaying: true, currentIndex: 0 });
    };

    const handlePlaybackEnded = useCallback(() => {
        setPlayAllState(prev => {
            const nextIndex = prev.currentIndex + 1;
            if (nextIndex >= scenesWithVideo.length) {
                addLog('[CT-LTX] Pemutaran selesai.', 'info');
                return { isPlaying: false, currentIndex: 0 };
            }
            return { ...prev, currentIndex: nextIndex };
        });
    }, [scenesWithVideo.length]);

    useEffect(() => {
        const player = playAllPlayerRef.current;
        if (!player || !playAllState.isPlaying) {
            if (player && !playAllState.isPlaying) {
                player.pause();
            }
            return;
        }

        const sceneToPlay = scenesWithVideo[playAllState.currentIndex];
        if (!sceneToPlay) {
            handleStopPlayAll();
            return;
        }

        player.src = sceneToPlay.videoUrl!;
        player.play().catch(e => {
            addLog(`[CT-LTX] Gagal memutar video secara otomatis: ${e.message}`, 'warning');
            handleStopPlayAll();
        });

    }, [playAllState, scenesWithVideo, handleStopPlayAll]);


    const handleScenePromptChange = (id: string, field: 'description' | 'imagePrompt' | 'videoPrompt', value: string) => {
        updateProject(prev => ({ ...prev, scenes: prev.scenes.map(scene => scene.id === id ? { ...scene, [field]: value } : scene) }));
    };

    const handleTransitionChange = (id: string, transition: LtxTransition) => {
        updateProject(prev => ({ ...prev, scenes: prev.scenes.map(scene => scene.id === id ? { ...scene, transition } : scene) }));
    };

    const handleImageUploadForScene = (sceneId: string, imageData: { name: string; base64: string; mimeType: string; dataUrl: string; }) => {
        updateProject(prev => ({
            ...prev,
            scenes: prev.scenes.map(scene => {
                if (scene.id === sceneId) {
                    return {
                        ...scene,
                        imageUrl: imageData.dataUrl,
                        imageBase64: imageData.base64,
                        imageFileName: sanitizeFileName(imageData.name),
                        status: 'image-done',
                    };
                }
                return scene;
            })
        }));
        addLog(`[CT-LTX] Gambar "${imageData.name}" diunggah untuk adegan.`, 'info');
    };
    
    const handleAddManualScene = () => {
        const newScene: LtxScene = {
            id: generateRandomString(8),
            sceneNumber: ltxProject.scenes.length + 1,
            description: '',
            imagePrompt: '',
            videoPrompt: '',
            audioPrompt: '',
            status: 'pending',
            transition: 'crossfade',
        };
        updateProject(prev => ({ ...prev, scenes: [...prev.scenes, newScene] }));
        addLog('[CT-LTX] Adegan manual baru ditambahkan.', 'info');
    };

    const CATEGORIES = ["Short Film", "Advertisement", "Music Video", "Tutorial", "Vlog", "Custom..."];

    return (
        <>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 animate-fade-in">
            <div className="lg:col-span-2 space-y-6">
                <Card title="Pengaturan Proyek" headerAction={<Button onClick={handleReset} size="sm" variant="secondary">Proyek Baru</Button>}>
                    <div className="space-y-4">
                        <Input label="Judul Film" id="ltxTitle" value={ltxProject.title} onChange={e => updateProject({ title: e.target.value })} />
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Select label="Kategori" id="ltxCategory" value={!CATEGORIES.includes(ltxProject.category) ? 'Custom...' : ltxProject.category} onChange={e => updateProject({ category: e.target.value })}>
                                    {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                </Select>
                                {(!CATEGORIES.includes(ltxProject.category)) && (
                                    <Input label="" id="ltxCustomCategory" value={ltxProject.category} onChange={e => updateProject({ category: e.target.value })} wrapperClassName="mt-2" placeholder="Kategori Kustom" />
                                )}
                            </div>
                            <div>
                                <Select label="Genre" id="ltxGenreSelect" value={GENRES.includes(ltxProject.genre) ? ltxProject.genre : 'Custom...'} onChange={e => updateProject({ genre: e.target.value === 'Custom...' ? '' : e.target.value })}>
                                    {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                                </Select>
                                {!GENRES.includes(ltxProject.genre) && <Input label="" id="ltxCustomGenre" value={ltxProject.genre} onChange={e => updateProject({ genre: e.target.value })} wrapperClassName="mt-2" placeholder="Custom Genre" />}
                            </div>
                        </div>
                        <div>
                             <Select label="Gaya Visual" id="ltxVisualStyle" value={!ASSET_STYLES.includes(ltxProject.visualStyle) ? 'Custom...' : ltxProject.visualStyle} onChange={e => updateProject({ visualStyle: e.target.value })}>
                                {ASSET_STYLES.map(style => <option key={style} value={style}>{style}</option>)}
                                <option value="Custom...">Custom...</option>
                            </Select>
                            {(!ASSET_STYLES.includes(ltxProject.visualStyle)) && <Input label="" id="ltxCustomVisualStyle" value={ltxProject.visualStyle} onChange={e => updateProject({ visualStyle: e.target.value })} wrapperClassName="mt-2" placeholder="Gaya Visual Kustom" />}
                        </div>
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-700">
                            <Select label="Rasio Aspek" id="ltxAspectRatio" value={ltxProject.aspectRatio} onChange={e => updateProject({ aspectRatio: e.target.value })} disabled={aspectRatioOptions.length === 1}>
                                {aspectRatioOptions.map(r => <option key={r} value={r}>{r}</option>)}
                            </Select>
                            {isVeo3Model && (
                                <Select label="Resolusi" id="ltxResolution" value={ltxProject.resolution} onChange={e => updateProject({ resolution: e.target.value as '720p' | '1080p' })} disabled={resolutionOptions.length === 1 || (ltxProject.aspectRatio !== '16:9' && ltxProject.resolution === '1080p')}>
                                    {resolutionOptions.map(r => <option key={r} value={r} disabled={r === '1080p' && ltxProject.aspectRatio !== '16:9'}>{r}{r === '1080p' && ltxProject.aspectRatio !== '16:9' ? ' (hanya 16:9)' : ''}</option>)}
                                </Select>
                            )}
                        </div>
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* FIX: Cast the value from the select onChange event to VeoModel to fix type error. */}
                            <Select label="Model Video" id="ltxVideoModel" value={ltxProject.videoModel} onChange={e => updateProject({ videoModel: e.target.value as VeoModel })}>
                                {VEO_MODELS_LTX.map(model => <option key={model.value} value={model.value}>{model.label}</option>)}
                            </Select>
                             <Input label="Target Durasi" id="ltxDuration" type="number" min="1" value={ltxProject.duration} onChange={e => updateProject({ duration: e.target.value })} />
                             {/* FIX: Cast value to the correct type to resolve type error. */}
                             <Select label="Unit" id="ltxDurationUnit" value={ltxProject.durationUnit} onChange={e => updateProject({ durationUnit: e.target.value as 'seconds' | 'minutes' })}><option value="seconds">Seconds</option><option value="minutes">Minutes</option></Select>
                        </div>
                         <div className="pt-4 border-t border-slate-700">
                            <h4 className="text-sm font-semibold text-green-400 mb-2">Karakter dalam Cerita Ini</h4>
                            <div className="space-y-2 max-h-32 overflow-y-auto pr-2">
                                {ltxProject.characters.length === 0 ? <p className="text-xs text-center text-gray-400">Tidak ada karakter yang diimpor.</p> :
                                ltxProject.characters.map(char => (
                                    <div key={char.id} className="flex items-center gap-2 bg-slate-700 p-2 rounded">
                                        <img src={char.imageUrl || `https://via.placeholder.com/32/030712/4ade80?text=${char.name.charAt(0)}`} alt={char.name} className="w-8 h-8 rounded-full object-cover" />
                                        <p className="flex-grow text-sm text-white truncate">{char.name}</p>
                                        <Button onClick={() => handleRemoveCharacter(char.id)} size="sm" variant="secondary" className="!p-0 h-6 w-6 flex-shrink-0 text-red-400" title="Remove"><i className="fa-solid fa-times text-xs"></i></Button>
                                    </div>
                                ))}
                            </div>
                            <Button onClick={() => setIsImportModalOpen(true)} variant="secondary" size="sm" className="w-full mt-2">Impor dari Universe</Button>
                        </div>
                    </div>
                </Card>
                 <Card title="Tindakan">
                    <div className="space-y-3">
                         <Button onClick={handleGenerateScript} disabled={isGeneratingScript || isGeneratingAll} className="w-full">
                            {isGeneratingScript ? 'Menulis Naskah...' : '1. Buat Naskah Otomatis'}
                        </Button>
                         <Button onClick={handleGenerateAllVisuals} disabled={isGeneratingScript || isGeneratingAll || ltxProject.scenes.length === 0} className="w-full">
                            {isGeneratingAll ? 'Membuat Visual...' : '2a. Buat Gambar & Video Otomatis'}
                        </Button>
                        <Button onClick={handleGenerateAllVideos} disabled={isGeneratingScript || isGeneratingAll || !ltxProject.scenes.some(s => !!s.imageBase64)} className="w-full" variant="secondary">
                            2b. Buat Video dari Gambar yang Ada
                        </Button>
                         <div className="pt-3 border-t border-slate-700 space-y-3">
                             <Button onClick={handleMergeClips} disabled={isProcessing || isGeneratingAll || ffmpegLoadState === 'error' || !ltxProject.scenes.some(s => s.status === 'done' && s.videoUrl)} className="w-full" variant="secondary">
                                <i className="fa-solid fa-film mr-2"></i>{ffmpegLoadState === 'loading' ? 'Memuat FFmpeg...' : 'Gabungkan Klip'}
                            </Button>
                             <Button onClick={handleDownloadZip} disabled={isProcessing || !ltxProject.scenes.some(s => s.status === 'done')} className="w-full" variant="secondary">
                                <i className="fa-solid fa-file-zipper mr-2"></i>Unduh Proyek (.zip)
                            </Button>
                            {isProcessing && (
                                <div className="mt-2 text-center">
                                    <progress value={processingProgress} max="100" className="w-full h-2 rounded-full accent-green-500"></progress>
                                    <p className="text-xs text-gray-400">{processingProgress}%</p>
                                </div>
                            )}
                        </div>
                    </div>
                </Card>
            </div>
            <div className="lg:col-span-3">
                <Card title="Timeline & Pratinjau">
                    <div className="aspect-video bg-black rounded-md relative">
                        <video ref={playAllPlayerRef} onEnded={handlePlaybackEnded} className="w-full h-full rounded" playsInline controls={!playAllState.isPlaying} />
                        {!playAllState.isPlaying && (
                             <div className="text-center text-gray-600 absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <i className="fa-solid fa-play-circle text-4xl mb-2"></i>
                                <p>Pratinjau akan diputar di sini</p>
                            </div>
                        )}
                    </div>
                     <div className="mt-4 flex gap-2">
                        <Button onClick={handlePlayAll} disabled={isGeneratingAll || !scenesWithVideo.length || playAllState.isPlaying} className="w-full">
                            <i className="fa-solid fa-play mr-2"></i> Putar Semua Klip
                        </Button>
                        {playAllState.isPlaying && (
                            <Button onClick={handleStopPlayAll} variant="secondary" className="w-full !text-red-400">
                                <i className="fa-solid fa-stop mr-2"></i> Berhenti
                            </Button>
                        )}
                    </div>
                    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 mt-4">
                        {ltxProject.scenes.length === 0 ? (
                            <div className="text-center text-gray-600 py-16">
                                <i className="fa-solid fa-film text-5xl"></i>
                                <p className="mt-4">Buat naskah secara otomatis atau tambahkan adegan secara manual.</p>
                                <Button onClick={handleAddManualScene} variant="secondary" className="mt-4">
                                    <i className="fa-solid fa-plus mr-2"></i> Tambah Adegan Manual Pertama
                                </Button>
                            </div>
                        ) : (
                            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                <SortableContext items={ltxProject.scenes.map(s => s.id)} strategy={verticalListSortingStrategy}>
                                    {ltxProject.scenes.map(scene => (
                                        <SortableSceneItem 
                                            key={scene.id} scene={scene} 
                                            aspectRatio={ltxProject.aspectRatio}
                                            onGenerateImage={() => handleGenerateVisualsForScene(scene.id, 'image')}
                                            onGenerateVideo={() => handleGenerateVisualsForScene(scene.id, 'video')}
                                            onPreview={(url) => setModalVideoUrl?.(url)} 
                                            onPromptChange={handleScenePromptChange}
                                            onTransitionChange={handleTransitionChange}
                                            onImageUpload={handleImageUploadForScene}
                                        />
                                    ))}
                                </SortableContext>
                            </DndContext>
                        )}
                         {ltxProject.scenes.length > 0 && (
                            <Button onClick={handleAddManualScene} variant="secondary" className="w-full mt-2">
                                <i className="fa-solid fa-plus mr-2"></i> Tambah Adegan Manual
                            </Button>
                        )}
                    </div>
                </Card>
            </div>
        </div>
        
        {isImportModalOpen && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-fade-in" onClick={() => setIsImportModalOpen(false)}>
                <div className="bg-slate-800 p-6 rounded-lg w-full max-w-lg shadow-lg border border-slate-700 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                    <h2 className="text-xl font-bold text-green-400 mb-4 flex-shrink-0">Impor Karakter dari Universe</h2>
                    <div className="flex-grow overflow-y-auto pr-2 space-y-3">
                        {universe.characters.length === 0 ? <p className="text-center text-gray-400 py-8">Universe Anda kosong.</p> : universe.characters.map(char => (
                            <div key={char.id} className="flex items-center gap-4 bg-slate-700 p-3 rounded-lg">
                                <input type="checkbox" id={`import-${char.id}`} className="h-5 w-5 rounded bg-slate-900 text-green-600 focus:ring-green-500" checked={selectedCharIds.has(char.id)} onChange={() => { const newSet = new Set(selectedCharIds); if (newSet.has(char.id)) newSet.delete(char.id); else newSet.add(char.id); setSelectedCharIds(newSet); }} />
                                <img src={char.imageUrl || `https://via.placeholder.com/50/111827/4ade80?text=${char.name.charAt(0)}`} alt={char.name} className="w-12 h-12 rounded-md object-cover"/>
                                <div className="flex-grow">
                                    <label htmlFor={`import-${char.id}`} className="font-semibold text-white cursor-pointer">{char.name}</label>
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

export default CTLTXForm;
