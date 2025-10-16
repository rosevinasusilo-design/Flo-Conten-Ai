import React from 'react';

export const getTimestamp = (): string => new Date().toISOString().replace(/[:.]/g, '-');

export const generateRandomString = (length: number): string => Math.random().toString(36).substring(2, 2 + length);

export const sanitizeFileName = (name: string): string => name.replace(/[^a-z0-9_.-]/gi, '_').toLowerCase();

export const base64ToBlob = (base64: string, mimeType: string): Blob => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
};

export const triggerDownload = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
    }
};

export const getFriendlyApiErrorMessage = (error: any): string => {
    if (error instanceof Error) {
        if (error.message.includes('429')) return 'Rate limit exceeded. Please wait and try again.';
        if (error.message.includes('500')) return 'Server error. Please try again later.';
        return error.message;
    }
    return 'An unknown error occurred.';
};

export const handleSingleImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setImage: (fileData: { name: string; base64: string; mimeType: string; dataUrl: string } | null) => void,
    addLog: (msg: string, type: 'info' | 'error') => void
) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        addLog('Please select an image file.', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
        const dataUrl = loadEvent.target?.result as string;
        const base64 = dataUrl.split(',')[1];
        if (base64) {
            setImage({ name: file.name, base64, mimeType: file.type, dataUrl });
            addLog(`Image "${file.name}" loaded.`, 'info');
        } else {
            addLog('Failed to read the image file.', 'error');
        }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
};

export const handlePaste = (
    e: React.ClipboardEvent<HTMLElement>,
    setImage: (fileData: { name: string; base64: string; mimeType: string; dataUrl: string } | null) => void,
    addLog: (msg: string, type: 'info' | 'error') => void
) => {
    const items = e.clipboardData.items;
    for (const item of items) {
        if (item.type.includes('image')) {
            const file = item.getAsFile();
            if (file) {
                e.preventDefault();
                const reader = new FileReader();
                reader.onload = (loadEvent) => {
                    const dataUrl = loadEvent.target?.result as string;
                    const base64 = dataUrl.split(',')[1];
                    if (base64) {
                        const timestamp = new Date().getTime();
                        setImage({ name: `pasted-image-${timestamp}.png`, base64, mimeType: file.type, dataUrl });
                        addLog('Image pasted from clipboard.', 'info');
                    }
                };
                reader.readAsDataURL(file);
                return;
            }
        }
    }
};

export const triggerFileInput = (ref: React.RefObject<HTMLInputElement>) => {
    ref.current?.click();
};