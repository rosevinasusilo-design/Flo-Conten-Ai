import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const FlagIcon = ({ lang }: { lang: 'en' | 'id' }) => {
  const flags: Record<'en' | 'id', string> = {
    en: '🇺🇸',
    id: '🇮🇩',
  };
  return <span className="mr-2">{flags[lang]}</span>;
}

export const LanguageSwitcher: React.FC = () => {
  const { language, setLanguage } = useLanguage();

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'id' : 'en');
  };

  return (
    <button
      onClick={toggleLanguage}
      className="flex items-center px-3 py-1.5 rounded-md text-sm font-semibold text-gray-300 bg-gray-800/80 hover:bg-gray-700/80 transition-colors"
      aria-label="Switch language"
    >
      <FlagIcon lang={language} />
      {language.toUpperCase()}
    </button>
  );
};
