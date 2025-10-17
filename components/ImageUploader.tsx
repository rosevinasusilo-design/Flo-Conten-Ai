import React, { useRef, ChangeEvent, useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

interface ImageUploaderProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  maxFiles?: number;
  label?: string;
  disabled?: boolean;
  children?: React.ReactNode;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ files, onFilesChange, maxFiles = 1, label, disabled = false, children }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useLanguage();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    if (files.length > 0) {
      objectUrl = URL.createObjectURL(files[0]);
      setPreviewUrl(objectUrl);
    } else {
      setPreviewUrl(null);
    }
    
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [files]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files ? Array.from(event.target.files) : [];
    if (selectedFiles.length > 0) {
        onFilesChange(selectedFiles.slice(0, maxFiles));
    }
  };

  const handleRemoveImage = (e: React.MouseEvent) => {
    if (disabled) return;
    e.stopPropagation();
    e.preventDefault();
    if (fileInputRef.current) {
        fileInputRef.current.value = "";
    }
    onFilesChange([]);
  };

  // FIX: If children are provided, render them as the trigger and hide the default UI.
  if (children) {
    return (
      <>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept="image/png, image/jpeg"
          multiple={maxFiles > 1}
          disabled={disabled}
        />
        <div onClick={() => !disabled && fileInputRef.current?.click()} className={disabled ? 'cursor-not-allowed' : 'cursor-pointer'}>
          {children}
        </div>
      </>
    );
  }

  return (
    <div>
        {label && (
            <label className="block text-sm font-medium text-gray-300 mb-2">
                {label}
            </label>
        )}
      <div
        className={`group relative flex justify-center items-center w-full h-40 rounded-lg border-2 border-dashed border-gray-700 transition-colors duration-300 bg-gray-800/50 ${
            disabled ? 'cursor-not-allowed' : 'hover:border-green-500 cursor-pointer'
        }`}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept="image/png, image/jpeg"
          multiple={maxFiles > 1}
          disabled={disabled}
        />
        {previewUrl ? (
          <>
            <img src={previewUrl} alt="Preview" className="w-full h-full object-contain rounded-md p-2" />
            {files.length > 1 && (
                <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs font-semibold px-2 py-1 rounded-md">
                    + {files.length - 1} lainnya
                </div>
            )}
            <button 
              onClick={handleRemoveImage}
              className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80"
              aria-label={t('removeImage')}
              disabled={disabled}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </>
        ) : (
          <div className="text-center text-gray-500 p-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 mx-auto mb-2 text-gray-600 group-hover:text-green-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            <p className="text-sm">{t('clickToUpload')}</p>
            <p className="text-xs">{t('imageFileTypesShort')}</p>
          </div>
        )}
      </div>
    </div>
  );
};