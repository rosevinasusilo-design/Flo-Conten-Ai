import React, { createContext, useState, useContext, ReactNode, useCallback } from 'react';
import { resources } from '../translations';

type Language = 'en' | 'id';

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: keyof typeof resources) => string;
  // FIX: Removed getPrompts as it was unused and causing errors.
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// FIX: Define an explicit interface for LanguageProvider props.
// This improves type clarity and can resolve subtle type-checking issues with some toolchains.
interface LanguageProviderProps {
  children: ReactNode;
}

// FIX: Explicitly typed LanguageProvider as a React.FC to resolve an issue where the 'children' prop was not being correctly recognized.
export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('id');

  const t = useCallback((key: keyof typeof resources): string => {
    const resource = resources[key];
    if (resource && typeof resource === 'object' && language in resource) {
      return (resource as any)[language];
    }
    // FIX: Cast key to string to satisfy the function's return type.
    return key as string;
  }, [language]);

  // FIX: Removed getPrompts function as it was unused and causing errors.

  return (
    // FIX: Removed getPrompts from provider value.
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
