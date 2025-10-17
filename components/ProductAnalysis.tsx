import React, { useState, useCallback } from 'react';
import { useApiKey } from '../contexts/ApiKeyContext';
import { useLanguage } from '../contexts/LanguageContext';
import TextInput from './TextInput';
import Button from './Button';
import { Spinner } from './Spinner';
import { SparklesIcon, LightbulbIcon, ClipboardIcon, CheckCircleIcon, MicrophoneIcon, DownloadIcon } from './icons';
import { analyzeProductLink, generateSpeech } from '../services/geminiService';
import SelectInput from './SelectInput';

interface AnalysisResult {
    productAnalysis: string;
    voiceOverScripts: string[];
    videoCaption: string;
    hashtags: string[];
}

type AudioState = {
    status: 'idle' | 'loading' | 'done' | 'error';
    url?: string;
    error?: string;
};

const voiceOverStyles = [
    { value: '', label: 'Random / Pilihan AI' },
    { value: 'Enthusiastic & Energetic', label: 'Antusias & Berenergi' },
    { value: 'Calm & Informative', label: 'Tenang & Informatif' },
    { value: 'Storytelling & Emotional', label: 'Penceritaan & Emosional' },
    { value: 'Humorous & Witty', label: 'Humoris & Jenaka' },
    { value: 'Luxurious & Sophisticated', label: 'Mewah & Canggih' },
];

const voiceOptions = [
    { value: 'Zephyr', label: 'Zephyr (Pria)' },
    { value: 'Kore', label: 'Kore (Wanita)' },
    { value: 'Puck', label: 'Puck (Pria)' },
    { value: 'Charon', label: 'Charon (Pria, Dalam)' },
    { value: 'Fenrir', label: 'Fenrir (Wanita, Dalam)' },
];

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


const ResultCard: React.FC<{ title: string; content: string; }> = ({ title, content }) => {
    const [copySuccess, setCopySuccess] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(content);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    };

    return (
        <div className="p-6 bg-gray-800/70 rounded-lg border border-gray-700 relative">
            <h3 className="text-xl font-bold text-emerald-400 mb-3">{title}</h3>
            <p className="text-gray-300 whitespace-pre-wrap">{content}</p>
            <button
                onClick={handleCopy}
                className="absolute top-4 right-4 p-2 bg-gray-700/50 rounded-md text-gray-400 hover:bg-gray-600 hover:text-white transition-colors"
                title="Copy to clipboard"
            >
                {copySuccess ? <CheckCircleIcon className="w-5 h-5 text-emerald-500" /> : <ClipboardIcon className="w-5 h-5" />}
            </button>
        </div>
    );
};

const VoiceOverScriptCard: React.FC<{
    script: string;
    onScriptChange: (newScript: string) => void;
    index: number;
    audioState: AudioState;
    onGenerateAudio: () => void;
}> = ({ script, onScriptChange, index, audioState, onGenerateAudio }) => {
    const { t } = useLanguage();
    const [copySuccess, setCopySuccess] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(script);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    };

    return (
        <div className="p-6 bg-gray-800/70 rounded-lg border border-gray-700 relative space-y-4">
            <div className="flex justify-between items-start">
                <h3 className="text-xl font-bold text-emerald-400">Naskah Voice Over - Variasi {index + 1}</h3>
                <button onClick={handleCopy} className="p-2 bg-gray-700/50 rounded-md text-gray-400 hover:bg-gray-600 hover:text-white transition-colors" title="Copy to clipboard">
                    {copySuccess ? <CheckCircleIcon className="w-5 h-5 text-emerald-500" /> : <ClipboardIcon className="w-5 h-5" />}
                </button>
            </div>
             <textarea
                value={script}
                onChange={(e) => onScriptChange(e.target.value)}
                rows={6}
                className="w-full bg-gray-900/80 border border-gray-700 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                placeholder="Edit naskah di sini..."
            />
            
            <div className="pt-4 border-t border-gray-700/50">
                {audioState?.status === 'done' && audioState.url ? (
                     <div className="flex items-center gap-2">
                        <audio src={audioState.url} controls className="w-full h-10" />
                        <a
                           href={audioState.url}
                           download={`naskah_${index + 1}.wav`}
                           className="flex-shrink-0 p-2.5 bg-gray-700/50 rounded-md text-gray-400 hover:bg-emerald-600 hover:text-white transition-colors"
                           title={t('downloadAudio')}
                       >
                           <DownloadIcon className="w-5 h-5" />
                       </a>
                   </div>
                ) : audioState?.status === 'loading' ? (
                    <Button variant="secondary" disabled className="w-full"><Spinner /> {t('generatingAudio')}</Button>
                ) : audioState?.status === 'error' ? (
                    <div className="text-center">
                        <p className="text-xs text-red-400 mb-2">{audioState.error}</p>
                        <Button variant="secondary" onClick={onGenerateAudio} className="w-full">{t('retryButton')}</Button>
                    </div>
                ) : (
                    <Button variant="secondary" onClick={onGenerateAudio} className="w-full"><MicrophoneIcon className="w-5 h-5" /> {t('generateAudioButton')}</Button>
                )}
            </div>
        </div>
    );
};


