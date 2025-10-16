import React, { useState, useRef } from 'react';
import Button from './Button';
import { SparklesIcon, XIcon, CameraIcon, ExclamationCircleIcon, ClipboardIcon, DownloadIcon, VideoIcon, CheckCircleIcon } from './icons';
import { useApiKey } from '../contexts/ApiKeyContext';
import { generateImage, generateVideo, generateImageWithCharacterConsistency, generateSpeech } from '../services/geminiService';
import { Spinner } from './Spinner';
import { GoogleGenAI, Type, GenerateContentResponse } from '@google/genai';
import type { VeoModel, ImageAspectRatio } from '../types';

const storyStyles = [
    { name: 'Film Realistis', description: 'Detail sinematik tajam & warna alami.', imageUrl: 'https://placehold.co/100x140/84483B/FFFFFF?text=Film+Realistis' },
    { name: 'Kartun 3D', description: 'Animasi 3D modern, cerah & halus.', imageUrl: 'https://placehold.co/100x140/8364B2/FFFFFF?text=Kartun+3D' },
    { name: 'Film', description: 'Estetika film analog dengan grain & suar.', imageUrl: 'https://placehold.co/100x140/F8AF5B/FFFFFF?text=Film' },
    { name: 'Foto', description: 'Kualitas foto jernih dan realistis.', imageUrl: 'https://placehold.co/100x140/FD72A2/FFFFFF?text=Foto' },
    { name: 'Penuh Imajinasi', description: 'Visual surealis & fantastis penuh warna.', imageUrl: 'https://placehold.co/100x140/8364B2/FFFFFF?text=Penuh+Imajinasi' },
    { name: 'Fets Dolls', description: 'Gaya unik seperti boneka proporsional.', imageUrl: 'https://placehold.co/100x140/C1192A/FFFFFF?text=Fets+Dolls' },
    { name: 'Crayon', description: 'Goresan artistik seperti krayon kasar.', imageUrl: 'https://placehold.co/100x140/2D2D2D/FFFFFF?text=Crayon' },
    { name: 'Lovecraftian', description: 'Horor kosmik gelap & misterius.', imageUrl: 'https://placehold.co/100x140/092543/FFFFFF?text=Lovecraftian' },
    { name: 'Gaya Urban', description: 'Gaya urban edgy & modern.', imageUrl: 'https://placehold.co/100x140/FF8700/FFFFFF?text=Gaya+Urban' },
    { name: 'Dark Deco', description: 'Art Deco mewah dengan sentuhan gelap.', imageUrl: 'https://placehold.co/100x140/D62A2A/FFFFFF?text=Dark+Deco' },
    { name: 'Gaya GTA', description: 'Visual game realistik & kota suram.', imageUrl: 'https://placehold.co/100x140/F8AF5B/FFFFFF?text=Gaya+GTA' },
    { name: 'Toon Shader', description: 'Kartun 2D dengan garis luar tebal.', imageUrl: 'https://placehold.co/100x140/2D2D2D/FFFFFF?text=Toon+Shader' },
    { name: 'Game Olahraga', description: 'Grafis game olahraga dinamis & modern.', imageUrl: 'https://placehold.co/100x140/8364B2/FFFFFF?text=Game+Olahraga' },
    { name: 'Close-Up', description: 'Fokus super dekat, dramatis & intim.', imageUrl: 'https://placehold.co/100x140/84483B/FFFFFF?text=Close-Up' },
    { name: 'Potret', description: 'Komposisi potret klasik & ekspresif.', imageUrl: 'https://placehold.co/100x140/FD72A2/FFFFFF?text=Potret' },
    { name: 'Tinta & Cat Air', description: 'Artistik cat air & goresan tinta.', imageUrl: 'https://placehold.co/100x140/C1192A/FFFFFF?text=Tinta+%26+Cat+Air' },
    { name: 'Tampilan Udara', description: 'Pemandangan luas dari atas (drone).', imageUrl: 'https://placehold.co/100x140/8364B2/FFFFFF?text=Tampilan+Udara' },
    { name: 'Futuristik', description: 'Teknologi canggih, sci-fi & neon.', imageUrl: 'https://placehold.co/100x140/092543/FFFFFF?text=Futuristik' },
    { name: 'Alkitabiah', description: 'Suasana epik & sakral ala lukisan kuno.', imageUrl: 'https://placehold.co/100x140/FF8700/FFFFFF?text=Alkitabiah' },
    { name: 'Kota Impian', description: 'Pemandangan kota fantasi & magis.', imageUrl: 'https://placehold.co/100x140/D62A2A/FFFFFF?text=Kota+Impian' },
    { name: 'Dunia Mini', description: 'Efek tilt-shift seperti dunia mainan.', imageUrl: 'https://placehold.co/100x140/8364B2/FFFFFF?text=Dunia+Mini' },
    { name: 'Anime', description: 'Gaya animasi Jepang populer & cerah.', imageUrl: 'https://placehold.co/100x140/F8AF5B/FFFFFF?text=Anime' },
    { name: 'Tanah Liat', description: 'Animasi stop-motion bertekstur.', imageUrl: 'https://placehold.co/100x140/C1192A/FFFFFF?text=Tanah+Liat' },
    { name: 'Horor', description: 'Suasana gelap, tegang & menakutkan.', imageUrl: 'https://placehold.co/100x140/2D2D2D/FFFFFF?text=Horor' },
    { name: 'Cyberpunk', description: 'Kota distopia basah & penuh neon.', imageUrl: 'https://placehold.co/100x140/84483B/FFFFFF?text=Cyberpunk' },
    { name: 'Neoklasik', description: 'Kemegahan seni Yunani-Romawi klasik.', imageUrl: 'https://placehold.co/100x140/FD72A2/FFFFFF?text=Neoklasik' },
    { name: 'Prasejarah', description: 'Lanskap liar dunia dinosaurus purba.', imageUrl: 'https://placehold.co/100x140/092543/FFFFFF?text=Prasejarah' },
    { name: 'Dongeng', description: 'Visual magis & menawan ala buku cerita.', imageUrl: 'https://placehold.co/100x140/8364B2/FFFFFF?text=Dongeng' },
    { name: 'Lego', description: 'Dunia cerah terbuat dari balok Lego.', imageUrl: 'https://placehold.co/100x140/FFFF00/000000?text=Lego' },
    { name: 'Anime Retro', description: 'Gaya anime klasik 80/90-an.', imageUrl: 'https://placehold.co/100x140/F5C5C5/5B3A3A?text=Anime+Retro' },
    { name: 'Komik', description: 'Visual buku komik dengan garis tebal.', imageUrl: 'https://placehold.co/100x140/2E86C1/FFFFFF?text=Komik' },
    { name: 'Jurassic', description: 'Dinosaurus realistis di dunia liar.', imageUrl: 'https://placehold.co/100x140/5E6D38/FFFFFF?text=Jurassic' },
];

