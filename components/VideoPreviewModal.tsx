import React from 'react';
import { XIcon } from './icons';

interface VideoPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string | null;
}

export const VideoPreviewModal: React.FC<VideoPreviewModalProps> = ({ isOpen, onClose, videoUrl }) => {
  if (!isOpen || !videoUrl) {
    return null;
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in-fast"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="video-preview-title"
    >
      <div 
        className="relative w-full max-w-4xl max-h-[90vh] p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="video-preview-title" className="sr-only">Video Preview</h2>
        <video 
          src={videoUrl} 
          controls
          autoPlay
          className="w-full h-auto max-h-[90vh] object-contain rounded-lg shadow-2xl"
        />
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 bg-gray-800/70 rounded-full text-white hover:bg-gray-700/70 transition-colors"
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