import React from 'react';
import { XIcon } from './icons';

interface ImagePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string | null;
}

export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({ isOpen, onClose, imageUrl }) => {
  if (!isOpen || !imageUrl) {
    return null;
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in-fast"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="image-preview-title"
    >
      <div 
        className="relative w-full max-w-4xl max-h-[90vh] p-4"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking on the image container
      >
        <h2 id="image-preview-title" className="sr-only">Image Preview</h2>
        <img 
          src={imageUrl} 
          alt="Enlarged product preview"
          className="w-full h-auto max-h-[90vh] object-contain rounded-lg shadow-2xl"
        />
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 bg-black/60 rounded-full text-white hover:bg-white/30 transition-colors"
          aria-label="Close preview"
        >
          <XIcon className="w-6 h-6" />
        </button>
      </div>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in-fast {
          animation: fadeIn 0.2s ease-in-out;
        }
      `}</style>
    </div>
  );
};
