import React, { useState } from 'react';
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { SharedFormProps, StoryCharacter, ImageStudioResultData } from '../../types';
import { getTimestamp, generateRandomString, sanitizeFileName, base64ToBlob, triggerDownload, getFriendlyApiErrorMessage, handleSingleImageUpload, handlePaste, triggerFileInput } from '../../utils/helpers';
import Card from '../Card';
import Button from '../Button';
import LoadingIndicator from '../LoadingIndicator';
import Input from '../Input';

// FIX: Simplified the interface to remove redundant properties and resolve type errors.
interface ConceptVariation extends Partial<ImageStudioResultData> {
    status: 'pending' | 'generating' | 'done' | 'error';
}

const UniverseHubForm: React.FC<SharedFormProps> = ({ universe, setUniverse, addLog, getNextApiKey, getFileSaveDirectory, logUsage, setModalImageUrl }) => {
    
    const [draggedChar, setDraggedChar] = useState<StoryCharacter | null>(null);
    const [isConceptModalOpen, setIsConceptModalOpen] = useState<boolean>(false);
    const [conceptModalCharacter, setConceptModalCharacter] = useState<StoryCharacter | null>(null);
    const [conceptVariations, setConceptVariations] = useState<ConceptVariation[]>([]);
    const characterImageInputRefs = React.useRef<Record<string, HTMLInputElement | null>>({});

    // State for the new character creation modal
    const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
    const [newCharacterName, setNewCharacterName] = useState('');
    const [newCharacterImage, setNewCharacterImage] = useState<{ name: string; base64: string; mimeType: string; dataUrl: string; } | null>(null);
    const [isCreatingCharacter, setIsCreatingCharacter] = useState(false);
    const newCharacterImageInputRef = React.useRef<HTMLInputElement | null>(null);


    const handleOpenUploadModal = () => {
        setNewCharacterName('');
        setNewCharacterImage(null);
        setIsCreatingCharacter(false);
        setIsCreateModalOpen(true);
    };

    const handleGenerateCharacterPlaceholder = () => {
        const newCharacter: StoryCharacter = {
            id: generateRandomString(8),
            name: `Character #${universe.characters.length + 1}`,
            description: 'A new mysterious character.',
            clothing: 'Standard adventurer gear.',
            expression: 'Neutral.',
            status: 'pending',
        };
        setUniverse(u => ({ ...u, characters: [...u.characters, newCharacter] }));
        addLog('Added a new character placeholder. Fill in the details and generate their appearance!', 'info');
    };
    
    const handleSaveNewCharacter = async () => {
        if (!newCharacterImage || !newCharacterName.trim()) {
            addLog("Nama karakter dan gambar harus diisi.", 'error');
            return;
        }
        
        setIsCreatingCharacter(true);
        const apiKey = getNextApiKey();
        if (!apiKey) {
            addLog("Tidak ada Kunci API untuk menganalisis karakter.", 'error');
            setIsCreatingCharacter(false);
            return;
        }

        try {
            const ai = new GoogleGenAI({ apiKey });
            addLog(`Menganalisis gambar untuk karakter ${newCharacterName}...`, 'status');

            const analysisPrompt = "Analyze the character in this image. Describe their general appearance, what clothes they are wearing, and their facial expression. Return a JSON object with keys: 'description', 'clothing', 'expression'.";
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: { parts: [
                    { inlineData: { mimeType: newCharacterImage.mimeType, data: newCharacterImage.base64 } },
                    { text: analysisPrompt }
                ]},
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            description: { type: Type.STRING },
                            clothing: { type: Type.STRING },
                            expression: { type: Type.STRING }
                        }
                    }
                }
            });

            const cleanedText = response.text.replace(/\\`\\`\\`json|\\`\\`\\`/g, '').trim();
            const details = JSON.parse(cleanedText);

            const newCharacter: StoryCharacter = {
                id: generateRandomString(8),
                name: newCharacterName,
                description: details.description,
                clothing: details.clothing,
                expression: details.expression,
                status: 'done',
                imageUrl: newCharacterImage.dataUrl,
                imageBase64: newCharacterImage.base64,
            };
            
            setUniverse(u => ({ ...u, characters: [...u.characters, newCharacter] }));
            addLog(`Karakter "${newCharacterName}" berhasil dibuat dan ditambahkan ke Universe!`, 'info');
            logUsage('text'); // For the analysis
            setIsCreateModalOpen(false);

        } catch (err: any) {
            addLog(`Gagal membuat karakter: ${getFriendlyApiErrorMessage(err)}`, 'error');
        } finally {
            setIsCreatingCharacter(false);
        }
    };

    const handleUpdateCharacter = (id: string, field: keyof Omit<StoryCharacter, 'id' | 'status' | 'imageUrl' | 'imageBase64'>, value: string) => {
        setUniverse(u => ({ ...u, characters: u.characters.map(c => c.id === id ? { ...c, [field]: value } : c) }));
    };
    
    const handleRemoveCharacter = (id: string) => {
        if (window.confirm('Are you sure you want to permanently delete this character from your Universe?')) {
            setUniverse(u => ({ ...u, characters: u.characters.filter(c => c.id !== id) }));
            addLog('Character removed from Universe.', 'info');
        }
    };
    
    const handleGenerateCharacterAppearance = async (characterId: string) => {
        const character = universe.characters.find(c => c.id === characterId);
        if (!character) return;
        
        const currentApiKey = getNextApiKey();
        if (!currentApiKey) {
            addLog(`[Universe] No API key available.`, 'error');
            return;
        }

        setUniverse(u => ({...u, characters: u.characters.map(c => c.id === characterId ? { ...c, status: 'generating' } : c)}));
        try {
            const ai = new GoogleGenAI({ apiKey: currentApiKey });
            const imagePrompt = `Full body character portrait of ${character.name}, a character described as: "${character.description}". They are wearing: "${character.clothing}". Their expression is: "${character.expression}". Style: cinematic, detailed, centered, simple background, 3:4 aspect ratio.`;
            
            addLog('This is a dummy action. No image will be generated.', 'warning');
            // Mock response
            const imageBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="; // 1x1 black pixel
            const imageUrl = `data:image/png;base64,${imageBase64}`;
            
            setUniverse(u => ({...u, characters: u.characters.map(c => c.id === characterId ? { ...c, status: 'done', imageUrl, imageBase64 } : c)}));
            addLog(`[Universe] Generated appearance for ${character.name}.`, 'info');
            logUsage('images');
            
        } catch (error: any) {
            addLog(`[Universe] Error generating appearance: ${getFriendlyApiErrorMessage(error)}`, 'error');
            setUniverse(u => ({...u, characters: u.characters.map(c => c.id === characterId ? { ...c, status: 'error' } : c)}));
        }
    };
    
    const handleUpdateCharacterImage = async (e: React.ChangeEvent<HTMLInputElement>, characterId: string) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const character = universe.characters.find(c => c.id === characterId);
        if (!character) return;

        addLog(`Memperbarui gambar untuk ${character.name}...`, 'info');
        
        const reader = new FileReader();
        reader.onload = async (loadEvent) => {
            const dataUrl = loadEvent.target?.result as string;
            const base64 = dataUrl.split(',')[1];
            if (!base64) {
                addLog(`Gagal membaca gambar baru untuk ${character.name}.`, 'error');
                return;
            }

            setUniverse(u => ({ ...u, characters: u.characters.map(c => c.id === characterId ? { ...c, status: 'generating' } : c) }));

            const apiKey = getNextApiKey();
            if (!apiKey) {
                addLog("Tidak ada Kunci API untuk analisis karakter.", 'error');
                setUniverse(u => ({ ...u, characters: u.characters.map(c => c.id === characterId ? { ...c, status: 'error' } : c)}));
                return;
            }

            try {
                const ai = new GoogleGenAI({ apiKey });
                addLog(`Menganalisis ulang detail untuk ${character.name} dengan gambar baru...`, 'status');

                const analysisPrompt = "Analyze the character in this image. Describe their general appearance, what clothes they are wearing, and their facial expression. Return a JSON object with keys: 'description', 'clothing', 'expression'.";
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: { parts: [{ inlineData: { mimeType: file.type, data: base64 } }, { text: analysisPrompt }] },
                    config: {
                        responseMimeType: 'application/json',
                        responseSchema: {
                            type: Type.OBJECT,
                            properties: {
                                description: { type: Type.STRING },
                                clothing: { type: Type.STRING },
                                expression: { type: Type.STRING }
                            }
                        }
                    }
                });
                
                const cleanedText = response.text.replace(/\\`\\`\\`json|\\`\\`\\`/g, '').trim();
                const details = JSON.parse(cleanedText);

                setUniverse(u => ({ ...u, characters: u.characters.map(c => c.id === characterId ? {
                    ...c,
                    status: 'done',
                    imageUrl: dataUrl,
                    imageBase64: base64,
                    description: details.description,
                    clothing: details.clothing,
                    expression: details.expression,
                } : c) }));
                addLog(`Berhasil memperbarui ${character.name}.`, 'info');
                logUsage('text');

            } catch (err: any) {
                addLog(`Gagal menganalisis ulang karakter ${character.name}: ${getFriendlyApiErrorMessage(err)}`, 'error');
                setUniverse(u => ({ ...u, characters: u.characters.map(c => c.id === characterId ? { ...c, status: 'error' } : c) }));
            }
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const handleGenerateConcepts = async (character: StoryCharacter) => {
        setConceptModalCharacter(character);
        setIsConceptModalOpen(true);
        setConceptVariations(Array(4).fill({ status: 'generating' }));
        addLog('This is a dummy action. No concepts will be generated.', 'warning');
        // FIX: Added a placeholder imageBase64 to the mock data to prevent errors in dependent functions.
        setTimeout(() => {
             setConceptVariations(Array(4).fill({ status: 'done', imageUrl: 'https://via.placeholder.com/300x400', imageBase64: '' }));
        }, 1000)
    };
    
    const handleSetAppearance = (characterId: string, variation: ConceptVariation) => {
        if (!variation.imageUrl || !variation.imageBase64) return;
        setUniverse(u => ({...u, characters: u.characters.map(c => c.id === characterId ? { ...c, status: 'done', imageUrl: variation.imageUrl, imageBase64: variation.imageBase64 } : c)}));
        addLog(`Set new appearance for ${conceptModalCharacter?.name}.`, 'info');
        setIsConceptModalOpen(false);
    };
    
    const handleCharDragStart = (e: React.DragEvent<HTMLDivElement>, char: StoryCharacter) => {
        setDraggedChar(char);
    };
    const handleCharDragOver = (e: React.DragEvent<HTMLDivElement>) => e.preventDefault();
    const handleCharDrop = (e: React.DragEvent<HTMLDivElement>, targetChar: StoryCharacter) => {
        e.preventDefault();
        if (!draggedChar) return;
        
        const charsCopy = [...universe.characters];
        const draggedIndex = charsCopy.findIndex(c => c.id === draggedChar.id);
        const targetIndex = charsCopy.findIndex(c => c.id === targetChar.id);
        
        if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) return;
        
        const [removed] = charsCopy.splice(draggedIndex, 1);
        charsCopy.splice(targetIndex, 0, removed);
        
        setUniverse(u => ({ ...u, characters: charsCopy }));
        setDraggedChar(null);
    };
    const handleCharDragEnd = () => setDraggedChar(null);


    return (
        <>
        <div className="max-w-7xl mx-auto animate-fade-in">
            <Card title="Story Universe Hub">
                <div className="flex flex-col md:flex-row justify-between items-center mb-4">
                    <p className="text-sm text-gray-400 mb-3 md:mb-0">
                        Create and manage your persistent characters here. They can be imported into any story project.
                    </p>
                    <div className="flex gap-2">
                        <Button onClick={handleGenerateCharacterPlaceholder}>
                            <i className="fa-solid fa-wand-magic-sparkles mr-2"></i>Generate New Character
                        </Button>
                        <Button onClick={handleOpenUploadModal} variant="secondary">
                            <i className="fa-solid fa-upload mr-2"></i>Upload Character
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {universe.characters.length === 0 ? (
                        <div className="col-span-full text-center py-16 text-gray-600">
                            <i className="fa-solid fa-users text-5xl"></i>
                            <p className="mt-4">Your universe is waiting.</p>
                            <p className="text-sm">Click "Add New Character" to begin building your cast.</p>
                        </div>
                    ) : (
                        universe.characters.map(char => (
                             <div 
                                key={char.id} 
                                className={`bg-slate-900/50 border border-slate-700 rounded-lg p-4 flex flex-col transition-opacity ${draggedChar?.id === char.id ? 'opacity-30' : 'opacity-100'}`}
                                draggable
                                onDragStart={(e) => handleCharDragStart(e, char)}
                                onDragOver={handleCharDragOver}
                                onDrop={(e) => handleCharDrop(e, char)}
                                onDragEnd={handleCharDragEnd}
                                style={{ cursor: 'grab' }}
                            >
                                <div className="flex gap-4">
                                    <div className="w-1/3 flex-shrink-0">
                                        <div className="aspect-[3/4] bg-black rounded flex items-center justify-center relative group">
                                             <input
                                                type="file"
                                                ref={el => { characterImageInputRefs.current[char.id] = el; }}
                                                onChange={(e) => handleUpdateCharacterImage(e, char.id)}
                                                accept="image/*"
                                                hidden
                                            />
                                            {char.status === 'generating' && <LoadingIndicator statusText='' />}
                                            {char.imageUrl && <img src={char.imageUrl} alt={char.name} className="w-full h-full object-cover rounded cursor-pointer" onClick={() => setModalImageUrl && setModalImageUrl(char.imageUrl)} />}
                                            {!char.imageUrl && char.status !== 'generating' && (
                                                <div className="w-full h-full flex items-center justify-center cursor-pointer" onClick={() => characterImageInputRefs.current[char.id]?.click()} title="Upload Image">
                                                    <i className="fa-solid fa-user-astronaut text-4xl text-gray-600"></i>
                                                </div>
                                            )}
                                            {char.imageUrl && (
                                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 z-10">
                                                     <Button 
                                                        onClick={(e) => { e.stopPropagation(); characterImageInputRefs.current[char.id]?.click(); }} 
                                                        size="sm" variant="secondary" className="!p-2 h-8 w-8" title="Change Image">
                                                        <i className="fa-solid fa-pencil"></i>
                                                    </Button>
                                                    <Button 
                                                        onClick={(e) => { e.stopPropagation(); triggerDownload(char.imageUrl!, `${getTimestamp()}_universe-char_${sanitizeFileName(char.name)}.png`); }} 
                                                        size="sm" variant="secondary" className="!p-2 h-8 w-8" title="Download Image">
                                                        <i className="fa-solid fa-download"></i>
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="w-2/3 space-y-2 flex flex-col">
                                        <div className="flex items-start justify-between gap-2">
                                            <input 
                                                value={char.name} 
                                                onChange={e => handleUpdateCharacter(char.id, 'name', (e.target as HTMLInputElement).value)} 
                                                className="text-lg font-bold bg-transparent focus:bg-slate-700 rounded px-2 py-1 w-full text-white focus:outline-none focus:ring-1 focus:ring-green-500"
                                                placeholder="Character Name"
                                            />
                                            <Button onClick={() => handleRemoveCharacter(char.id)} size="sm" variant="secondary" className="!p-0 h-8 w-8 flex-shrink-0 text-red-400 hover:bg-red-500/20" title="Remove Character">
                                                <i className="fa-solid fa-trash-can"></i>
                                            </Button>
                                        </div>
                                        
                                        <textarea 
                                            value={char.description} 
                                            placeholder="General description..." 
                                            onChange={e => handleUpdateCharacter(char.id, 'description', (e.target as HTMLTextAreaElement).value)} 
                                            rows={3} 
                                            className="w-full bg-slate-700 border border-slate-600 rounded-md py-1 px-2 text-white text-xs focus:ring-1 focus:ring-green-500 focus:border-green-500" 
                                        />
                                        
                                        <div className="grid grid-cols-2 gap-2">
                                            <textarea 
                                                value={char.clothing} 
                                                placeholder="Clothing..." 
                                                onChange={e => handleUpdateCharacter(char.id, 'clothing', (e.target as HTMLTextAreaElement).value)} 
                                                rows={2} 
                                                className="w-full bg-slate-700 border border-slate-600 rounded-md py-1 px-2 text-white text-xs focus:ring-1 focus:ring-green-500 focus:border-green-500"
                                            />
                                            <textarea 
                                                value={char.expression} 
                                                placeholder="Typical Expression..." 
                                                onChange={e => handleUpdateCharacter(char.id, 'expression', (e.target as HTMLTextAreaElement).value)} 
                                                rows={2} 
                                                className="w-full bg-slate-700 border border-slate-600 rounded-md py-1 px-2 text-white text-xs focus:ring-1 focus:ring-green-500 focus:border-green-500"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="flex-grow"></div>
                                 <div className="flex gap-2 w-full mt-3">
                                    <Button onClick={() => handleGenerateCharacterAppearance(char.id)} size="sm" variant="secondary" className="w-full" title="Generate a single, direct appearance">
                                        <i className="fa-solid fa-camera-retro"></i>
                                    </Button>
                                    <Button onClick={() => handleGenerateConcepts(char)} size="sm" variant="primary" className="w-full" title="Generate multiple concepts">
                                        <i className="fa-solid fa-cubes mr-2"></i>Concepts
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </Card>
        </div>

        {isCreateModalOpen && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-fade-in" onClick={() => setIsCreateModalOpen(false)}>
                <div className="bg-slate-800 p-6 rounded-lg w-full max-w-md shadow-lg border border-slate-700" onClick={e => e.stopPropagation()}>
                    <h2 className="text-xl font-bold text-green-400 mb-4">Upload New Character</h2>
                    {isCreatingCharacter ? (
                        <LoadingIndicator statusText="Menganalisis gambar karakter..." />
                    ) : (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-green-400">Gambar Karakter</label>
                            <div 
                                className="h-48 bg-slate-700/50 rounded-lg border-2 border-dashed border-green-500/30 flex items-center justify-center p-2"
                                onPaste={e => handlePaste(e, setNewCharacterImage, addLog)}
                            >
                                {newCharacterImage ? <img src={newCharacterImage.dataUrl} className="max-w-full max-h-full object-contain" /> : <p className="text-xs text-center text-gray-500">Tempel atau Unggah Gambar</p>}
                            </div>
                            <Button onClick={() => triggerFileInput(newCharacterImageInputRef)} variant='secondary' className='w-full'>Unggah Gambar</Button>
                            <input type="file" ref={newCharacterImageInputRef} onChange={e => handleSingleImageUpload(e, setNewCharacterImage, addLog)} accept="image/*" hidden/>
                        </div>
                        <Input 
                            label="Nama Karakter"
                            id="new-char-name"
                            value={newCharacterName}
                            onChange={e => setNewCharacterName((e.target as HTMLInputElement).value)}
                        />
                    </div>
                    )}
                    <div className="flex justify-end gap-2 mt-6">
                        <Button variant="secondary" onClick={() => setIsCreateModalOpen(false)} disabled={isCreatingCharacter}>Batal</Button>
                        <Button onClick={handleSaveNewCharacter} disabled={!newCharacterImage || !newCharacterName.trim() || isCreatingCharacter}>
                            {isCreatingCharacter ? "Menganalisis..." : "Simpan Karakter"}
                        </Button>
                    </div>
                </div>
            </div>
        )}

        {isConceptModalOpen && conceptModalCharacter && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-fade-in" onClick={() => setIsConceptModalOpen(false)}>
                <div className="bg-slate-800 p-6 rounded-lg w-full max-w-2xl shadow-lg border border-slate-700 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                    <h2 className="text-xl font-bold text-green-400 mb-4 flex-shrink-0">AI Concept Artist for "{conceptModalCharacter.name}"</h2>
                     <div className="flex-grow overflow-y-auto pr-2">
                        <div className="grid grid-cols-2 gap-4">
                            {conceptVariations.map((variation, index) => (
                                <div key={index} className="aspect-[3/4] bg-black rounded-lg group relative flex items-center justify-center">
                                    {variation.status === 'pending' && <p className="text-xs text-gray-500">Waiting...</p>}
                                    {variation.status === 'generating' && <LoadingIndicator statusText="" />}
                                    {variation.status === 'error' && <i className="fa-solid fa-exclamation-triangle text-red-500 text-2xl"></i>}
                                    {variation.status === 'done' && variation.imageUrl && (
                                        <>
                                            <img src={variation.imageUrl} alt={`Concept ${index + 1}`} className="w-full h-full object-cover rounded-lg" />
                                            <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <Button onClick={() => handleSetAppearance(conceptModalCharacter.id, variation)}>
                                                    Set as Appearance
                                                </Button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="flex justify-end mt-4 flex-shrink-0">
                        <Button variant="secondary" onClick={() => setIsConceptModalOpen(false)}>Close</Button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
};

export default UniverseHubForm;