const ProductAnalysis: React.FC = () => {
    const { t } = useLanguage();
    const { apiKey, isApiKeySet } = useApiKey();
    const [productLink, setProductLink] = useState('');
    const [voiceOverStyle, setVoiceOverStyle] = useState('');
    const [selectedVoice, setSelectedVoice] = useState('Zephyr');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<AnalysisResult | null>(null);
    const [editableScripts, setEditableScripts] = useState<string[]>([]);
    const [audioStates, setAudioStates] = useState<AudioState[]>([]);

    const handleAnalyze = async () => {
        if (!isApiKeySet) {
            setError('API Key is not set.');
            return;
        }
        if (!productLink.trim()) {
            setError('Please enter a product link.');
            return;
        }

        setIsLoading(true);
        setError(null);
        setResult(null);
        setAudioStates([]);
        setEditableScripts([]);

        try {
            const analysisResult = await analyzeProductLink(apiKey, productLink, voiceOverStyle);
            setResult(analysisResult);
            setEditableScripts(analysisResult.voiceOverScripts);
            setAudioStates(analysisResult.voiceOverScripts.map(() => ({ status: 'idle' })));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred during analysis.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleGenerateAudio = async (index: number) => {
        const script = editableScripts[index];
        if (!script || !isApiKeySet) return;
    
        setAudioStates(prev => prev.map((s, i) => i === index ? { ...s, status: 'loading', error: undefined } : s));
    
        try {
            const base64Audio = await generateSpeech(apiKey, script, selectedVoice);
            const pcmBytes = decodeBase64(base64Audio);
            const pcmData = new Int16Array(pcmBytes.buffer);
            const wavBlob = pcmToWavBlob(pcmData, 24000, 1);
            const audioUrl = URL.createObjectURL(wavBlob);
    
            setAudioStates(prev => prev.map((s, i) => i === index ? { status: 'done', url: audioUrl } : s));
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : t('audioGenerationFailed');
            setAudioStates(prev => prev.map((s, i) => i === index ? { status: 'error', error: errorMessage } : s));
        }
    };

    return (
        <>
            <div className="h-full overflow-y-auto bg-dots-pattern p-6 lg:p-10">
                <div className="max-w-3xl mx-auto space-y-12">
                    {/* Controls */}
                    <div className="bg-gray-800/50 backdrop-blur-sm p-6 space-y-6 border border-gray-700 rounded-2xl">
                        <header>
                            <h1 className="text-2xl font-bold text-white">Analisa Produk</h1>
                            <p className="text-sm text-gray-400">Dapatkan wawasan konten dari link produk Anda.</p>
                        </header>
                        <div className="space-y-4">
                            <TextInput
                                label="Link Produk"
                                value={productLink}
                                onChange={(e) => setProductLink(e.target.value)}
                                placeholder="Tempel link TikTok, Shopee, Tokopedia..."
                            />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <SelectInput
                                    label="Gaya Voice Over"
                                    value={voiceOverStyle}
                                    onChange={setVoiceOverStyle}
                                    options={voiceOverStyles}
                                />
                                <SelectInput
                                    label={t('voiceStyleLabel')}
                                    value={selectedVoice}
                                    onChange={setSelectedVoice}
                                    options={voiceOptions}
                                />
                            </div>
                        </div>
                        <Button
                            onClick={handleAnalyze}
                            disabled={isLoading || !isApiKeySet || !productLink.trim()}
                            className="w-full"
                        >
                            {isLoading ? <><Spinner /> Menganalisa...</> : <><SparklesIcon className="w-5 h-5" /> Analisa Produk</>}
                        </Button>
                    </div>

                    {/* Results */}
                    <div className="min-h-[300px]">
                        {isLoading && (
                            <div className="flex flex-col items-center justify-center text-center text-gray-400 h-full">
                                <Spinner className="w-12 h-12" />
                                <p className="mt-4 text-lg font-medium">AI sedang menganalisa produk Anda...</p>
                                <p className="text-sm">Ini mungkin akan memakan waktu sejenak.</p>
                            </div>
                        )}
                        {error && (
                            <div className="text-center text-red-400 bg-red-900/30 p-4 rounded-lg border border-red-800">
                                <p className="font-bold">Analisa Gagal</p>
                                <p className="text-sm">{error}</p>
                            </div>
                        )}
                        {!isLoading && !error && !result && (
                            <div className="text-center text-gray-600 h-full flex flex-col items-center justify-center py-16">
                                <LightbulbIcon className="w-20 h-20" />
                                <h2 className="mt-4 text-2xl font-bold text-gray-400">Hasil Analisa Anda</h2>
                                <p>Tempel link produk dan klik "Analisa" untuk memulai.</p>
                            </div>
                        )}
                        {result && (
                             <div className="space-y-8 animate-fade-in-fast">
                                <ResultCard title="Analisa Produk Detail" content={result.productAnalysis} />
                                
                                {editableScripts.map((script, index) => (
                                    <VoiceOverScriptCard
                                        key={index}
                                        script={script}
                                        onScriptChange={(newText) => {
                                            const newScripts = [...editableScripts];
                                            newScripts[index] = newText;
                                            setEditableScripts(newScripts);
                                        }}
                                        index={index}
                                        audioState={audioStates[index]}
                                        onGenerateAudio={() => handleGenerateAudio(index)}
                                    />
                                ))}

                                <ResultCard title="Caption Video (SEO)" content={result.videoCaption} />
                                <ResultCard title="Hashtag Relevan" content={Array.isArray(result.hashtags) ? result.hashtags.join(' ') : ''} />
                             </div>
                        )}
                    </div>
                </div>
            </div>
            <style>{`
                @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
                }
                .animate-fade-in-fast {
                animation: fadeIn 0.3s ease-in-out;
                }
                audio::-webkit-media-controls-panel { background-color: #374151; }
                audio::-webkit-media-controls-play-button { color: #10b981; }
                audio::-webkit-media-controls-current-time-display { color: #d1d5db; }
                audio::-webkit-media-controls-time-remaining-display { color: #d1d5db; }
                audio::-webkit-media-controls-timeline { background-color: #4b5563; border-radius: 25px; }
                audio::-webkit-media-controls-volume-slider { background-color: #4b5563; border-radius: 25px; }
            `}</style>
        </>
    );
};

export default ProductAnalysis;