const voiceOptions = [
    { value: 'Zephyr', label: 'Zephyr (Pria)' },
    { value: 'Kore', label: 'Kore (Wanita)' },
    { value: 'Puck', label: 'Puck (Pria)' },
    { value: 'Charon', label: 'Charon (Pria, Dalam)' },
    { value: 'Fenrir', label: 'Fenrir (Wanita, Dalam)' },
];

interface Character {
    id: number;
    name: string;
    description: string;
    imageUrl?: string;
    imageBase64?: string;
    mimeType?: string;
    status: 'pending' | 'generating' | 'done' | 'error';
}

interface Scene {
    id: number;
    narrative: string;
    imagePrompt: string;
    status: 'pending' | 'generating-image' | 'image-done' | 'generating-video' | 'video-done' | 'generating-audio' | 'done' | 'error';
    imageUrl?: string;
    imageBase64?: string;
    videoUrl?: string;
    audioUrl?: string;
}


const getSceneStatus = (status: Scene['status']) => {
    switch (status) {
        case 'pending': return { text: 'Menunggu', color: 'bg-gray-700 text-gray-300' };
        case 'generating-image': return { text: 'Membuat Gbr...', color: 'bg-yellow-500/20 text-yellow-300' };
        case 'image-done': return { text: 'Gbr Selesai', color: 'bg-sky-500/20 text-sky-300' };
        case 'generating-video': return { text: 'Membuat Vid...', color: 'bg-blue-500/20 text-blue-300' };
        case 'video-done': return { text: 'Vid Selesai', color: 'bg-purple-500/20 text-purple-300' };
        case 'generating-audio': return { text: 'Membuat Audio...', color: 'bg-pink-500/20 text-pink-300' };
        case 'done': return { text: 'Selesai', color: 'bg-green-500/20 text-green-300' };
        case 'error': return { text: 'Error', color: 'bg-red-500/20 text-red-300' };
    }
};

