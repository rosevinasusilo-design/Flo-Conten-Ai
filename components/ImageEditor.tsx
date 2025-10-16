import React, { useState } from 'react';
import { AspectRatioSettings } from './AspectRatioSettings';
import { ImageEdit } from './ImageEdit';
import type { ImageEditorSubTab } from '../types';
import { useLanguage } from '../contexts/LanguageContext';


const SubTabButton = ({ label, isActive, onClick }: { label: string, isActive: boolean, onClick: () => void }) => {
    return (
        <button
            onClick={onClick}
            className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors duration-200 ${
                isActive
                    ? 'bg-slate-700 text-white'
                    : 'text-gray-400 hover:bg-slate-800/60'
            }`}
        >
            {label}
        </button>
    );
};


const ImageEditor: React.FC = () => {
    const { t } = useLanguage();
    const [activeSubTab, setActiveSubTab] = useState<ImageEditorSubTab>('edit');

    return (
        <div className="h-full flex flex-col bg-slate-900">
            <div className="flex-shrink-0 p-2 border-b border-slate-800">
                <div className="flex items-center justify-center p-1 bg-slate-900/70 rounded-lg max-w-xs mx-auto">
                    <SubTabButton 
                        label={t('editImageSubTab')}
                        isActive={activeSubTab === 'edit'}
                        onClick={() => setActiveSubTab('edit')}
                    />
                    <SubTabButton 
                        label={t('aspectRatioSubTab')}
                        isActive={activeSubTab === 'aspectRatio'}
                        onClick={() => setActiveSubTab('aspectRatio')}
                    />
                </div>
            </div>
            <div className="flex-1 overflow-hidden">
                <div style={{ display: activeSubTab === 'edit' ? 'block' : 'none', height: '100%' }}>
                    <ImageEdit />
                </div>
                <div style={{ display: activeSubTab === 'aspectRatio' ? 'block' : 'none', height: '100%' }}>
                    <AspectRatioSettings />
                </div>
            </div>
        </div>
    );
}

export default ImageEditor;