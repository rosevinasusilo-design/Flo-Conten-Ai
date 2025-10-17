import React, { useState, useCallback, useRef } from 'react';
import { useApiKey } from '../contexts/ApiKeyContext';
import { useLanguage } from '../contexts/LanguageContext';
import SelectInput from './SelectInput';
import TextInput from './TextInput';
import TextAreaInput from './TextAreaInput';
import Button from './Button';
import { Spinner } from './Spinner';
import { SparklesIcon, VideoIcon, DownloadIcon } from './icons';
import { analyzeProductForAdCreative, generateMultiSceneAdScript, generateVideo } from '../services/geminiService';
import VideoPlayer from './VideoPlayer';
import type { ImageInput, AspectRatio, VeoModel, AdCreativeAnalysis, AdStrategy } from '../types';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import { ImageUploader } from './ImageUploader';

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

const videoStyleOptions = [
    { value: 'Dynamic & Fast-Paced', label: 'Dinamis & Cepat' },
    { value: 'Cinematic & Elegant', label: 'Sinematik & Elegan' },
    { value: 'Minimalist & Clean', label: 'Minimalis & Bersih' },
    { value: 'Funny & Viral-style', label: 'Lucu & Gaya Viral' },
    { value: 'UGC (User-Generated Content) style', label: 'Gaya UGC' },
];

interface SceneResult {
    id: number;
    prompt: string;
    status: 'pending' | 'generating' | 'done' | 'error';
    videoUrl?: string;
}