// Helper to decode base64 string to Uint8Array
function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Helper to convert raw PCM data to a WAV file blob
function pcmToWavBlob(pcmData: Int16Array, sampleRate: number, numChannels: number): Blob {
    const headerLength = 44;
    const dataSize = pcmData.length * 2; // 16-bit PCM = 2 bytes per sample
    const buffer = new ArrayBuffer(headerLength + dataSize);
    const view = new DataView(buffer);

    const writeString = (view: DataView, offset: number, string: string) => {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    };

    // RIFF chunk descriptor
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true); // chunkSize
    writeString(view, 8, 'WAVE');

    // FMT sub-chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true); // audioFormat (1 for PCM)
    view.setUint16(22, numChannels, true); // numChannels
    view.setUint32(24, sampleRate, true); // sampleRate
    view.setUint32(28, sampleRate * numChannels * 2, true); // byteRate
    view.setUint16(32, numChannels * 2, true); // blockAlign
    view.setUint16(34, 16, true); // bitsPerSample

    // DATA sub-chunk
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true); // subchunk2Size

    // Write PCM data
    for (let i = 0; i < pcmData.length; i++) {
        view.setInt16(headerLength + i * 2, pcmData[i], true);
    }

    return new Blob([view], { type: 'audio/wav' });
}


