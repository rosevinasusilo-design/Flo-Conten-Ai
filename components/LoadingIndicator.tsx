import React from 'react';
import { Spinner } from './Spinner';

interface LoadingIndicatorProps {
  statusText?: string;
}

const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({ statusText }) => {
  return (
    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center gap-4 text-white z-10 rounded-lg">
        <Spinner className="w-8 h-8" />
        {statusText && <p className="text-sm font-medium">{statusText}</p>}
    </div>
  );
};

export default LoadingIndicator;