const VideoGenerator: React.FC = () => {
    const { apiKey, isApiKeySet } = useApiKey();
    const { t } = useLanguage();

    // Step management
    const [step, setStep] = useState<'idle' | 'analyzing' | 'ready' | 'generating_video' | 'done'>('idle');
    const [loadingStatus, setLoadingStatus] = useState('');
    const [error, setError] = useState<string | null>(null);

    // Inputs
    const [productLink, setProductLink] = useState('');
    const [productImageFile, setProductImageFile] = useState<File[]>([]);
    const [productImage, setProductImage] = useState<ImageInput | null>(null);
    
    // Analysis & Creative Direction
    const [analysis, setAnalysis] = useState<AdCreativeAnalysis | null>(null);
    
    // Form fields (can be edited by user)
    const [targetAudience, setTargetAudience] = useState('');
    const [videoStyle, setVideoStyle] = useState('Dynamic & Fast-Paced');
    const [adStrategy, setAdStrategy] = useState<AdStrategy>('default');
    const [sellingPoints, setSellingPoints] = useState('');
    const [cta, setCta] = useState('');
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16');

    // Outputs
    const [scenes, setScenes] = useState<SceneResult[]>([]);
    const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);

    // FFmpeg
    const ffmpegRef = useRef<FFmpeg | null>(null);
    const [isMerging, setIsMerging] = useState(false);

    const adStrategyOptions: { value: AdStrategy, label: string }[] = [
        { value: 'default', label: t('adStrategyDefault') },
        { value: 'problem-solution', label: t('adStrategyProblemSolution') },
        { value: 'benefit-driven', label: t('adStrategyBenefitDriven') },
        { value: 'ugc-testimonial', label: t('adStrategyUgc') },
        { value: 'unboxing', label: t('adStrategyUnboxing') },
    ];

    const resetState = () => {
        setStep('idle');
        setLoadingStatus('');
        setError(null);
        setAnalysis(null);
        setScenes([]);
        setFinalVideoUrl(null);
        setTargetAudience('');
        setVideoStyle('Dynamic & Fast-Paced');
        setSellingPoints('');
        setCta('');
        setAdStrategy('default');
    };
    
    const handleProductImageChange = useCallback(async (files: File[]) => {
        setProductImageFile(files);
        if (files.length > 0) {
            const img = await fileToImageInput(files[0]);
            setProductImage(img);
        } else {
            setProductImage(null);
        }
    }, []);

    const loadFFmpeg = useCallback(async () => {
        if (ffmpegRef.current) return ffmpegRef.current;
        const ffmpeg = new FFmpeg();
        ffmpeg.on('log', ({ message }) => console.log(message));
        const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm";
        await ffmpeg.load({
            coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
            wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });
        ffmpegRef.current = ffmpeg;
        return ffmpeg;
    }, []);

    const handleAnalyze = async () => {
        if (!isApiKeySet || !productLink || !productImage) return;

        // Reset part of the state, but keep inputs
        setStep('analyzing');
        setLoadingStatus('Menganalisis link produk...');
        setError(null);
        setAnalysis(null);
        setScenes([]);
        setFinalVideoUrl(null);
        
        try {
            const result = await analyzeProductForAdCreative(apiKey, productLink);
            setAnalysis(result);
            setTargetAudience(result.targetAudience);
            setVideoStyle(result.videoStyle);
            setSellingPoints(result.sellingPoints.join(', '));
            setCta(result.cta);
            
            setStep('ready');
            setLoadingStatus('');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Terjadi kesalahan tidak diketahui saat analisis.');
            setStep('idle');
            setLoadingStatus('');
        }
    };
    
    const handleGenerateVideo = async () => {
        if (!analysis || !productImage) return;

        setStep('generating_video');
        setError(null);
        setFinalVideoUrl(null);

        try {
            setLoadingStatus('Menulis naskah video 4 adegan...');
            const scenePrompts = await generateMultiSceneAdScript(apiKey, {
                productName: analysis.productName,
                targetAudience, videoStyle, sellingPoints: sellingPoints.split(','), cta
            }, aspectRatio, adStrategy);

            setScenes(scenePrompts.map((p, i) => ({ id: i, prompt: p, status: 'pending' })));

            const generatedScenes: SceneResult[] = [];
            for (let i = 0; i < scenePrompts.length; i++) {
                setLoadingStatus(`Membuat video untuk adegan ${i + 1} dari 4...`);
                setScenes(prev => prev.map(s => s.id === i ? { ...s, status: 'generating' } : s));

                try {
                    const videoUrl = await generateVideo(
                        apiKey,
                        { prompt: scenePrompts[i], imageBase64: productImage.data, imageMimeType: productImage.mimeType, model: 'veo-3.1-fast-generate-preview' },
                        aspectRatio,
                        false, '720p', 'none', 'Cinematic'
                    );
                    const newScene: SceneResult = { id: i, prompt: scenePrompts[i], status: 'done', videoUrl };
                    generatedScenes.push(newScene);
                    setScenes(prev => prev.map(s => s.id === i ? newScene : s));
                } catch (sceneError) {
                     console.error(`Error generating scene ${i+1}:`, sceneError);
                     const errorScene: SceneResult = { id: i, prompt: scenePrompts[i], status: 'error' };
                     generatedScenes.push(errorScene);
                     setScenes(prev => prev.map(s => s.id === i ? errorScene : s));
                     throw new Error(`Gagal membuat video untuk adegan ${i+1}. Proses dihentikan.`);
                }
            }

            setStep('done');
            setLoadingStatus('');

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Gagal membuat video.');
            setStep('ready');
            setLoadingStatus('');
        }
    };
    
    const handleMergeVideos = async () => {
        const videoScenes = scenes.filter(s => s.status === 'done' && s.videoUrl);
        if (videoScenes.length !== 4) {
            setError('Tidak semua 4 adegan berhasil dibuat untuk digabungkan.');
            return;
        }

        setIsMerging(true);
        setLoadingStatus('Menggabungkan video...');
        try {
            const ffmpeg = await loadFFmpeg();
            let fileListContent = '';

            for (let i = 0; i < videoScenes.length; i++) {
                const scene = videoScenes[i];
                const fileName = `scene_${i}.mp4`;
                const videoBlob = await fetch(scene.videoUrl!).then(r => r.blob());
                await ffmpeg.writeFile(fileName, new Uint8Array(await videoBlob.arrayBuffer()));
                fileListContent += `file '${fileName}'\n`;
            }

            await ffmpeg.writeFile('filelist.txt', fileListContent);
            await ffmpeg.exec(['-f', 'concat', '-safe', '0', '-i', 'filelist.txt', '-c', 'copy', 'output.mp4']);
            
            const data = await ffmpeg.readFile('output.mp4');
            const mergedBlob = new Blob([data], { type: 'video/mp4' });
            setFinalVideoUrl(URL.createObjectURL(mergedBlob));

        } catch(err) {
            setError(err instanceof Error ? err.message : 'Gagal menggabungkan video.');
        } finally {
            setIsMerging(false);
            setLoadingStatus('');
        }
    };

    const isLoading = step === 'analyzing' || step === 'generating_video' || isMerging;

    return (
        <div className="h-full overflow-y-auto bg-dots-pattern p-6 lg:p-10">
            <div className="max-w-6xl mx-auto space-y-8">
                {/* 1. Input Section */}
                <div className="bg-gray-800/50 backdrop-blur-sm p-6 space-y-6 border border-gray-700 rounded-2xl">
                    <header>
                        <h1 className="text-2xl font-bold text-white">1. Analisa & Persiapan</h1>
                        <p className="text-sm text-gray-400">Masukkan link dan gambar produk Anda. AI akan menganalisisnya untuk membuatkan iklan.</p>
                    </header>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <div className="space-y-4">
                            <TextInput
                                label="Link Produk"
                                value={productLink}
                                onChange={(e) => setProductLink(e.target.value)}
                                placeholder="https://tokopedia.com/..."
                                className="!bg-gray-900"
                                disabled={isLoading}
                            />
                             <ImageUploader 
                                label="Gambar Produk Utama"
                                files={productImageFile}
                                onFilesChange={handleProductImageChange}
                                maxFiles={1}
                                disabled={isLoading}
                             />
                        </div>
                        <div className="flex items-center justify-center">
                             <Button onClick={handleAnalyze} disabled={isLoading || !isApiKeySet || !productLink.trim() || !productImage} className="w-full h-full text-lg">
                                {step === 'analyzing' ? <Spinner /> : <SparklesIcon className="w-5 h-5" />}
                                Analisa & Siapkan
                            </Button>
                        </div>
                    </div>
                </div>

                 {/* Global Status/Error */}
                {isLoading && <div className="text-center text-white p-4"><Spinner className="w-8 h-8 mx-auto" /><p className="mt-2 text-lg font-medium">{loadingStatus}</p></div>}
                {error && <div className="text-center text-red-400 p-4 bg-red-900/30 rounded-lg"><h3 className="font-bold">Terjadi Kesalahan</h3><p>{error}</p><button onClick={() => { setError(null); setStep('idle');}} className="mt-2 text-sm text-gray-300 underline">Coba Lagi</button></div>}

                {/* 2. Creative Direction Section */}
                {(step === 'ready' || step === 'generating_video' || step === 'done') && analysis && productImage && (
                    <div className="bg-gray-800/50 backdrop-blur-sm p-6 space-y-6 border border-gray-700 rounded-2xl animate-fade-in-fast">
                        <h2 className="text-2xl font-bold text-white">2. Arahan Kreatif (Disarankan AI)</h2>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <h3 className="font-semibold text-lg text-emerald-400">Gambar Referensi Utama</h3>
                                <div className="aspect-square bg-gray-900 rounded-lg flex items-center justify-center p-2">
                                     <img src={`data:${productImage.mimeType};base64,${productImage.data}`} className="max-w-full max-h-full object-contain rounded-md" />
                                </div>
                            </div>
                            <div className="space-y-4">
                                <h3 className="font-semibold text-lg text-emerald-400">Strategi Video</h3>
                                <SelectInput
                                    label={t('adStrategyLabel')}
                                    value={adStrategy}
                                    onChange={setAdStrategy}
                                    options={adStrategyOptions}
                                    disabled={isLoading}
                                />
                                <TextInput label="Target Audiens" value={targetAudience} onChange={e => setTargetAudience(e.target.value)} disabled={isLoading} />
                                <SelectInput label="Gaya Video" value={videoStyle} onChange={setVideoStyle} options={videoStyleOptions} disabled={isLoading} />
                                <TextAreaInput label="Poin Penjualan Utama" value={sellingPoints} onChange={setSellingPoints} rows={3} disabled={isLoading} />
                                <TextInput label="Call to Action (CTA)" value={cta} onChange={e => setCta(e.target.value)} disabled={isLoading} />
                                 <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">Aspek Rasio</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {(['9:16', '1:1', '16:9'] as AspectRatio[]).map(ratio => (
                                            <button type="button" key={ratio} onClick={() => setAspectRatio(ratio)} disabled={isLoading} className={`py-2 text-sm font-semibold rounded-md transition-colors ${aspectRatio === ratio ? 'bg-emerald-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>{ratio}</button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="pt-6 border-t border-gray-700">
                             <Button onClick={handleGenerateVideo} disabled={isLoading || step === 'generating_video' || step === 'done'} className="w-full max-w-md mx-auto !text-lg">
                                {step === 'generating_video' ? <Spinner /> : <VideoIcon className="w-6 h-6" />}
                                Buat Video Iklan
                            </Button>
                        </div>
                    </div>
                )}
                
                {/* 3. Results Section */}
                {(step === 'generating_video' || step === 'done') && (
                     <div className="bg-gray-800/50 backdrop-blur-sm p-6 space-y-6 border border-gray-700 rounded-2xl animate-fade-in-fast">
                        <h2 className="text-2xl font-bold text-white">3. Hasil Video</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {scenes.map(scene => (
                                <div key={scene.id} className="aspect-square bg-gray-900 rounded-lg flex items-center justify-center flex-col gap-2">
                                    {scene.status === 'generating' && <Spinner />}
                                    {scene.status === 'done' && scene.videoUrl && <VideoPlayer videoUrl={scene.videoUrl} aspectRatio="1:1" />}
                                    {scene.status === 'error' && <div className="text-center text-xs text-red-400 p-2">Gagal membuat adegan</div>}
                                    <p className="text-xs text-gray-400">Adegan {scene.id + 1}</p>
                                </div>
                            ))}
                        </div>
                         {step === 'done' && (
                            <div className="pt-6 border-t border-gray-700 text-center space-y-4">
                                {finalVideoUrl ? (
                                    <div>
                                        <h3 className="font-semibold text-lg text-emerald-400 mb-4">Video Final</h3>
                                        <div className="max-w-sm mx-auto">
                                            <VideoPlayer videoUrl={finalVideoUrl} aspectRatio={aspectRatio} />
                                        </div>
                                        <a href={finalVideoUrl} download="iklan_produk_final.mp4">
                                            <Button className="mt-4"><DownloadIcon className="w-5 h-5"/> Unduh Video Final</Button>
                                        </a>
                                    </div>
                                ) : (
                                    <Button onClick={handleMergeVideos} disabled={isLoading || scenes.some(s => s.status !== 'done')}>
                                        {isMerging ? <Spinner /> : <i className="fa-solid fa-film mr-2"></i>}
                                        Gabungkan 4 Adegan
                                    </Button>
                                )}
                            </div>
                         )}
                    </div>
                )}
            </div>
             <style>{`
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in-fast { animation: fadeIn 0.4s ease-in-out; }
            `}</style>
        </div>
    );
};

export default VideoGenerator;