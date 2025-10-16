import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import { SharedFormProps, StorybookProject, StorybookPage, StoryCharacter } from '../../types';
import { generateRandomString, getTimestamp, sanitizeFileName, getFriendlyApiErrorMessage } from '../../utils/helpers';
import Card from '../Card';
import Input from '../Input';
import Button from '../Button';
import LoadingIndicator from '../LoadingIndicator';

const StorybookForm: React.FC<SharedFormProps & {
    storybookProjects: StorybookProject[];
    setStorybookProjects: React.Dispatch<React.SetStateAction<StorybookProject[]>>;
    activeStorybookIndex: number;
    setActiveStorybookIndex: React.Dispatch<React.SetStateAction<number>>;
}> = ({ addLog, getNextApiKey, logUsage, storybookProjects, setStorybookProjects, activeStorybookIndex, setActiveStorybookIndex, universe }) => {
    
    const activeProject = storybookProjects[activeStorybookIndex];

    const [isGeneratingStory, setIsGeneratingStory] = useState(false);
    const [isGeneratingImages, setIsGeneratingImages] = useState(false);
    const [currentPageIndex, setCurrentPageIndex] = useState(0);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [numberOfPages, setNumberOfPages] = useState(5);
    
    const [selectedCharacters, setSelectedCharacters] = useState<StoryCharacter[]>([]);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [selectedCharIds, setSelectedCharIds] = useState<Set<string>>(new Set());

    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

    useEffect(() => {
        // Cleanup speech synthesis on unmount
        return () => {
            if (window.speechSynthesis.speaking) {
                window.speechSynthesis.cancel();
            }
        };
    }, []);

    const updateActiveProject = (updater: (project: StorybookProject) => StorybookProject) => {
        setStorybookProjects(prev => {
            const newProjects = [...prev];
            newProjects[activeStorybookIndex] = updater(newProjects[activeStorybookIndex]);
            return newProjects;
        });
    };

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
        addLog(`[Storybook] Imported ${newChars.length} character(s).`, 'info');
        setIsImportModalOpen(false);
        setSelectedCharIds(new Set());
    };
    
    const handleRemoveCharacter = (id: string) => {
        setSelectedCharacters(prev => prev.filter(c => c.id !== id));
    };
    
    const handleGenerateStory = async () => {
        const apiKey = getNextApiKey();
        if (!apiKey) {
            addLog('[Storybook] No API Key.', 'error');
            return;
        }
        setIsGeneratingStory(true);
        updateActiveProject(p => ({ ...p, pages: [], fullStoryText: '' }));
        setCurrentPageIndex(0);

        try {
            const ai = new GoogleGenAI({ apiKey });
            const charactersPrompt = selectedCharacters.length > 0 
                ? `\n\n**Karakter yang Telah Ditentukan (WAJIB digunakan secara konsisten dalam cerita dan prompt gambar):**\n${selectedCharacters.map(c => `- ${c.name}: ${c.description}. Pakaian: ${c.clothing}.`).join('\n')}`
                : '';
    
            // STEP 1: Generate the plot outline
            addLog('[Storybook] Langkah 1/2: AI sedang membuat kerangka cerita...', 'status');
            const outlinePrompt = `Anda adalah seorang penulis alur cerita. Berdasarkan ide ini, buatlah kerangka cerita yang dibagi menjadi ${numberOfPages} bagian. Setiap bagian harus menjadi ringkasan singkat dari apa yang terjadi di halaman itu.
Ide Cerita: "${activeProject.idea}"${charactersPrompt}
Kembalikan hasilnya sebagai objek JSON tunggal yang diminifikasi dengan kunci "outline", yang merupakan array berisi ${numberOfPages} string.`;
    
            const outlineResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: outlinePrompt,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: { type: Type.OBJECT, properties: { outline: { type: Type.ARRAY, items: { type: Type.STRING } } } }
                }
            });
            const { outline } = JSON.parse(outlineResponse.text.replace(/\\`\\`\\`json|\\`\\`\\`/g, '').trim());
            if (!outline || !Array.isArray(outline) || outline.length === 0) {
                throw new Error("AI gagal membuat kerangka cerita yang valid.");
            }
            logUsage('text');
    
            // STEP 2: Generate details for each page based on the outline
            addLog(`[Storybook] Langkah 2/2: AI sedang menulis detail untuk ${outline.length} halaman...`, 'status');
            const newPages: StorybookPage[] = [];
            for (let i = 0; i < outline.length; i++) {
                const pageOutline = outline[i];
                addLog(`[Storybook] Menulis halaman ${i + 1}/${outline.length}...`, 'status');
    
                const pageDetailPrompt = `Anda adalah penulis buku cerita anak.
- **Konteks Cerita Keseluruhan:** ${activeProject.idea}
- **Kerangka Cerita Lengkap:**\n${outline.map((o: string, idx: number) => `${idx + 1}. ${o}`).join('\n')}
${charactersPrompt}

TUGAS ANDA: Fokus HANYA pada bagian kerangka cerita berikut untuk halaman ${i + 1}: "${pageOutline}"

Berdasarkan bagian itu, tulis dua hal:
1.  Teks narasi halaman ('text') dalam Bahasa Indonesia.
2.  Prompt gambar yang detail dan artistik ('imagePrompt') untuk generator gambar AI yang cocok dengan teks tersebut.

Kembalikan sebagai objek JSON tunggal yang diminifikasi dengan kunci "text" dan "imagePrompt".`;
    
                const pageDetailResponse = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: pageDetailPrompt,
                    config: {
                        responseMimeType: 'application/json',
                        responseSchema: { type: Type.OBJECT, properties: { text: { type: Type.STRING }, imagePrompt: { type: Type.STRING } } }
                    }
                });
                const pageData = JSON.parse(pageDetailResponse.text.replace(/\\`\\`\\`json|\\`\\`\\`/g, '').trim());
                
                newPages.push({
                    id: generateRandomString(8),
                    pageNumber: i + 1,
                    text: pageData.text,
                    imagePrompt: pageData.imagePrompt,
                    status: 'pending-image'
                });
    
                // Update UI incrementally
                updateActiveProject(p => ({ ...p, pages: [...newPages] }));
                logUsage('text');
            }
    
            const fullStory = newPages.map(p => p.text).join('\n\n');
            updateActiveProject(p => ({ ...p, fullStoryText: fullStory }));
            addLog('[Storybook] Cerita berhasil dibuat. Sekarang membuat gambar.', 'info');
            await handleGenerateImages(newPages);
    
        } catch (error: any) {
            addLog(`[Storybook] Error membuat cerita: ${getFriendlyApiErrorMessage(error)}`, 'error');
        } finally {
            setIsGeneratingStory(false);
        }
    };
    
    const handleGenerateImages = async (pagesToProcess: StorybookPage[]) => {
        setIsGeneratingImages(true);
        let updatedPages = [...pagesToProcess];

        for (let i = 0; i < updatedPages.length; i++) {
            const apiKey = getNextApiKey();
            if (!apiKey) {
                addLog(`[Storybook] Tidak ada kunci API untuk gambar ${i+1}. Berhenti.`, 'error');
                break;
            }
            try {
                const ai = new GoogleGenAI({ apiKey });
                updatedPages[i] = { ...updatedPages[i], status: 'generating-image' };
                updateActiveProject(p => ({ ...p, pages: updatedPages }));
                
                addLog('This is a dummy action. No image will be generated.', 'warning');
                const imageBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="; // 1x1 black pixel
                const imageUrl = `data:image/png;base64,${imageBase64}`;
                
                updatedPages[i] = { ...updatedPages[i], status: 'done', imageUrl };
                updateActiveProject(p => ({ ...p, pages: updatedPages }));
                logUsage('images');
            } catch (error: any) {
                addLog(`[Storybook] Error membuat gambar untuk halaman ${i+1}: ${getFriendlyApiErrorMessage(error)}`, 'error');
                updatedPages[i] = { ...updatedPages[i], status: 'error' };
                updateActiveProject(p => ({ ...p, pages: updatedPages }));
            }
        }
        setIsGeneratingImages(false);
    };

    const handleSpeak = () => {
        if (isSpeaking) {
            window.speechSynthesis.cancel();
            setIsSpeaking(false);
            return;
        }
        const textToSpeak = activeProject.pages[currentPageIndex]?.text;
        if (!textToSpeak) return;

        utteranceRef.current = new SpeechSynthesisUtterance(textToSpeak);
        const indonesianVoice = window.speechSynthesis.getVoices().find(v => v.lang.startsWith('id-ID'));
        if (indonesianVoice) {
            utteranceRef.current.voice = indonesianVoice;
        }
        utteranceRef.current.onstart = () => setIsSpeaking(true);
        utteranceRef.current.onend = () => setIsSpeaking(false);
        window.speechSynthesis.speak(utteranceRef.current);
    };

    const generatePdf = async (): Promise<Blob> => {
        const doc = new jsPDF({
            orientation: 'landscape',
            unit: 'px',
            format: [600, 600] // Square format
        });

        // Title Page
        doc.setFillColor(3, 7, 18); // Dark background
        doc.rect(0, 0, 600, 600, 'F');
        doc.setTextColor(229, 231, 235); // Light text
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(32);
        const titleLines = doc.splitTextToSize(activeProject.idea, 450);
        doc.text(titleLines, 300, 250, { align: 'center' });
        doc.setFontSize(16);
        doc.setFont('Helvetica', 'normal');
        doc.text('Dibuat dengan CHAT TUTOR Veo Bot', 300, 320, { align: 'center' });


        for (const page of activeProject.pages) {
            doc.addPage();
            if (page.imageUrl) {
                doc.addImage(page.imageUrl, 'PNG', 20, 20, 560, 280);
            }
            doc.setFontSize(14);
            const textLines = doc.splitTextToSize(page.text, 560);
            doc.text(textLines, 300, 330, { align: 'center' });
            
            // Page Number
            doc.setFontSize(10);
            doc.text(String(page.pageNumber), 580, 580);
        }

        return doc.output('blob');
    };
    
    const handleDownloadPdf = async () => {
        addLog('[Storybook] Membuat file PDF...', 'status');
        const pdfBlob = await generatePdf();
        const url = URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${sanitizeFileName(activeProject.idea)}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        addLog('[Storybook] PDF berhasil diunduh.', 'info');
    };

    const handleDownloadZip = async () => {
        addLog('[Storybook] Membuat file ZIP...', 'status');
        const zip = new JSZip();
        
        // Add PDF
        const pdfBlob = await generatePdf();
        zip.file(`${sanitizeFileName(activeProject.idea)}.pdf`, pdfBlob);
        
        // Add Images
        const imageFolder = zip.folder("images");
        activeProject.pages.forEach(page => {
            if (page.imageUrl) {
                const base64 = page.imageUrl.split(',')[1];
                imageFolder?.file(`halaman_${page.pageNumber}.png`, base64, { base64: true });
            }
        });
        
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${sanitizeFileName(activeProject.idea)}.zip`;
        a.click();
        URL.revokeObjectURL(url);
        addLog('[Storybook] ZIP berhasil diunduh.', 'info');
    };


    const currentImage = activeProject?.pages[currentPageIndex]?.imageUrl;
    const currentText = activeProject?.pages[currentPageIndex]?.text;

    return (
        <>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 animate-fade-in">
            <div className="lg:col-span-2 space-y-6">
                <Card title="Pembuat Buku Cerita">
                    <Input label="Ide Cerita" id="storybookIdea" value={activeProject.idea} onChange={e => updateActiveProject(p => ({...p, idea: e.target.value}))} />
                    <Input label="Jumlah Halaman" type="number" id="pageCount" min="1" max="20" value={numberOfPages} onChange={e => setNumberOfPages(parseInt(e.target.value))} />
                    <div className="p-3 bg-black/20 rounded-md">
                        <h4 className="text-sm font-semibold text-green-400 mb-2">Karakter (Opsional)</h4>
                        <div className="space-y-2 max-h-32 overflow-y-auto pr-2">
                            {selectedCharacters.length === 0 && <p className="text-xs text-center text-gray-400">Tidak ada karakter yang diimpor.</p>}
                            {selectedCharacters.map(char => (
                                <div key={char.id} className="flex items-center gap-2 bg-slate-700 p-2 rounded">
                                    <img src={char.imageUrl || `https://via.placeholder.com/32/030712/4ade80?text=${char.name.charAt(0)}`} alt={char.name} className="w-8 h-8 rounded-full object-cover" />
                                    <p className="flex-grow text-sm text-white truncate">{char.name}</p>
                                    <Button onClick={() => handleRemoveCharacter(char.id)} size="sm" variant="secondary" className="!p-0 h-6 w-6 flex-shrink-0 text-red-400" title="Remove"><i className="fa-solid fa-times text-xs"></i></Button>
                                </div>
                            ))}
                        </div>
                        <Button onClick={() => setIsImportModalOpen(true)} variant="secondary" size="sm" className="w-full mt-2">Impor dari Universe</Button>
                    </div>
                    <Button onClick={handleGenerateStory} disabled={isGeneratingStory || isGeneratingImages} className="w-full">
                        {isGeneratingStory ? 'Menulis Cerita...' : isGeneratingImages ? 'Menggambar...' : 'Buat Buku Cerita'}
                    </Button>
                     <div className="flex gap-2 pt-4 border-t border-slate-700">
                        <Button onClick={handleDownloadPdf} disabled={!activeProject.pages.some(p => p.imageUrl)} variant="secondary" className="w-full">Unduh PDF</Button>
                        <Button onClick={handleDownloadZip} disabled={!activeProject.pages.some(p => p.imageUrl)} variant="secondary" className="w-full">Unduh ZIP</Button>
                    </div>
                </Card>
                <Card title="Teks Cerita Lengkap">
                    <textarea 
                        className="w-full h-96 bg-black/20 rounded-md p-2 text-sm text-gray-400"
                        value={activeProject.fullStoryText || 'Teks cerita lengkap akan muncul di sini setelah dibuat.'}
                        readOnly
                    />
                </Card>
            </div>
            <div className="lg:col-span-3">
                <Card title="Pemutar Buku Cerita">
                    <div className="aspect-square bg-black rounded-md flex items-center justify-center relative">
                        {(isGeneratingStory || isGeneratingImages) && <LoadingIndicator statusText={isGeneratingImages ? `Menggambar halaman ${activeProject.pages.findIndex(p => p.status === 'generating-image') + 1}...` : isGeneratingStory ? 'Menulis cerita...' : 'Memulai...'}/>}
                        {currentImage && <img src={currentImage} alt={`Page ${currentPageIndex + 1}`} className="w-full h-full object-contain" />}
                        {!currentImage && !isGeneratingImages && !isGeneratingStory && (
                            <div className="text-center text-gray-600">
                                <i className="fa-solid fa-book-open text-5xl"></i>
                                <p className="mt-4">Cerita Anda akan muncul di sini</p>
                            </div>
                        )}
                    </div>
                    <div className="mt-4 p-4 bg-slate-700 rounded-md min-h-[100px]">
                        <p className="text-white">{currentText || '...'}</p>
                    </div>
                    <div className="mt-4 flex justify-between items-center">
                        <Button onClick={() => setCurrentPageIndex(p => Math.max(0, p - 1))} disabled={currentPageIndex === 0}>
                            <i className="fa-solid fa-arrow-left"></i>
                        </Button>
                        <div className="flex items-center gap-4">
                             <Button onClick={handleSpeak} disabled={!currentText || isGeneratingImages || isGeneratingStory}>
                                <i className={`fa-solid ${isSpeaking ? 'fa-stop' : 'fa-play'} mr-2`}></i> {isSpeaking ? 'Hentikan' : 'Bacakan'}
                             </Button>
                            <span className="text-sm text-gray-400">Halaman {currentPageIndex + 1} / {activeProject.pages.length || '?'}</span>
                        </div>
                        <Button onClick={() => setCurrentPageIndex(p => Math.min(activeProject.pages.length - 1, p + 1))} disabled={currentPageIndex >= activeProject.pages.length - 1}>
                           <i className="fa-solid fa-arrow-right"></i>
                        </Button>
                    </div>
                </Card>
            </div>
        </div>

        {isImportModalOpen && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-fade-in" onClick={() => setIsImportModalOpen(false)}>
                <div className="bg-slate-800 p-6 rounded-lg w-full max-w-lg shadow-lg border border-slate-700 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                    <h2 className="text-xl font-bold text-green-400 mb-4 flex-shrink-0">Impor Karakter dari Universe</h2>
                    <div className="flex-grow overflow-y-auto pr-2 space-y-3">
                        {universe.characters.length === 0 ? (
                            <p className="text-center text-gray-400 py-8">Universe Anda kosong.</p>
                        ) : universe.characters.map(char => (
                            <div key={char.id} className="flex items-center gap-4 bg-slate-700 p-3 rounded-lg">
                                <input type="checkbox" id={`sb-import-${char.id}`} className="h-5 w-5 rounded bg-slate-900 text-green-600 focus:ring-green-500"
                                    checked={selectedCharIds.has(char.id)} onChange={() => handleImportCheckboxChange(char.id)} />
                                <img src={char.imageUrl || `https://via.placeholder.com/50/111827/4ade80?text=${char.name.charAt(0)}`} alt={char.name} className="w-12 h-12 rounded-md object-cover"/>
                                <div className="flex-grow">
                                    <label htmlFor={`sb-import-${char.id}`} className="font-semibold text-white cursor-pointer">{char.name}</label>
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

export default StorybookForm;