const IdeCerita: React.FC = () => {
    const { apiKey, isApiKeySet } = useApiKey();
    const [globalError, setGlobalError] = useState<string | null>(null);

    const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
    const [characters, setCharacters] = useState<Character[]>([]);
    const [storyIdea, setStoryIdea] = useState('');
    const [aspectRatio, setAspectRatio] = useState<ImageAspectRatio>('16:9');
    const [selectedVoice, setSelectedVoice] = useState('Zephyr');
    
    const [scenes, setScenes] = useState<Scene[]>([]);
    const [isGeneratingScenes, setIsGeneratingScenes] = useState(false);
    const [justCopiedId, setJustCopiedId] = useState<string | null>(null);

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const scenesContainerRef = useRef<HTMLDivElement>(null);


    const addCharacter = () => {
        setCharacters([...characters, { 
            id: Date.now(), 
            name: '', 
            description: '',
            status: 'pending' 
        }]);
    };

    const removeCharacter = (id: number) => {
        setCharacters(characters.filter(char => char.id !== id));
    };

    const updateCharacter = (id: number, field: 'name' | 'description', value: string) => {
        setCharacters(characters.map(char => char.id === id ? { ...char, [field]: value } : char));
    };

    const handleGenerateCharacterImage = async (id: number) => {
        const character = characters.find(c => c.id === id);
        if (!character || !character.description.trim()) {
            setGlobalError('Deskripsi karakter harus diisi untuk membuat gambar.');
            setTimeout(() => setGlobalError(null), 3000);
            return;
        }
        if (!selectedStyle) {
            setGlobalError('Silakan pilih gaya visual terlebih dahulu.');
            setTimeout(() => setGlobalError(null), 3000);
            return;
        }
        if (!isApiKeySet) {
            setGlobalError('Kunci API tidak diatur. Silakan atur di Pengaturan.');
            return;
        }

        setGlobalError(null);
        setCharacters(chars => chars.map(c => c.id === id ? { ...c, status: 'generating' } : c));

        try {
            const prompt = `Full body character portrait of ${character.name || 'a character'}, who is described as: "${character.description}". The visual style must be **${selectedStyle}**. Additional details: cinematic, detailed, simple background, 3:4 aspect ratio.`;
            
            const imageResult = await generateImage(apiKey, prompt, '3:4');
            const imageUrl = `data:${imageResult.mimeType};base64,${imageResult.data}`;

            setCharacters(chars => chars.map(c => c.id === id ? {
                ...c,
                status: 'done',
                imageUrl: imageUrl,
                imageBase64: imageResult.data,
                mimeType: imageResult.mimeType
            } : c));

        } catch (err) {
            console.error(err);
            const errorMessage = err instanceof Error ? err.message : 'Gagal membuat gambar.';
            setGlobalError(errorMessage);
            setCharacters(chars => chars.map(c => c.id === id ? { ...c, status: 'error' } : c));
        }
    };

    const handleGenerateScenes = async () => {
        setIsGeneratingScenes(true);
        setGlobalError(null);
        setScenes([]);
        
        try {
            const ai = new GoogleGenAI({ apiKey });
            const characterDescriptions = characters.map(c => `- ${c.name || 'Unnamed Character'}: ${c.description}`).join('\n');
            
            const prompt = `As a creative storyteller and visual director, generate a 7-scene story based on the following elements.
- Story Idea: "${storyIdea}"
- Visual Style: "${selectedStyle}"
- Characters:
${characterDescriptions}

For each scene, provide two things:
1. A "narrative": A very short, concise sentence for a voice-over. This narrative **MUST be short enough to be spoken clearly within 8 seconds (approximately 20-25 words maximum).**
2. An "imagePrompt": A detailed image prompt for an AI image generator that must incorporate the specified visual style and characters.

Return the result as a single JSON object with one key: "scenes". The value of "scenes" must be an array of 7 objects. Each object in the array must have two keys: "narrative" and "imagePrompt".`;

            const response: GenerateContentResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            scenes: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        narrative: { type: Type.STRING },
                                        imagePrompt: { type: Type.STRING }
                                    }
                                }
                            }
                        }
                    }
                }
            });
            const cleanedJson = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
            const result = JSON.parse(cleanedJson);

            const newScenes: Scene[] = result.scenes.map((sceneData: any, index: number) => ({
                id: Date.now() + index,
                narrative: sceneData.narrative,
                imagePrompt: sceneData.imagePrompt,
                status: 'pending'
            }));
            setScenes(newScenes);

        } catch (err) {
            console.error(err);
            const errorMessage = err instanceof Error ? err.message : 'Gagal membuat adegan cerita.';
            setGlobalError(errorMessage);
        } finally {
            setIsGeneratingScenes(false);
        }
    };

    const handleGenerateSceneImage = async (id: number) => {
        const scene = scenes.find(s => s.id === id);
        if (!scene) return;
        
        setScenes(prev => prev.map(s => s.id === id ? { ...s, status: 'generating-image' } : s));
        try {
            const prompt = `${scene.imagePrompt}. Visual Style: ${selectedStyle}.`;
            
            const charactersWithImages = characters
                .filter(c => c.status === 'done' && c.imageBase64 && c.mimeType)
                .map(c => ({
                    data: c.imageBase64!,
                    mimeType: c.mimeType!
                }));

            let imageResult;
            if (charactersWithImages.length > 0) {
                 imageResult = await generateImageWithCharacterConsistency(apiKey, prompt, charactersWithImages, aspectRatio);
            } else {
                // Fallback if no characters have images yet
                 imageResult = await generateImage(apiKey, prompt, aspectRatio);
            }
            
            const imageUrl = `data:${imageResult.mimeType};base64,${imageResult.data}`;
            
            setScenes(prev => prev.map(s => s.id === id ? { ...s, status: 'image-done', imageUrl, imageBase64: imageResult.data } : s));
        } catch (err) {
            console.error(err);
            setScenes(prev => prev.map(s => s.id === id ? { ...s, status: 'error' } : s));
        }
    };

    const handleGenerateSceneVideo = async (id: number) => {
        const scene = scenes.find(s => s.id === id);
        if (!scene || !scene.imageBase64) return;
    
        setScenes(prev => prev.map(s => s.id === id ? { ...s, status: 'generating-video' } : s));
        
        const primaryModel: VeoModel = 'veo-3.0-fast-generate-preview';
        const fallbackModel: VeoModel = 'veo-2.0-generate-001';
    
        try {
            const videoUrl = await generateVideo(
                apiKey,
                {
                    prompt: scene.narrative,
                    imageBase64: scene.imageBase64,
                    imageMimeType: 'image/png',
                    model: primaryModel
                },
                '16:9', // Force 16:9 for VEO 3
                false, '720p', 'none', 'Cinematic'
            );
            setScenes(prev => prev.map(s => s.id === id ? { ...s, status: 'video-done', videoUrl } : s));
        } catch (err) {
            console.warn(`Video generation failed with primary model (${primaryModel}). Error:`, err);
            setGlobalError(`Gagal dengan model VEO 3, mencoba VEO 2...`);
            
            try {
                const videoUrl = await generateVideo(
                    apiKey,
                    {
                        prompt: scene.narrative,
                        imageBase64: scene.imageBase64,
                        imageMimeType: 'image/png',
                        model: fallbackModel
                    },
                    aspectRatio, // Use user's selected AR for VEO 2
                    false, '720p', 'none', 'Cinematic'
                );
                setScenes(prev => prev.map(s => s.id === id ? { ...s, status: 'video-done', videoUrl } : s));
                setGlobalError(null); // Clear temporary error
            } catch (fallbackErr) {
                console.error(`Fallback video generation also failed with model (${fallbackModel}). Error:`, fallbackErr);
                const errorMessage = fallbackErr instanceof Error ? fallbackErr.message : 'Gagal membuat video dengan kedua model.';
                setGlobalError(errorMessage);
                setScenes(prev => prev.map(s => s.id === id ? { ...s, status: 'error' } : s));
            }
        }
    };

    const handleGenerateSceneAudio = async (id: number) => {
        const scene = scenes.find(s => s.id === id);
        if (!scene || !scene.narrative) return;
    
        setScenes(prev => prev.map(s => s.id === id ? { ...s, status: 'generating-audio' } : s));
        setGlobalError(null);
    
        try {
            const base64Audio = await generateSpeech(apiKey, scene.narrative, selectedVoice);
            
            // Decode base64 and create a WAV blob
            const pcmBytes = decodeBase64(base64Audio);
            const pcmData = new Int16Array(pcmBytes.buffer);
            const wavBlob = pcmToWavBlob(pcmData, 24000, 1);
            const audioUrl = URL.createObjectURL(wavBlob);
    
            setScenes(prev => prev.map(s => s.id === id ? { ...s, status: 'done', audioUrl } : s));
        } catch (err) {
            console.error('Audio generation failed:', err);
            const errorMessage = err instanceof Error ? err.message : 'Gagal membuat audio.';
            setGlobalError(errorMessage);
            setScenes(prev => prev.map(s => s.id === id ? { ...s, status: 'error' } : s));
        }
    };


    const handleWheel = (e: React.WheelEvent, ref: React.RefObject<HTMLDivElement>) => {
        if (ref.current) {
            ref.current.scrollLeft += e.deltaY;
        }
    };

    const handleCopy = (id: string, text: string) => {
        navigator.clipboard.writeText(text);
        setJustCopiedId(id);
        setTimeout(() => setJustCopiedId(null), 2000);
    };

    const handleDownload = (url: string, filename: string) => {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    const canGenerateScenes = !isGeneratingScenes && !!selectedStyle && !!storyIdea.trim() && characters.length > 0 && characters.every(c => c.description.trim() !== '');

    return (
        <div className="h-full overflow-y-auto bg-dots-pattern p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto space-y-8">
                
                <div className="bg-gray-800/50 backdrop-blur-sm p-6 border border-gray-700 rounded-2xl">
                    <h2 className="text-xl font-bold text-white mb-4">1. Pilih Gaya Visual</h2>
                    <div ref={scrollContainerRef} onWheel={(e) => handleWheel(e, scrollContainerRef)} className="horizontal-scrollbar flex space-x-4 overflow-x-auto pb-4 -mb-4" style={{ scrollbarWidth: 'thin' }}>
                        {storyStyles.map(style => (
                            <div 
                                key={style.name} 
                                onClick={() => setSelectedStyle(style.name)}
                                className={`flex-shrink-0 w-32 cursor-pointer group rounded-lg overflow-hidden transition-all duration-300 transform hover:-translate-y-1 ${selectedStyle === style.name ? 'ring-4 ring-emerald-500' : 'ring-2 ring-transparent'}`}
                            >
                                <img src={style.imageUrl} alt={style.name} className="w-full h-44 object-cover"/>
                                <div className="p-2 bg-gray-900">
                                    <h3 className="text-sm font-semibold text-white truncate">{style.name}</h3>
                                    <p className="text-xs text-gray-400 truncate group-hover:whitespace-normal">{style.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="bg-gray-800/50 backdrop-blur-sm p-6 border border-gray-700 rounded-2xl space-y-4">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold text-white">2. Tambah Karakter (Wajib)</h2>
                            <Button onClick={addCharacter} size="sm">Tambah</Button>
                        </div>
                        {globalError && <div className="text-xs text-center text-red-400 bg-red-900/30 p-2 rounded-md">{globalError}</div>}
                        <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                            {characters.length === 0 && <p className="text-center text-gray-500 py-4">Silakan buat setidaknya satu karakter. Deskripsi karakter akan digunakan untuk membuat cerita.</p>}
                            {characters.map((char, index) => (
                                <div key={char.id} className="bg-gray-900/70 p-4 rounded-lg animate-fade-in-fast flex flex-col md:flex-row gap-4">
                                     <div className="w-full md:w-1/3 flex flex-col gap-2">
                                        <div className="aspect-[3/4] bg-black rounded flex items-center justify-center relative group">
                                            {char.status === 'generating' && <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center gap-2 text-white z-10 rounded-lg"><Spinner className="w-8 h-8" /><p className="text-xs">Generating...</p></div>}
                                            {char.imageUrl ? <img src={char.imageUrl} alt={char.name} className="w-full h-full object-cover rounded" /> : char.status === 'error' ? <div className="text-red-400 flex flex-col items-center gap-2 text-center"><ExclamationCircleIcon className="w-10 h-10" /><p className="text-xs">Error</p></div> : <div className="text-gray-600 flex flex-col items-center gap-2 text-center"><CameraIcon className="w-10 h-10" /><p className="text-xs">No Image</p></div>}
                                        </div>
                                        <Button size="sm" onClick={() => handleGenerateCharacterImage(char.id)} disabled={!char.description.trim() || char.status === 'generating' || !isApiKeySet}><SparklesIcon className="w-4 h-4" />{char.imageUrl ? 'Ulangi' : 'Buat Gambar'}</Button>
                                    </div>
                                    <div className="w-full md:w-2/3 space-y-2 relative">
                                        <button onClick={() => removeCharacter(char.id)} className="absolute top-0 right-0 text-gray-500 hover:text-red-400"><XIcon className="w-4 h-4" /></button>
                                        <label className="text-sm font-medium text-gray-400">Karakter #{index + 1}</label>
                                        <input type="text" placeholder="Nama Karakter" value={char.name} onChange={e => updateCharacter(char.id, 'name', e.target.value)} className="w-full bg-gray-700 border border-gray-600 text-white rounded-md py-1.5 px-3 text-sm focus:ring-emerald-500 focus:border-emerald-500" />
                                        <textarea placeholder="Deskripsi singkat karakter (wajib)..." rows={4} value={char.description} onChange={e => updateCharacter(char.id, 'description', e.target.value)} className="w-full bg-gray-700 border border-gray-600 text-white rounded-md py-1.5 px-3 text-sm focus:ring-emerald-500 focus:border-emerald-500" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-8">
                        <div className="bg-gray-800/50 backdrop-blur-sm p-6 border border-gray-700 rounded-2xl">
                             <h2 className="text-xl font-bold text-white mb-4">3. Tulis Ide Cerita Anda</h2>
                             <textarea placeholder="Contoh: seorang ksatria yang berteman dengan naga..." rows={6} value={storyIdea} onChange={e => setStoryIdea(e.target.value)} className="w-full bg-gray-900/70 border border-gray-600 text-white rounded-lg py-2 px-3 focus:ring-emerald-500 focus:border-emerald-500" />
                        </div>
                        <div className="bg-gray-800/50 backdrop-blur-sm p-6 border border-gray-700 rounded-2xl">
                             <h2 className="text-xl font-bold text-white mb-4">4. Pengaturan Output</h2>
                             <div className="grid grid-cols-2 gap-4">
                                <button onClick={() => setAspectRatio('16:9')} className={`py-3 px-4 rounded-lg font-semibold transition-colors ${aspectRatio === '16:9' ? 'bg-emerald-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>16:9</button>
                                <button onClick={() => setAspectRatio('9:16')} className={`py-3 px-4 rounded-lg font-semibold transition-colors ${aspectRatio === '9:16' ? 'bg-emerald-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>9:16</button>
                             </div>
                             <div className="mt-4">
                                <label className="block text-sm font-medium text-gray-300 mb-2">Gaya Suara (Voice Style)</label>
                                <div className="relative">
                                    <select
                                        value={selectedVoice}
                                        onChange={(e) => setSelectedVoice(e.target.value)}
                                        className="w-full appearance-none bg-gray-700 border border-gray-600 text-white rounded-lg py-2.5 px-3 pr-8 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                                    >
                                        {voiceOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                                        <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="text-center pt-4">
                    <Button 
                        onClick={handleGenerateScenes} 
                        disabled={!canGenerateScenes} 
                        className="w-full max-w-md !text-lg !py-3"
                        title={
                            !selectedStyle ? 'Pilih gaya visual terlebih dahulu' :
                            !storyIdea.trim() ? 'Isi ide cerita terlebih dahulu' :
                            characters.length === 0 ? 'Tambah setidaknya satu karakter' :
                            !characters.every(c => c.description.trim() !== '') ? 'Isi deskripsi untuk semua karakter' :
                            ''
                        }
                    >
                        <SparklesIcon className="w-6 h-6" />
                        {isGeneratingScenes ? 'Membuat Adegan...' : 'Generate Ide Cerita'}
                    </Button>
                </div>

                {scenes.length > 0 && (
                    <div className="bg-gray-800/50 backdrop-blur-sm p-6 border border-gray-700 rounded-2xl">
                        <h2 className="text-2xl font-bold text-white mb-4 text-center">Hasil Adegan Cerita</h2>
                         <div ref={scenesContainerRef} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {scenes.map((scene, index) => {
                                const statusInfo = getSceneStatus(scene.status);
                                return (
                                <div key={scene.id} className="bg-gray-900/50 rounded-lg p-4 space-y-3 flex flex-col">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-1">
                                            <h3 className="font-bold text-emerald-400">Adegan {index + 1}</h3>
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${statusInfo.color}`}>{statusInfo.text}</span>
                                        </div>
                                        <div className="flex gap-2">
                                            {scene.audioUrl && (
                                                <button onClick={() => handleDownload(scene.audioUrl!, `adegan_${index + 1}_audio.wav`)} className="p-1.5 bg-gray-700 rounded-full text-gray-300 hover:bg-emerald-600 hover:text-white" title="Download Audio">
                                                    <i className="fa-solid fa-waveform"></i>
                                                </button>
                                            )}
                                            {scene.videoUrl ? (
                                                <button onClick={() => handleDownload(scene.videoUrl!, `adegan_${index + 1}.mp4`)} className="p-1.5 bg-gray-700 rounded-full text-gray-300 hover:bg-emerald-600 hover:text-white" title="Download Video">
                                                    <DownloadIcon className="w-4 h-4" />
                                                </button>
                                            ) : scene.imageUrl && (
                                                <button onClick={() => handleDownload(scene.imageUrl!, `adegan_${index + 1}.png`)} className="p-1.5 bg-gray-700 rounded-full text-gray-300 hover:bg-emerald-600 hover:text-white" title="Download Gambar">
                                                    <DownloadIcon className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="aspect-video bg-black rounded-lg flex items-center justify-center relative">
                                        {(scene.status === 'generating-image' || scene.status === 'generating-video' || scene.status === 'generating-audio') && (
                                            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center text-white text-center z-10 rounded-lg">
                                                <Spinner />
                                                <p className="text-xs mt-2">{statusInfo.text}</p>
                                            </div>
                                        )}
                                        {scene.videoUrl ? (
                                            <video src={scene.videoUrl} controls loop className="w-full h-full object-contain rounded-lg" />
                                        ) : scene.imageUrl ? (
                                            <img src={scene.imageUrl} alt={`Adegan ${index + 1}`} className="w-full h-full object-contain rounded-lg" />
                                        ) : scene.status === 'error' ? (
                                            <div className="text-red-400 text-center">
                                                <ExclamationCircleIcon className="w-8 h-8 mx-auto" /><p className="text-xs mt-2">Error</p>
                                            </div>
                                        ) : (
                                            <div className="text-gray-600"><CameraIcon className="w-10 h-10"/></div>
                                        )}
                                    </div>

                                    <div className="space-y-2 text-xs flex-grow">
                                        <div>
                                            <div className="flex justify-between items-center mb-1">
                                                <label className="font-semibold text-gray-400">Narasi</label>
                                                <button onClick={() => handleCopy(`narrative-${scene.id}`, scene.narrative)} className="p-1.5 bg-gray-700 rounded-full text-gray-400 hover:bg-emerald-600 hover:text-white transition-colors">
                                                    {justCopiedId === `narrative-${scene.id}` ? <CheckCircleIcon className="w-4 h-4"/> : <ClipboardIcon className="w-4 h-4" />}
                                                </button>
                                            </div>
                                            <p className="w-full bg-gray-800 border border-gray-700 rounded-md p-2 text-gray-300 resize-none">
                                                {scene.narrative}
                                            </p>
                                        </div>
                                        <div>
                                             <div className="flex justify-between items-center mb-1">
                                                <label className="font-semibold text-gray-400">Prompt Gambar</label>
                                                <button onClick={() => handleCopy(`prompt-${scene.id}`, scene.imagePrompt)} className="p-1.5 bg-gray-700 rounded-full text-gray-400 hover:bg-emerald-600 hover:text-white transition-colors">
                                                    {justCopiedId === `prompt-${scene.id}` ? <CheckCircleIcon className="w-4 h-4"/> : <ClipboardIcon className="w-4 h-4" />}
                                                </button>
                                            </div>
                                            <p className="w-full bg-gray-800 border border-gray-700 rounded-md p-2 text-gray-300 resize-none">
                                                {scene.imagePrompt}
                                            </p>
                                        </div>
                                        {scene.audioUrl && (
                                            <div className="pt-2">
                                                <audio src={scene.audioUrl} controls className="w-full h-8" />
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="mt-auto pt-2 space-y-2">
                                        <Button onClick={() => handleGenerateSceneImage(scene.id)} disabled={scene.status.startsWith('generating')} size="sm" variant="secondary" className="w-full">{scene.imageUrl ? 'Ulangi Gambar' : 'Generate Image'}</Button>
                                        <Button 
                                            onClick={() => handleGenerateSceneVideo(scene.id)} 
                                            disabled={!scene.imageBase64 || scene.status.startsWith('generating')} 
                                            size="sm" 
                                            variant="secondary" 
                                            className="w-full">
                                            <VideoIcon className="w-4 h-4 mr-2"/>
                                            {scene.videoUrl ? 'Ulangi Video' : 'Generate Video'}
                                        </Button>
                                        <Button 
                                            onClick={() => handleGenerateSceneAudio(scene.id)}
                                            disabled={scene.status !== 'video-done' && scene.status !== 'done'}
                                            size="sm"
                                            variant="secondary"
                                            className="w-full"
                                        >
                                            <i className="fa-solid fa-microphone-lines w-4 h-4 mr-2"></i>
                                            {scene.audioUrl ? 'Ulangi Audio' : 'Generate Audio'}
                                        </Button>
                                    </div>
                                </div>
                            )})}
                        </div>
                    </div>
                )}

            </div>
             <style>{`
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                .animate-fade-in-fast { animation: fadeIn 0.3s ease-in-out; }
                .horizontal-scrollbar::-webkit-scrollbar { height: 6px; }
                .horizontal-scrollbar::-webkit-scrollbar-track { background: #374151; border-radius: 3px; }
                .horizontal-scrollbar::-webkit-scrollbar-thumb { background: #10b981; border-radius: 3px; }
                .horizontal-scrollbar::-webkit-scrollbar-thumb:hover { background: #059669; }
                textarea::-webkit-scrollbar { width: 6px; }
                textarea::-webkit-scrollbar-track { background: transparent; }
                textarea::-webkit-scrollbar-thumb { background: #4b5563; border-radius: 3px; }
                textarea::-webkit-scrollbar-thumb:hover { background: #6b7280; }
                audio::-webkit-media-controls-panel { background-color: #374151; }
                audio::-webkit-media-controls-play-button { color: #10b981; }
                audio::-webkit-media-controls-current-time-display { color: #d1d5db; }
                audio::-webkit-media-controls-time-remaining-display { color: #d1d5db; }
                audio::-webkit-media-controls-timeline { background-color: #4b5563; border-radius: 25px; }
                audio::-webkit-media-controls-volume-slider { background-color: #4b5563; border-radius: 25px; }
            `}</style>
        </div>
    );
};

export default IdeCerita;