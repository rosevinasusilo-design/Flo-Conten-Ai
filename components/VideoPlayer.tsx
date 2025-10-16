import React, { useEffect, useRef } from 'react';
import type { AspectRatio } from '../types';

interface VideoPlayerProps {
  videoUrl: string;
  aspectRatio: AspectRatio;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ videoUrl, aspectRatio }) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        // When the url changes, load the new video
        if (videoRef.current) {
            videoRef.current.load();
        }
    }, [videoUrl]);

    const aspectRatioStyle: React.CSSProperties = {
        aspectRatio: aspectRatio.replace(':', ' / '),
    };

  return (
    <div style={aspectRatioStyle} className="w-full bg-black rounded-md overflow-hidden">
      <video
        ref={videoRef}
        src={videoUrl}
        controls
        className="w-full h-full object-contain"
        autoPlay
        muted
        loop
      />
    </div>
  );
};

export default VideoPlayer;
