export const isValidJson = (str: string): boolean => {
    if (typeof str !== 'string' || !str.trim()) {
        return false;
    }
    const trimmedStr = str.trim();
    if (!((trimmedStr.startsWith('{') && trimmedStr.endsWith('}')) || (trimmedStr.startsWith('[') && trimmedStr.endsWith(']')))) {
        return false;
    }
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
};

export const getLastFrameAsBase64 = (videoUrl: string): Promise<{ base64: string; mimeType: string; }> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = "anonymous";
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    video.addEventListener('loadeddata', () => {
      // Seek to the very end of the video
      video.currentTime = video.duration;
    });

    video.addEventListener('seeked', () => {
      if (!ctx) {
        return reject(new Error('Could not get 2D context from canvas'));
      }
      // Ensure canvas dimensions match video dimensions
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      // Draw the video frame to the canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      // Get the image data from the canvas
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9); // Use JPEG for smaller size
      const [mimePart, dataPart] = dataUrl.split(';base64,');
      const mimeType = mimePart.split(':')[1];
      resolve({ base64: dataPart, mimeType });
    });

    video.addEventListener('error', (e) => {
      console.error('Video load error:', e);
      reject(new Error('Failed to load video to capture frame.'));
    });

    // Start loading the video
    video.src = videoUrl;
    video.load();
  });
};
