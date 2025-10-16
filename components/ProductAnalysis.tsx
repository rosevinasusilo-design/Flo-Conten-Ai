import React, { useState, useCallback } from 'react';
import { useApiKey } from '../contexts/ApiKeyContext';
import { useLanguage } from '../contexts/LanguageContext';
import TextInput from './TextInput';
import Button from './Button';
import { Spinner } from './Spinner';
import { SparklesIcon, LightbulbIcon, ClipboardIcon, CheckCircleIcon } from './icons';
import { analyzeProductLink } from '../services/geminiService';
import SelectInput from './SelectInput';

interface AnalysisResult {
    productAnalysis: string;
    voiceOverScripts: string[];
    videoCaption: string;
    hashtags: string[];
}

const voiceOverStyles = [
    { value: '', label: 'Random / Pilihan AI' },
    { value: 'Enthusiastic & Energetic', label: 'Antusias & Berenergi' },
    { value: 'Calm & Informative', label: 'Tenang & Informatif' },
    { value: 'Storytelling & Emotional', label: 'Penceritaan & Emosional' },
    { value: 'Humorous & Witty', label: 'Humoris & Jenaka' },
    { value: 'Luxurious & Sophisticated', label: 'Mewah & Canggih' },
];

const ResultCard: React.FC<{ title: string; content: string | string[]; }> = ({ title, content }) => {
    const [copySuccess, setCopySuccess] = useState(false);
    const textToCopy = Array.isArray(content) ? content.join(' ') : content;

    const handleCopy = () => {
        navigator.clipboard.writeText(textToCopy);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    };

    return (
        <div className="p-6 bg-gray-800/70 rounded-lg border border-gray-700 relative">
            <h3 className="text-xl font-bold text-emerald-400 mb-3">{title}</h3>
            {Array.isArray(content) ? (
                <p className="text-gray-300 whitespace-pre-wrap">{content.join(' ')}</p>
            ) : (
                <p className="text-gray-300 whitespace-pre-wrap">{content}</p>
            )}
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


const ProductAnalysis: React.FC = () => {
    const { t } = useLanguage();
    const { apiKey, isApiKeySet } = useApiKey();
    const [productLink, setProductLink] = useState('');
    const [voiceOverStyle, setVoiceOverStyle] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<AnalysisResult | null>(null);

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

        try {
            const analysisResult = await analyzeProductLink(apiKey, productLink, voiceOverStyle);
            setResult(analysisResult);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred during analysis.');
        } finally {
            setIsLoading(false);
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
                            <SelectInput
                                label="Gaya Voice Over"
                                value={voiceOverStyle}
                                onChange={setVoiceOverStyle}
                                options={voiceOverStyles}
                            />
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
                                {result.voiceOverScripts.map((script, index) => (
                                    <ResultCard 
                                        key={index}
                                        title={`Naskah Voice Over - Variasi ${index + 1}`} 
                                        content={script} 
                                    />
                                ))}
                                <ResultCard title="Caption Video (SEO)" content={result.videoCaption} />
                                <ResultCard title="Hashtag Relevan" content={result.hashtags} />
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
            `}</style>
        </>
    );
};

export default ProductAnalysis;