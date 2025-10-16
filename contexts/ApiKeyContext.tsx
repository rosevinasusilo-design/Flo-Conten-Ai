import React, { createContext, useState, useContext, ReactNode, useEffect, useMemo } from 'react';

// Konteks tidak lagi memerlukan `setApiKey`.
interface ApiKeyContextType {
  apiKey: string;
  isApiKeySet: boolean;
  isInitializing: boolean;
}

const ApiKeyContext = createContext<ApiKeyContextType | undefined>(undefined);

export const ApiKeyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [apiKey, setApiKeyState] = useState<string>('');
  const [isInitializing, setIsInitializing] = useState(true);

  // Fungsi helper untuk memeriksa apakah kunci yang diberikan adalah placeholder.
  const isPlaceholderKey = (key: string | null | undefined): boolean => {
    if (!key) return true; // Anggap null, undefined, atau string kosong sebagai placeholder.
    return key.toUpperCase().includes('PLACEHOLDER');
  };

  // Pada saat komponen dimuat, muat kunci API secara eksklusif dari environment variable.
  // Ini akan memperbaiki error "Failed to fetch" dengan menghapus panggilan ke backend.
  useEffect(() => {
    setIsInitializing(true);
    const envApiKey = process.env.API_KEY;
    
    if (envApiKey && !isPlaceholderKey(envApiKey)) {
        setApiKeyState(envApiKey);
    }
    
    // Inisialisasi selesai, terlepas dari apakah kunci ditemukan.
    // Komponen lain akan menggunakan `isApiKeySet` untuk memeriksa validitas.
    setIsInitializing(false);
  }, []); // Array dependensi kosong memastikan ini hanya berjalan sekali.

  const isApiKeySet = useMemo(() => !!apiKey && !isPlaceholderKey(apiKey), [apiKey]);

  // Menyediakan nilai konteks.
  return (
    <ApiKeyContext.Provider value={{ apiKey, isApiKeySet, isInitializing }}>
      {children}
    </ApiKeyContext.Provider>
  );
};

export const useApiKey = (): ApiKeyContextType => {
  const context = useContext(ApiKeyContext);
  if (context === undefined) {
    throw new Error('useApiKey must be used within an ApiKeyProvider');
  }
  return context;
};